import os
import json
from loguru import logger
from typing import Dict, Any

class ConfigManager:
    """
    Manages loading, merging, and saving JSON configuration files.
    """
    def __init__(self, name: str, default_schema: Dict[str, Any], is_core: bool = False, storage_dir: str = "/app/storage"):
        self.name = name
        self.is_core = is_core
        self.storage_dir = storage_dir
        
        # Determine paths
        self.config_dir = os.path.join(self.storage_dir, "configs")
        if not self.is_core:
            self.config_dir = os.path.join(self.config_dir, "plugins")
            
        self.filepath = os.path.join(self.config_dir, f"{self.name}.json")
        self.config = self._load_and_merge(default_schema)

    def _load_and_merge(self, default_schema: Dict[str, Any]) -> Dict[str, Any]:
        os.makedirs(self.config_dir, exist_ok=True)
        
        # If file doesn't exist, create it with default schema
        if not os.path.exists(self.filepath):
            logger.info(f"Creating default config for {'core' if self.is_core else f'plugin {self.name}'} at {self.filepath}")
            self._save(default_schema)
            return default_schema
            
        # If file exists, load and merge
        try:
            with open(self.filepath, "r", encoding="utf-8") as f:
                saved_config = json.load(f)
                
            merged_config = default_schema.copy()
            updated = False
            
            # Override defaults with saved values
            for k, v in saved_config.items():
                if k in merged_config:
                    merged_config[k] = v
                else:
                    # Keep old keys in case they are needed, or we could discard them. Let's keep them for now.
                    merged_config[k] = v
                    
            # Check if any new keys from default_schema were missing in saved_config
            for k, v in default_schema.items():
                if k not in saved_config:
                    updated = True
                    
            # Save if schema was updated
            if updated:
                logger.info(f"Updating config schema for {self.name}")
                self._save(merged_config)
                
            return merged_config
            
        except Exception as e:
            logger.error(f"Failed to load config {self.filepath}: {e}. Falling back to default schema.")
            return default_schema

    def _save(self, config: Dict[str, Any]):
        try:
            with open(self.filepath, "w", encoding="utf-8") as f:
                json.dump(config, f, indent=4)
        except Exception as e:
            logger.error(f"Failed to save config {self.filepath}: {e}")

    def get(self, key: str, default: Any = None) -> Any:
        return self.config.get(key, default)
