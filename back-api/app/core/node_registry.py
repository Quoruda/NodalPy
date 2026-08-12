import os
import inspect
from typing import Dict, Any
from .config_manager import ConfigManager
from .config import STORAGE_DIR

class NodeRegistry:
    def __init__(self):
        self.node_configs = {}
        self.node_settings = {}

    def register(self, config_schema: Dict[str, Any] = None):
        schema = config_schema or {}
        
        frame = inspect.currentframe().f_back
        caller_file = frame.f_code.co_filename
        node_type = os.path.basename(os.path.dirname(caller_file))
        
        manager = ConfigManager(
            name=node_type,
            default_schema=schema,
            is_core=False,
            storage_dir=STORAGE_DIR
        )
        self.node_settings[node_type.lower()] = manager
        self.node_configs[node_type] = manager.config

    def get_timeout(self, node_type: str) -> float:
        if not node_type:
            return None
        manager = self.node_settings.get(node_type.lower())
        if manager:
            timeout = manager.get("timeout")
            if timeout is not None and float(timeout) > 0:
                return float(timeout)
        return None

    def get_all_configs(self) -> Dict[str, Dict[str, Any]]:
        return self.node_configs

node_registry = NodeRegistry()
