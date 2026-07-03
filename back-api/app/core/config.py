import os

# Base Directories
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
STORAGE_DIR = os.path.join(BASE_DIR, "storage")
FRONTEND_DIR = os.path.join(BASE_DIR, "front")

# Ensure storage exists
os.makedirs(STORAGE_DIR, exist_ok=True)

# Latency Configuration (ms)
# Can be overridden by environment variables for different deployment modes
# Default: Local Desktop (Low Latency)
EXECUTION_DEBOUNCE = int(os.getenv("NODAL_DEBOUNCE", 50))
WS_BATCH_INTERVAL = int(os.getenv("NODAL_BATCH_INTERVAL", 0))

# Timeout Configuration (seconds)
# Default: Fast Nodes have a 1.0s timeout, Manual Nodes have no timeout (0.0 or None)
FAST_NODE_TIMEOUT = float(os.getenv("NODAL_FAST_TIMEOUT", 1.0))
MANUAL_NODE_TIMEOUT = float(os.getenv("NODAL_MANUAL_TIMEOUT", 0.0))
