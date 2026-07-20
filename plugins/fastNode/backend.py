from app.core.node_registry import node_registry

# Declare default schema for FastNode
# The NodeRegistry will handle creating/reading the storage/configs/plugins/FastNode.json file
node_registry.register(
    node_type="FastNode", 
    config_schema={
        "timeout": 1.0
    }
)
