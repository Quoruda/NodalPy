import asyncio
import os
import json
from fastapi import WebSocket, WebSocketDisconnect
from fastapi.websockets import WebSocketState
from ..services.user_manager import UserManager
from ..services import filesystem as fs
from ..core.config import EXECUTION_DEBOUNCE, WS_BATCH_INTERVAL, FAST_NODE_TIMEOUT, MANUAL_NODE_TIMEOUT
from ..core.registry import ws_registry
import app.api.websocket_actions
import plugins.storageMonitor.backend
import plugins.fileExplorer.backend

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
                identifier = data["identifier"]
                self.user = self.user_manager.get_user(identifier)
                
                # Close existing connection if any
                old_conn = self.user_manager.active_connections.get(identifier)
                if old_conn and old_conn is not self:
                    print(f"⚠️ User {identifier} connected from another session. Terminating previous connection...", flush=True)
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
                    print(f"❌ Failed to start kernel for user {identifier}: {e}", flush=True)
                    await self.websocket.send_json({"error": f"Failed to initialize Python environment: {str(e)}"})
                    await self.websocket.close()
                    return
            if self.user is None:
                await self.websocket.close()
                print("❌ WebSocket error: no user")
                return
            await self.websocket.send_json({
                "action": "login", 
                "status": "success",
                "config": {
                    "debounce": EXECUTION_DEBOUNCE,
                    "batch_interval": WS_BATCH_INTERVAL,
                    "fast_timeout": FAST_NODE_TIMEOUT,
                    "manual_timeout": MANUAL_NODE_TIMEOUT
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

