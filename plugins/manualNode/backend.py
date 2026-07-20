from app.core.node_registry import node_registry

# Declare default schema for ManualNode
node_registry.register(
    node_type="ManualNode", 
    config_schema={
        "timeout": 60.0
    }
)
