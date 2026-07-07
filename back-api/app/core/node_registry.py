class NodeRegistry:
    def __init__(self):
        self.node_configs = {}

    def register(self, node_type: str, timeout: float = None):
        self.node_configs[node_type] = {"timeout": timeout}

    def get_timeout(self, node_type: str) -> float:
        config = self.node_configs.get(node_type)
        if config and config.get("timeout") is not None:
            return config["timeout"]
        from app.core.config import MANUAL_NODE_TIMEOUT
        return MANUAL_NODE_TIMEOUT if MANUAL_NODE_TIMEOUT > 0 else None

node_registry = NodeRegistry()
