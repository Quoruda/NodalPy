import os
from app.core.node_registry import node_registry

FAST_NODE_TIMEOUT = float(os.getenv("NODAL_FAST_TIMEOUT", 1.0))
node_registry.register("FastNode", timeout=FAST_NODE_TIMEOUT)
