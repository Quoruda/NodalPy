import asyncio
import json
import os
import cloudpickle as pickle
from typing import Callable, Dict, Any
from loguru import logger
from ..core.config import STORAGE_DIR
from ..core.database import SessionLocal
from ..models.trigger import Trigger

class TriggerManager:
    def __init__(self):
        self.handlers: Dict[str, Callable] = {}
        self.active_tasks: Dict[str, asyncio.Task] = {}
        self.user_manager = None

    def set_user_manager(self, user_manager):
        self.user_manager = user_manager

    def register_handler(self, node_type: str, handler_func: Callable):
        self.handlers[node_type.lower()] = handler_func

    async def initialize(self, user_manager=None):
        if user_manager:
            self.user_manager = user_manager
        
        db = SessionLocal()
        try:
            active_triggers = db.query(Trigger).filter(Trigger.is_active == True).all()
            for trigger in active_triggers:
                self._schedule_trigger_task(trigger.id, trigger.user_id, trigger.project_id, trigger.node_type, trigger.config)
        except Exception as e:
            logger.error(f"Failed to load active triggers on startup: {e}")
        finally:
            db.close()

    def _schedule_trigger_task(self, node_id: str, user_id: str, project_id: str, node_type: str, config: dict):
        self._cancel_trigger_task(node_id)
        
        handler = self.handlers.get(node_type.lower())
        if not handler:
            return

        async def run_wrapper():
            try:
                await handler(user_id, project_id, node_id, config, self)
            except asyncio.CancelledError:
                pass
            except Exception as e:
                logger.error(f"Error in trigger task for node {node_id}: {e}")

        self.active_tasks[node_id] = asyncio.create_task(run_wrapper())

    def _cancel_trigger_task(self, node_id: str):
        task = self.active_tasks.pop(node_id, None)
        if task and not task.done():
            task.cancel()

    async def update_trigger(self, user_id: str, project_id: str, node_id: str, node_type: str, is_active: bool, config: dict):
        db = SessionLocal()
        try:
            trigger = db.query(Trigger).filter(Trigger.id == node_id).first()
            if not trigger:
                trigger = Trigger(
                    id=node_id,
                    user_id=user_id,
                    project_id=project_id,
                    node_type=node_type,
                    is_active=is_active,
                    config_json=json.dumps(config or {})
                )
                db.add(trigger)
            else:
                trigger.user_id = user_id
                trigger.project_id = project_id
                trigger.node_type = node_type
                trigger.is_active = is_active
                trigger.config_json = json.dumps(config or {})
            
            db.commit()
        except Exception as e:
            db.rollback()
            logger.error(f"Error updating trigger in database for node {node_id}: {e}")
            raise e
        finally:
            db.close()

        if is_active:
            self._schedule_trigger_task(node_id, user_id, project_id, node_type, config)
        else:
            self._cancel_trigger_task(node_id)

    async def delete_trigger(self, node_id: str):
        self._cancel_trigger_task(node_id)
        db = SessionLocal()
        try:
            trigger = db.query(Trigger).filter(Trigger.id == node_id).first()
            if trigger:
                db.delete(trigger)
                db.commit()
        except Exception as e:
            db.rollback()
            logger.error(f"Error deleting trigger {node_id}: {e}")
        finally:
            db.close()

    async def delete_project_triggers(self, project_id: str):
        db = SessionLocal()
        try:
            triggers = db.query(Trigger).filter(Trigger.project_id == project_id).all()
            for trigger in triggers:
                self._cancel_trigger_task(trigger.id)
                db.delete(trigger)
            db.commit()
        except Exception as e:
            db.rollback()
            logger.error(f"Error deleting project triggers for {project_id}: {e}")
        finally:
            db.close()

    async def fire_trigger(self, user_id: str, project_id: str, node_id: str, output_data: dict = None):
        output_payload = output_data or {}
        
        try:
            state_dir = os.path.join(STORAGE_DIR, "users", user_id, ".states")
            os.makedirs(state_dir, exist_ok=True)
            state_file = os.path.join(state_dir, f"{node_id}.pkl")
            
            scope = {
                "output": output_payload,
                "trigger": output_payload,
                "timestamp": output_payload.get("timestamp"),
                "out1": output_payload
            }
            with open(state_file, 'wb') as f:
                pickle.dump(scope, f)
        except Exception as e:
            logger.error(f"Error saving state for trigger {node_id}: {e}")

        if not self.user_manager:
            return

        conn = self.user_manager.active_connections.get(user_id)
        if conn and conn.is_open():
            payload = {
                "action": "trigger_fired",
                "project_id": project_id,
                "node_id": node_id,
                "output": output_payload
            }
            await conn.websocket.send_json(payload)

trigger_manager = TriggerManager()
