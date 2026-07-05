import asyncio
import os
import json
from fastapi import WebSocket, WebSocketDisconnect
from fastapi.websockets import WebSocketState
from ..services.user_manager import UserManager
from ..services import filesystem as fs
from ..core.config import EXECUTION_DEBOUNCE, WS_BATCH_INTERVAL, FAST_NODE_TIMEOUT, MANUAL_NODE_TIMEOUT
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

        node_type = data.get("node_type", "CustomNode")
        if node_type == "FastNode":
            timeout = FAST_NODE_TIMEOUT
        else:
            timeout = MANUAL_NODE_TIMEOUT if MANUAL_NODE_TIMEOUT > 0 else None

        inputs = data.get("inputs", [])
        node_id = data["node"]

        if not self.user.can_run_code():
            await self.websocket.send_json({
                "action": "run_code",
                "status": "error",
                "node": node_id,
                "error": "The server is already executing code"
            })
            return

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
             await self.websocket.send_json({
                 "action": "run_code",
                 "status": "error",
                 "node": node_id,
                 "error": "Rate limit exceeded"
             })
             return
             
        self.last_execution_time[node_id] = now

        await self.websocket.send_json({"action": "run_code", "status": "running", "node": data["node"]})
        
        try:
            response = await self.user.send_request({
                "action": "run_node",
                "node": data["node"],
                "code": data["code"],
                "variables": data["variables"],
                "timeout": timeout,
                "inputs": inputs
            })
            await self.websocket.send_json({
                "action": "run_code", 
                "status": response.get("status"), 
                "node": data["node"],
                "output": response.get("output", ""),
                "error": response.get("error", "")
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
            response = await self.user.send_request({
                "action": "get_variable",
                "node": data["node"],
                "name": data["name"]
            })
            await self.websocket.send_json({
                "action": "get_variable",
                "node": data["node"],
                "name": data["name"],
                "value": response.get("value"),
                "type": response.get("type")
            })
        except Exception as e:
            print(f"Error in ws_get_variable: {e}")
            await self.websocket.send_json({
                "action": "get_variable",
                "node": data.get("node"),
                "name": data.get("name"),
                "error": str(e)
            })

    async def ws_save_project(self, data: dict):
        try:
            if not verif_args(data, ["project_data"]):
                await self.websocket.send_json({"error": "missing project_data for save_project"})
                return

            projects_dir = self.user.projects_dir
            os.makedirs(projects_dir, exist_ok=True)
            project_path = os.path.join(projects_dir, "project.json")

            with open(project_path, "w", encoding="utf-8") as f:
                json.dump(data["project_data"], f, indent=2)

            await self.websocket.send_json({
                "action": "save_project",
                "status": "success"
            })
        except Exception as e:
            print(f"Error saving project: {e}")
            await self.websocket.send_json({
                "action": "save_project",
                "status": "error",
                "error": str(e)
            })

    async def ws_load_project(self):
        try:
            projects_dir = self.user.projects_dir
            project_path = os.path.join(projects_dir, "project.json")

            if os.path.exists(project_path):
                with open(project_path, "r", encoding="utf-8") as f:
                    project_data = json.load(f)
                await self.websocket.send_json({
                    "action": "load_project",
                    "status": "success",
                    "project_data": project_data
                })
            else:
                await self.websocket.send_json({
                    "action": "load_project",
                    "status": "empty",
                    "message": "No saved project found"
                })
        except Exception as e:
            print(f"Error loading project: {e}")
            await self.websocket.send_json({
                "action": "load_project",
                "status": "error",
                "error": str(e)
            })

    async def ws_fs_list(self):
        result = await fs.fs_list(self.user.files_dir)
        await self.websocket.send_json(result)

    async def ws_fs_read(self, data: dict):
        if not verif_args(data, ["path"]):
            await self.websocket.send_json({"action": "fs_read", "status": "error", "error": "missing path"})
            return
        result = await fs.fs_read(self.user.files_dir, data["path"])
        await self.websocket.send_json(result)

    async def ws_fs_write(self, data: dict):
        if not verif_args(data, ["path", "content"]):
            await self.websocket.send_json({"action": "fs_write", "status": "error", "error": "missing path or content"})
            return
        result = await fs.fs_write(self.user.files_dir, data["path"], data["content"], data.get("encoding", "utf-8"))
        await self.websocket.send_json(result)
        # Notify client to refresh file tree
        tree_result = await fs.fs_list(self.user.files_dir)
        await self.websocket.send_json(tree_result)

    async def ws_fs_delete(self, data: dict):
        if not verif_args(data, ["path"]):
            await self.websocket.send_json({"action": "fs_delete", "status": "error", "error": "missing path"})
            return
        result = await fs.fs_delete(self.user.files_dir, data["path"])
        await self.websocket.send_json(result)
        tree_result = await fs.fs_list(self.user.files_dir)
        await self.websocket.send_json(tree_result)

    async def ws_fs_mkdir(self, data: dict):
        if not verif_args(data, ["path"]):
            await self.websocket.send_json({"action": "fs_mkdir", "status": "error", "error": "missing path"})
            return
        result = await fs.fs_mkdir(self.user.files_dir, data["path"])
        await self.websocket.send_json(result)
        tree_result = await fs.fs_list(self.user.files_dir)
        await self.websocket.send_json(tree_result)

    async def ws_fs_rename(self, data: dict):
        if not verif_args(data, ["old_path", "new_path"]):
            await self.websocket.send_json({"action": "fs_rename", "status": "error", "error": "missing old_path or new_path"})
            return
        result = await fs.fs_rename(self.user.files_dir, data["old_path"], data["new_path"])
        await self.websocket.send_json(result)
        tree_result = await fs.fs_list(self.user.files_dir)
        await self.websocket.send_json(tree_result)

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
                if data["action"] == "run_node":
                    print(f"▶️ Execution call received for node: {data.get('node', 'Unknown')}")
                    await self.ws_run_code(data)
                    continue
                if data["action"] == "ping":
                    await self.websocket.send_json({"action": "pong"})
                    continue
                if data["action"] == "get_variable":
                    await self.ws_get_variable(data)
                    continue
                if data["action"] == "save_project":
                    await self.ws_save_project(data)
                    continue
                if data["action"] == "load_project":
                    await self.ws_load_project()
                    continue
                if data["action"] == "fs_list":
                    await self.ws_fs_list()
                    continue
                if data["action"] == "fs_read":
                    await self.ws_fs_read(data)
                    continue
                if data["action"] == "fs_write":
                    await self.ws_fs_write(data)
                    continue
                if data["action"] == "fs_delete":
                    await self.ws_fs_delete(data)
                    continue
                if data["action"] == "fs_mkdir":
                    await self.ws_fs_mkdir(data)
                    continue
                if data["action"] == "fs_rename":
                    await self.ws_fs_rename(data)
                    continue
        except WebSocketDisconnect:
            pass
        except Exception as e:
            await self.websocket.close()
        finally:
            if self.user and self.user_manager.active_connections.get(self.user.user_id) is self:
                del self.user_manager.active_connections[self.user.user_id]

