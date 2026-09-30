import json
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base

class Trigger(Base):
    __tablename__ = "triggers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, index=True)
    user_id: Mapped[str] = mapped_column(String(36), index=True)
    project_id: Mapped[str] = mapped_column(String(36), index=True)
    node_type: Mapped[str] = mapped_column(String(64), index=True)
    is_active: Mapped[bool] = mapped_column(default=True)
    config_json: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    @property
    def config(self) -> dict:
        try:
            return json.loads(self.config_json or "{}")
        except Exception:
            return {}

    @config.setter
    def config(self, value: dict):
        self.config_json = json.dumps(value or {})
