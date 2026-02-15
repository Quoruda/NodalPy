import asyncio
from ..utils.converter import convert_value
from fastapi import WebSocket, WebSocketDisconnect
from fastapi.websockets import WebSocketState
from ..services.user_manager import UserManager
from ..core.config import EXECUTION_DEBOUNCE, WS_BATCH_INTERVAL
import time


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

    async def ws_run_code(self, data: dict):
        if not verif_args(data, ["node", "code", "variables"]):
            await self.websocket.send_json({"error": "missing arguments for run_code"})
            return
        if not self.user.can_run_code():
            await self.websocket.send_json({"error": "code is already running"})
            return

        timeout = data.get("timeout", None)
        inputs = data.get("inputs", [])
        node_id = data["node"]

        # Server-Side Rate Limiting
        # Allow a small buffer (e.g. 0.8 * debounce) to account for network jitter
        # But generally enforce the configured debounce
        now = time.time() * 1000 # ms
        last_time = self.last_execution_time.get(node_id, 0)
        
        # If we receive requests faster than the debounce, we could either:
        # A) Reject them (Error)
        # B) Queue them (Complex)
        # C) Ignore them (Silent drop)
        
        # Here we reject if it's too fast (< 10ms is suspicious abuse, < debounce is improper frontend)
        # For local usage, we are lenient.
        # Let's just track it for now, blocking purely recursive spam is handled by IS_RUNNING check
        # But if user bypasses IS_RUNNING check in some way:
        
        if now - last_time < 10: # Absolute flood protection limits (100Hz)
             await self.websocket.send_json({"error": "Rate limit exceeded"})
             return
             
        self.last_execution_time[node_id] = now

        await self.websocket.send_json({"action": "run_code", "status": "running", "node": data["node"]})
        
        try:
            status, output, error = await asyncio.to_thread(
                self.user.run_node,
                data["node"],
                data["code"],
                data["variables"],
                timeout,
                inputs
            )
            await self.websocket.send_json({
                "action": "run_code", 
                "status": status, 
                "node": data["node"],
                "output": output,
                "error": error
            })
        except Exception as e:
            await self.websocket.send_json({
                "action": "run_code", 
                "status": "error", 
                "node": data["node"],
                "error": str(e)
            })

    async def ws_get_variable(self, data: dict):
        try:
            if not verif_args(data, ["node", "name"]):
                await self.websocket.send_json({"error": "missing arguments for get_variable"})
                return
            value = self.user.get_variable(data["node"], data["name"])
            convertion = convert_value(value)
            # print(convertion) # Removed verbose print
            await self.websocket.send_json({
                "action": "get_variable",
                "node": data["node"],
                "name": data["name"],
                "value": convertion["value"],
                "type": convertion["type"]
            })
        except Exception as e:
            print(f"Error in ws_get_variable: {e}")
            await self.websocket.send_json({
                "action": "get_variable",
                "node": data.get("node"),
                "name": data.get("name"),
                "error": str(e)
            })

    async def loop(self):
        try:
            data = await asyncio.wait_for(self.websocket.receive_json(), timeout=30.0)
            if data["action"] == "login":
                identifier = data["identifier"]
                self.user = self.user_manager.get_user(identifier)
            if self.user is None:
                await self.websocket.close()
                print("❌ WebSocket error: no user")
                return
            await self.websocket.send_json({
                "action": "login", 
                "status": "success",
                "config": {
                    "debounce": EXECUTION_DEBOUNCE,
                    "batch_interval": WS_BATCH_INTERVAL
                }
            })
            while True:
                data = await self.websocket.receive_json()
                if not verif_args(data, ["action"]):
                    await self.websocket.send_json({"error": "missing arguments"})
                    continue
                if data["action"] == "run_node":
                    await self.ws_run_code(data)
                    continue
                if data["action"] == "ping":
                    await self.websocket.send_json({"action": "pong"})
                    continue
                if data["action"] == "get_variable":
                    await self.ws_get_variable(data)
                    continue
        except WebSocketDisconnect:
            pass
        except Exception as e:
            await self.websocket.close()

