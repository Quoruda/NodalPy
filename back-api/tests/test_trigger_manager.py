import unittest
import asyncio
from unittest.mock import patch
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.database import Base
from app.models.trigger import Trigger
from app.services.trigger_manager import trigger_manager

class TestTriggerManager(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:")
        self.TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        Base.metadata.create_all(bind=self.engine)
        self.user_id = "user_test_1"
        self.project_id = "project_test_1"
        self.node_id = "node_timer_1"

    def tearDown(self):
        Base.metadata.drop_all(bind=self.engine)

    def test_trigger_db_model_properties(self):
        trigger = Trigger(
            id=self.node_id,
            user_id=self.user_id,
            project_id=self.project_id,
            node_type="TimerNode",
            is_active=True
        )
        trigger.config = {"mode": "interval", "interval": 2.0}
        self.assertEqual(trigger.config.get("interval"), 2.0)

    def test_update_and_delete_trigger(self):
        async def run_test():
            with patch("app.services.trigger_manager.SessionLocal", self.TestingSessionLocal):
                await trigger_manager.update_trigger(
                    user_id=self.user_id,
                    project_id=self.project_id,
                    node_id=self.node_id,
                    node_type="TimerNode",
                    is_active=True,
                    config={"mode": "interval", "interval": 10.0}
                )
                
                db = self.TestingSessionLocal()
                saved = db.query(Trigger).filter(Trigger.id == self.node_id).first()
                self.assertIsNotNone(saved)
                self.assertTrue(saved.is_active)
                db.close()

                await trigger_manager.delete_trigger(self.node_id)
                
                db = self.TestingSessionLocal()
                deleted = db.query(Trigger).filter(Trigger.id == self.node_id).first()
                self.assertIsNone(deleted)
                db.close()

        asyncio.run(run_test())

    def test_delete_project_triggers(self):
        async def run_test():
            with patch("app.services.trigger_manager.SessionLocal", self.TestingSessionLocal):
                await trigger_manager.update_trigger(
                    user_id=self.user_id,
                    project_id=self.project_id,
                    node_id="n1",
                    node_type="TimerNode",
                    is_active=True,
                    config={}
                )
                await trigger_manager.update_trigger(
                    user_id=self.user_id,
                    project_id=self.project_id,
                    node_id="n2",
                    node_type="TimerNode",
                    is_active=True,
                    config={}
                )

                await trigger_manager.delete_project_triggers(self.project_id)
                
                db = self.TestingSessionLocal()
                count = db.query(Trigger).filter(Trigger.project_id == self.project_id).count()
                self.assertEqual(count, 0)
                db.close()

        asyncio.run(run_test())

if __name__ == "__main__":
    unittest.main()
