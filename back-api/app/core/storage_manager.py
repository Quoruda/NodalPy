import os
from typing import Optional
from .config import STORAGE_DIR
from .tier_manager import get_tier_config

def get_user_storage_bytes(user_id: str) -> int:
    user_dir = os.path.join(STORAGE_DIR, "users", str(user_id))
    if not os.path.exists(user_dir):
        return 0
    total_bytes = 0
    for root, _, files in os.walk(user_dir):
        for file_name in files:
            file_path = os.path.join(root, file_name)
            if not os.path.islink(file_path):
                total_bytes += os.path.getsize(file_path)
    return total_bytes

def check_user_quota(user_id: str, incoming_bytes: int = 0, tier: str = "default") -> bool:
    config = get_tier_config(tier)
    max_disk_mb = config.get("max_disk_mb")
    if not max_disk_mb:
        return True
    current_bytes = get_user_storage_bytes(user_id)
    allowed_bytes = max_disk_mb * 1024 * 1024
    return (current_bytes + incoming_bytes) <= allowed_bytes
