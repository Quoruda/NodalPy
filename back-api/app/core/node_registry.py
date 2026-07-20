from typing import Dict, Any
from .config_manager import ConfigManager
from .config import STORAGE_DIR

class NodeRegistry:
    def __init__(self):
        self.node_configs = {}
        self.node_settings = {}

    def register(self, node_type: str, config_schema: Dict[str, Any] = None):
        """
        Registers a plugin securely. The Core manages the configuration file 
        creation on behalf of the plugin, avoiding namespace hijacking.
        """
        schema = config_schema or {}
        
        # Instantiate ConfigManager (forces storage in plugins/ folder)
        manager = ConfigManager(
            name=node_type,
            default_schema=schema,
            is_core=False,
            storage_dir=STORAGE_DIR
        )
        self.node_settings[node_type] = manager
        self.node_configs[node_type] = manager.config

    def get_timeout(self, node_type: str) -> float:
        manager = self.node_settings.get(node_type)
        if manager:
            timeout = manager.get("timeout")
            if timeout is not None and float(timeout) > 0:
                return float(timeout)
        return None

node_registry = NodeRegistry()
