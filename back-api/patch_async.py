import sys

def patch_websocket():
    with open('app/api/websocket.py', 'r') as f:
        content = f.read()

    # Import select
    if 'from sqlalchemy import select' not in content:
        content = content.replace('from ..core.database import SessionLocal', 'from ..core.database import SessionLocal\nfrom sqlalchemy import select')

    old_db = """                    db = SessionLocal()
                    try:
                        db_user = db.query(User).filter(User.id == identifier).first()
                        if not db_user:
                            raise ValueError("User no longer exists in database")
                        user_tier = db_user.tier
                    finally:
                        db.close()"""
    new_db = """                    async with SessionLocal() as db:
                        result = await db.execute(select(User).where(User.id == identifier))
                        db_user = result.scalars().first()
                        if not db_user:
                            raise ValueError("User no longer exists in database")
                        user_tier = db_user.tier"""
    
    content = content.replace(old_db, new_db)
    with open('app/api/websocket.py', 'w') as f:
        f.write(content)

def patch_workflow():
    with open('app/services/workflow_engine.py', 'r') as f:
        content = f.read()
    
    old_db = """                    from ..core.database import SessionLocal
                    from ..models.user import User
                    db = SessionLocal()
                    try:
                        db_user = db.query(User).filter(User.id == str(user_id)).first()
                        if db_user and db_user.tier:
                            user_tier = db_user.tier
                    finally:
                        db.close()"""
    new_db = """                    from ..core.database import SessionLocal
                    from ..models.user import User
                    from sqlalchemy import select
                    async with SessionLocal() as db:
                        result = await db.execute(select(User).where(User.id == str(user_id)))
                        db_user = result.scalars().first()
                        if db_user and db_user.tier:
                            user_tier = db_user.tier"""
    
    content = content.replace(old_db, new_db)
    with open('app/services/workflow_engine.py', 'w') as f:
        f.write(content)

def patch_trigger():
    with open('app/services/trigger_manager.py', 'r') as f:
        content = f.read()

    # Add sqlalchemy import
    if 'from sqlalchemy import select' not in content:
        content = content.replace('from ..models.trigger import Trigger', 'from ..models.trigger import Trigger\nfrom sqlalchemy import select')

    # Chunk 1 (initialize)
    old1 = """        def _get_active_triggers():
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
            active_triggers = await asyncio.to_thread(_get_active_triggers)"""
    new1 = """        try:
            async with SessionLocal() as db:
                result = await db.execute(select(Trigger).where(Trigger.is_active == True))
                triggers = result.scalars().all()
                active_triggers = [{
                    "id": t.id,
                    "user_id": t.user_id,
                    "project_id": t.project_id,
                    "node_type": t.node_type,
                    "config": t.config
                } for t in triggers]"""
    content = content.replace(old1, new1)

    # Chunk 2 (update_trigger)
    old2 = """        def _db_update():
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
            await asyncio.to_thread(_db_update)"""
    new2 = """        try:
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
                
                await db.commit()"""
    content = content.replace(old2, new2)

    # Chunk 3 (delete_trigger)
    old3 = """        def _db_delete():
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
            await asyncio.to_thread(_db_delete)"""
    new3 = """        try:
            async with SessionLocal() as db:
                result = await db.execute(select(Trigger).where(Trigger.id == node_id))
                trigger = result.scalars().first()
                if trigger:
                    await db.delete(trigger)
                    await db.commit()"""
    content = content.replace(old3, new3)

    # Chunk 4 (delete_project_triggers)
    old4 = """        def _get_and_delete_project_triggers():
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
            trigger_ids = await asyncio.to_thread(_get_and_delete_project_triggers)"""
    new4 = """        try:
            async with SessionLocal() as db:
                result = await db.execute(select(Trigger).where(Trigger.project_id == project_id))
                triggers = result.scalars().all()
                trigger_ids = [t.id for t in triggers]
                for trigger in triggers:
                    await db.delete(trigger)
                await db.commit()"""
    content = content.replace(old4, new4)

    with open('app/services/trigger_manager.py', 'w') as f:
        f.write(content)

patch_websocket()
patch_workflow()
patch_trigger()
print("Patched all files!")
