import os
from .config_manager import ConfigManager

# Base Directories
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
STORAGE_DIR = os.path.join(BASE_DIR, "storage")
FRONTEND_DIR = os.path.join(BASE_DIR, "front")

# Ensure storage exists
os.makedirs(STORAGE_DIR, exist_ok=True)

# Load Core Config
core_config = ConfigManager(
    name="core",
    default_schema={
        "secret_key": os.getenv("NODAL_SECRET_KEY", "your-secret-key-for-dev-only"),
        "token_expire_minutes": 10080,
        "allow_registration": True,
        "execution_debounce_ms": 50,
        "ws_batch_interval_ms": 0,
        "algorithm": "HS256"
    },
    is_core=True,
    storage_dir=STORAGE_DIR
)

# Export values for the rest of the app
SECRET_KEY = core_config.get("secret_key")
ALGORITHM = core_config.get("algorithm")
ACCESS_TOKEN_EXPIRE_MINUTES = core_config.get("token_expire_minutes")
ALLOW_REGISTRATION = core_config.get("allow_registration")
EXECUTION_DEBOUNCE = core_config.get("execution_debounce_ms")
WS_BATCH_INTERVAL = core_config.get("ws_batch_interval_ms")
