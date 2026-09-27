import sys

def patch_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Apply chunk 1 (initialize)
    chunk1_old = """    async def initialize(self, user_manager=None):
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
            db.close()"""
    chunk1_new = """    async def initialize(self, user_manager=None):
        if user_manager:
            self.user_manager = user_manager
        
        def _get_active_triggers():
            db = SessionLocal()
            try:
                triggers = db.query(Trigger).filter(Trigger.is_active == True).all()
                return [{
                    "id": t.id,
                    "user_id": t.user_id,
                    "project_id": t.project_id,
                    "node_type": t.node_type,
                    "config": t.config
                } for t in triggers]
            finally:
                db.close()

        try:
            active_triggers = await asyncio.to_thread(_get_active_triggers)
            for t_data in active_triggers:
                self._schedule_trigger_task(
                    t_data["id"], 
                    t_data["user_id"], 
                    t_data["project_id"], 
                    t_data["node_type"], 
                    t_data["config"]
                )
        except Exception as e:
            logger.error(f"Failed to load active triggers on startup: {e}")"""
    
    content = content.replace(chunk1_old, chunk1_new)

    # Apply chunk 2 (update_trigger)
    chunk2_old = """    async def update_trigger(self, user_id: str, project_id: str, node_id: str, node_type: str, is_active: bool, config: dict):
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
            self._cancel_trigger_task(node_id)"""
    chunk2_new = """    async def update_trigger(self, user_id: str, project_id: str, node_id: str, node_type: str, is_active: bool, config: dict):
        def _db_update():
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
                raise e
            finally:
                db.close()

        try:
            await asyncio.to_thread(_db_update)
        except Exception as e:
            logger.error(f"Error updating trigger in database for node {node_id}: {e}")
            raise e

        if is_active:
            self._schedule_trigger_task(node_id, user_id, project_id, node_type, config)
        else:
            self._cancel_trigger_task(node_id)"""
    
    content = content.replace(chunk2_old, chunk2_new)

    # Apply chunk 3 (delete_trigger)
    chunk3_old = """    async def delete_trigger(self, node_id: str):
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
            db.close()"""
    chunk3_new = """    async def delete_trigger(self, node_id: str):
        self._cancel_trigger_task(node_id)
        
        def _db_delete():
            db = SessionLocal()
            try:
                trigger = db.query(Trigger).filter(Trigger.id == node_id).first()
                if trigger:
                    db.delete(trigger)
                    db.commit()
            except Exception as e:
                db.rollback()
                raise e
            finally:
                db.close()

        try:
            await asyncio.to_thread(_db_delete)
        except Exception as e:
            logger.error(f"Error deleting trigger {node_id}: {e}")"""
    
    content = content.replace(chunk3_old, chunk3_new)

    # Apply chunk 4 (delete_project_triggers)
    chunk4_old = """    async def delete_project_triggers(self, project_id: str):
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
            db.close()"""
    chunk4_new = """    async def delete_project_triggers(self, project_id: str):
        def _get_and_delete_project_triggers():
            db = SessionLocal()
            try:
                triggers = db.query(Trigger).filter(Trigger.project_id == project_id).all()
                trigger_ids = [t.id for t in triggers]
                for trigger in triggers:
                    db.delete(trigger)
                db.commit()
                return trigger_ids
            except Exception as e:
                db.rollback()
                raise e
            finally:
                db.close()

        try:
            trigger_ids = await asyncio.to_thread(_get_and_delete_project_triggers)
            for tid in trigger_ids:
                self._cancel_trigger_task(tid)
        except Exception as e:
            logger.error(f"Error deleting project triggers for {project_id}: {e}")"""
    
    content = content.replace(chunk4_old, chunk4_new)

    with open(filepath, 'w') as f:
        f.write(content)

patch_file('app/services/trigger_manager.py')
print("Patched trigger_manager.py")
