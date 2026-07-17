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

MANUAL_NODE_TIMEOUT = float(os.getenv("NODAL_MANUAL_TIMEOUT", 0.0))

# Auth Configuration
SECRET_KEY = os.getenv("NODAL_SECRET_KEY", "your-secret-key-for-dev-only")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("NODAL_TOKEN_EXPIRE", 10080)) # 7 days by default
