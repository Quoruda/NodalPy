import asyncio
import json
import os
import cloudpickle as pickle
from typing import Callable, Dict, Any, Optional
from loguru import logger
from ..core.config import STORAGE_DIR
from ..core.database import SessionLocal
from ..models.trigger import Trigger
from sqlalchemy import select

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
        
        try:
            async with SessionLocal() as db:
                result = await db.execute(select(Trigger).where(Trigger.is_active == True))
                triggers = result.scalars().all()
                active_triggers = [{
                    "id": t.id,
                    "user_id": t.user_id,
                    "project_id": t.project_id,
                    "node_type": t.node_type,
                    "config": t.config
                } for t in triggers]
            for t_data in active_triggers:
                self._schedule_trigger_task(
                    t_data["id"], 
                    t_data["user_id"], 
                    t_data["project_id"], 
                    t_data["node_type"], 
                    t_data["config"]
                )
        except Exception as e:
            logger.error(f"Failed to load active triggers on startup: {e}")

    def _schedule_trigger_task(self, node_id: str, user_id: str, project_id: str, node_type: str, config: dict):
        self._cancel_trigger_task(node_id)
        
        handler = self.handlers.get(node_type.lower())
        if not handler:
            logger.warning(f"No handler registered for trigger node_type '{node_type}' (node {node_id})")
            return

        async def run_wrapper():
            try:
                await handler(user_id, project_id, node_id, config, self)
            except asyncio.CancelledError:
                pass
            except Exception as e:
                logger.error(f"Error in trigger task for node {node_id}: {e}")

        task = asyncio.create_task(run_wrapper())
        def _on_done(t):
            if self.active_tasks.get(node_id) is t:
                self.active_tasks.pop(node_id, None)
        task.add_done_callback(_on_done)
        self.active_tasks[node_id] = task

    def _cancel_trigger_task(self, node_id: str):
        task = self.active_tasks.pop(node_id, None)
        if task and not task.done():
            task.cancel()

    async def update_trigger(self, user_id: str, project_id: str, node_id: str, node_type: str, is_active: bool, config: dict):
        try:
            async with SessionLocal() as db:
                result = await db.execute(select(Trigger).where(Trigger.id == node_id))
                trigger = result.scalars().first()
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
                
                await db.commit()
        except Exception as e:
            logger.error(f"Error updating trigger in database for node {node_id}: {e}")
            raise e

        if is_active:
            self._schedule_trigger_task(node_id, user_id, project_id, node_type, config)
        else:
            self._cancel_trigger_task(node_id)

    async def delete_trigger(self, node_id: str):
        self._cancel_trigger_task(node_id)
        
        try:
            async with SessionLocal() as db:
                result = await db.execute(select(Trigger).where(Trigger.id == node_id))
                trigger = result.scalars().first()
                if trigger:
                    await db.delete(trigger)
                    await db.commit()
        except Exception as e:
            logger.error(f"Error deleting trigger {node_id}: {e}")

    async def delete_project_triggers(self, project_id: str):
        try:
            async with SessionLocal() as db:
                result = await db.execute(select(Trigger).where(Trigger.project_id == project_id))
                triggers = result.scalars().all()
                trigger_ids = [t.id for t in triggers]
                for trigger in triggers:
                    await db.delete(trigger)
                await db.commit()
            for tid in trigger_ids:
                self._cancel_trigger_task(tid)
        except Exception as e:
            logger.error(f"Error deleting project triggers for {project_id}: {e}")

    async def shutdown(self):
        """Cleanly cancel and wait on all active background trigger tasks."""
        logger.info(f"Shutting down TriggerManager ({len(self.active_tasks)} active triggers)...")
        tasks = list(self.active_tasks.values())
        for task in tasks:
            if not task.done():
                task.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
        self.active_tasks.clear()

    async def fire_trigger(self, user_id: str, project_id: str, node_id: str, output_data: dict = None):
        output_payload = output_data or {}
        
        try:
            scope = {
                "output": output_payload,
                "trigger": output_payload,
                "timestamp": output_payload.get("timestamp"),
                "out1": output_payload
            }
            # Target both kernel_data/.states (where container reads) and legacy .states
            target_dirs = [
                os.path.join(STORAGE_DIR, "users", str(user_id), "kernel_data", ".states"),
                os.path.join(STORAGE_DIR, "users", str(user_id), ".states")
            ]
            for s_dir in target_dirs:
                os.makedirs(s_dir, exist_ok=True)
                s_file = os.path.join(s_dir, f"{node_id}.pkl")
                t_file = f"{s_file}.tmp"
                with open(t_file, 'wb') as f:
                    pickle.dump(scope, f)
                os.replace(t_file, s_file)
        except Exception as e:
            logger.error(f"Error saving state for trigger {node_id}: {e}")

        # Broadcast trigger_fired event to user if WebSocket is open
        if self.user_manager:
            conn = self.user_manager.active_connections.get(str(user_id))
            if conn and conn.is_open():
                payload = {
                    "action": "trigger_fired",
                    "project_id": project_id,
                    "node_id": node_id,
                    "output": output_payload
                }
                try:
                    await conn.websocket.send_json(payload)
                except Exception as e:
                    logger.debug(f"Failed to send trigger_fired event: {e}")

        # Execute downstream workflow nodes autonomously on the backend
        try:
            from .workflow_engine import workflow_engine
            await workflow_engine.run_downstream(
                user_id=str(user_id),
                project_id=str(project_id),
                source_node_id=str(node_id),
                user_manager=self.user_manager
            )
        except Exception as e:
            logger.error(f"Error running downstream workflow for trigger {node_id}: {e}")

trigger_manager = TriggerManager()
