import asyncio
import os
import json
from fastapi import WebSocket, WebSocketDisconnect
from fastapi.websockets import WebSocketState
from ..services.user_manager import UserManager
from ..services import filesystem as fs
from ..core.config import EXECUTION_DEBOUNCE, WS_BATCH_INTERVAL
from ..core.registry import ws_registry
from ..core.node_registry import node_registry
from ..auth.security import SECRET_KEY, ALGORITHM
import jwt
from jwt.exceptions import InvalidTokenError
from loguru import logger
import app.api.websocket_actions
import importlib
import plugins
import re

FRONTEND_VERSION = "dev"
def _load_frontend_version():
    global FRONTEND_VERSION
    paths = [
        os.path.join("/app/front/index.html"),
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "front-editor", "dist", "index.html")
    ]
    for index_path in paths:
        if os.path.exists(index_path):
            try:
                with open(index_path, "r", encoding="utf-8") as f:
                    html = f.read()
                    match = re.search(r'src="/assets/index-(.*?)\.js"', html)
                    if match:
                        FRONTEND_VERSION = match.group(1)
                        return
            except Exception:
                pass

_load_frontend_version()

plugins_path = plugins.__path__[0] if hasattr(plugins, "__path__") else os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "plugins")
if os.path.exists(plugins_path):
    for item in os.listdir(plugins_path):
        item_path = os.path.join(plugins_path, item)
        if os.path.isdir(item_path):
            backend_file = os.path.join(item_path, "backend.py")
            if os.path.exists(backend_file):
                try:
                    importlib.import_module(f"plugins.{item}.backend")
                except Exception as e:
                    logger.error(f"Error loading plugin backend {item}: {e}")
                    logger.error(traceback.format_exc())

def verif_args(data: dict, required_args: list[str]) -> bool:
    for arg in required_args:
        if arg not in data:
            return False
    return True




class UserWebSocket:
    def __init__(self, websocket: WebSocket, user_manager: UserManager):
        self.websocket = websocket
        self.user_manager = user_manager
        self.user = None
        self.last_execution_time = {} # Map node_id -> timestamp

    def is_open(self) -> bool:
        return self.websocket.client_state == WebSocketState.CONNECTED

    async def close(self):
        try:
            await self.websocket.close()
        except Exception as e:
            pass

    async def loop(self):
        try:
            data = await asyncio.wait_for(self.websocket.receive_json(), timeout=30.0)
            if data["action"] == "login":
                token = data.get("token")
                try:
                    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
                    identifier = payload.get("sub")
                    if identifier is None:
                        raise ValueError("Invalid token")
                except Exception as e:
                    await self.websocket.send_json({"error": "Authentication failed"})
                    await self.websocket.close(code=1008)
                    return

                self.user = self.user_manager.get_user(identifier)
                
                # Close existing connection if any
                old_conn = self.user_manager.active_connections.get(identifier)
                if old_conn and old_conn is not self:
                    logger.warning(f"User {identifier} connected from another session. Terminating previous connection...")
                    try:
                        await old_conn.websocket.close(code=1008)
                    except Exception:
                        pass
                
                self.user_manager.active_connections[identifier] = self

                is_running = self.user.container is not None
                if not is_running:
                    await self.websocket.send_json({
                        "action": "login",
                        "status": "preparing",
                        "message": "Initializing Python environment (starting runner)..."
                    })

                try:
                    await self.user.start()
                except Exception as e:
                    logger.error(f"Failed to start kernel for user {identifier}: {e}")
                    await self.websocket.send_json({"error": f"Failed to initialize Python environment: {str(e)}"})
                    await self.websocket.close()
                    return
            if self.user is None:
                await self.websocket.close()
                logger.error("WebSocket error: no user")
                return
            await self.websocket.send_json({
                "action": "login", 
                "status": "success",
                "front_version": FRONTEND_VERSION,
                "config": {
                    "debounce": EXECUTION_DEBOUNCE,
                    "batch_interval": WS_BATCH_INTERVAL,
                    "fast_timeout": node_registry.get_timeout("FastNode"),
                    "manual_timeout": node_registry.get_timeout("ManualNode")
                }
            })
            while True:
                data = await self.websocket.receive_json()
                if not verif_args(data, ["action"]):
                    await self.websocket.send_json({"error": "missing arguments"})
                    continue
                handler = ws_registry.get_handler(data["action"])
                if handler:
                    await handler(self, data)
                else:
                    await self.websocket.send_json({"error": f"Unknown action: {data['action']}"})
        except WebSocketDisconnect:
            pass
        except Exception as e:
            await self.websocket.close()
        finally:
            if self.user and self.user_manager.active_connections.get(self.user.user_id) is self:
                del self.user_manager.active_connections[self.user.user_id]

