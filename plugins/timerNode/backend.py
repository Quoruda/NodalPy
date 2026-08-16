import asyncio
import time
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from app.core.node_registry import node_registry
from app.services.trigger_manager import trigger_manager

node_registry.register(
    config_schema={
        "mode": "interval",
        "interval": 5,
        "unit": "minutes",
        "targetTime": "12:00:00",
        "timezone": "UTC",
        "repeatDaily": True
    }
)

def parse_target_time(target_str: str) -> tuple[int, int, int, int]:
    try:
        parts = target_str.split(":")
        hours = int(parts[0]) if len(parts) > 0 else 0
        minutes = int(parts[1]) if len(parts) > 1 else 0
        sec_parts = parts[2].split(".") if len(parts) > 2 else ["0", "0"]
        seconds = int(sec_parts[0]) if len(sec_parts) > 0 else 0
        millis = int(sec_parts[1].ljust(3, "0")[:3]) if len(sec_parts) > 1 and sec_parts[1] else 0
        return hours, minutes, seconds, millis
    except Exception:
        return 12, 0, 0, 0

async def timer_trigger_handler(user_id: str, project_id: str, node_id: str, config: dict, manager):
    mode = config.get("mode", "interval")
    tz_name = config.get("timezone", "UTC")
    
    try:
        user_tz = ZoneInfo(tz_name)
    except Exception:
        user_tz = ZoneInfo("UTC")

    if mode == "exact":
        target_str = config.get("targetTime", "12:00:00")
        repeat_daily = config.get("repeatDaily", True)
        
        while True:
            hours, minutes, seconds, millis = parse_target_time(target_str)
            now = datetime.now(user_tz)
            target_dt = now.replace(hour=hours, minute=minutes, second=seconds, microsecond=millis * 1000)
            
            if target_dt <= now:
                target_dt += timedelta(days=1)
                
            delay = (target_dt - datetime.now(user_tz)).total_seconds()
            if delay > 0:
                await asyncio.sleep(delay)
                
            timestamp = datetime.now(timezone.utc).isoformat()
            await manager.fire_trigger(user_id, project_id, node_id, {
                "timestamp": timestamp,
                "mode": mode,
                "triggeredAt": target_str,
                "timezone": tz_name
            })
            
            if not repeat_daily:
                break
    else:
        try:
            interval_val = int(config.get("interval", 5))
        except Exception:
            interval_val = 5
            
        if interval_val < 1:
            interval_val = 1
            
        unit = config.get("unit", "minutes")
        
        if unit == "hours":
            delay = interval_val * 3600.0
        elif unit == "days":
            delay = interval_val * 86400.0
        else:
            delay = interval_val * 60.0

        if delay < 60.0:
            delay = 60.0
            
        while True:
            await asyncio.sleep(delay)
            timestamp = datetime.now(timezone.utc).isoformat()
            await manager.fire_trigger(user_id, project_id, node_id, {
                "timestamp": timestamp,
                "mode": mode,
                "interval": delay
            })

trigger_manager.register_handler("TimerNode", timer_trigger_handler)
