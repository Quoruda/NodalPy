from app.core.node_registry import node_registry

node_registry.register(
    config_schema={
        "timeout": 60.0
    }
)
