import json
from datetime import datetime, timezone
from sqlalchemy import Column, String, Boolean, Text, DateTime
from app.core.database import Base

class Trigger(Base):
    __tablename__ = "triggers"

    id = Column(String(36), primary_key=True, index=True)
    user_id = Column(String(36), nullable=False, index=True)
    project_id = Column(String(36), nullable=False, index=True)
    node_type = Column(String(64), nullable=False, index=True)
    is_active = Column(Boolean, nullable=False, default=True)
    config_json = Column(Text, nullable=False, default="{}")
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    @property
    def config(self) -> dict:
        try:
            return json.loads(self.config_json or "{}")
        except Exception:
            return {}

    @config.setter
    def config(self, value: dict):
        self.config_json = json.dumps(value or {})
