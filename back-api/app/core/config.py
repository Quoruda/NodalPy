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
