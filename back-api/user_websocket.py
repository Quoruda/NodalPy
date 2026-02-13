import asyncio
from variable_converter import convert_value
from fastapi import WebSocket, WebSocketDisconnect
from fastapi.websockets import WebSocketState
from user_manager import UserManager


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

        await self.websocket.send_json({"action": "run_code", "status": "running", "node": data["node"]})
        
        try:
            status, output, error = await asyncio.to_thread(
                self.user.run_node,
                data["node"],
                data["code"],
                data["variables"],
                timeout
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
            await self.websocket.send_json({"action": "login", "status": "success"})
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

