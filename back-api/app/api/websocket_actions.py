import os
import json
import time
from ..core.registry import ws_registry
from ..services import filesystem as fs
from ..core.config import FAST_NODE_TIMEOUT, MANUAL_NODE_TIMEOUT

def verif_args(data: dict, required_args: list[str]) -> bool:
    for arg in required_args:
        if arg not in data:
            return False
    return True

@ws_registry.register("ping")
async def handle_ping(session, data: dict):
    await session.websocket.send_json({"action": "pong"})

@ws_registry.register("run_node")
async def handle_run_node(session, data: dict):
    if not verif_args(data, ["node", "code", "variables"]):
        await session.websocket.send_json({"error": "missing arguments for run_code"})
        return

    node_type = data.get("node_type", "CustomNode")
    if node_type == "FastNode":
        timeout = FAST_NODE_TIMEOUT
    else:
        timeout = MANUAL_NODE_TIMEOUT if MANUAL_NODE_TIMEOUT > 0 else None

    inputs = data.get("inputs", [])
    node_id = data["node"]

    if not session.user.can_run_code():
        await session.websocket.send_json({
            "action": "run_code",
            "status": "error",
            "node": node_id,
            "error": "The server is already executing code"
        })
        return

    now = time.time() * 1000
    last_time = session.last_execution_time.get(node_id, 0)
    
    if now - last_time < 10:
         await session.websocket.send_json({
             "action": "run_code",
             "status": "error",
             "node": node_id,
             "error": "Rate limit exceeded"
         })
         return
         
    session.last_execution_time[node_id] = now

    await session.websocket.send_json({"action": "run_code", "status": "running", "node": data["node"]})
    
    try:
        response = await session.user.send_request({
            "action": "run_node",
            "node": data["node"],
            "code": data["code"],
            "variables": data["variables"],
            "timeout": timeout,
            "inputs": inputs
        })
        await session.websocket.send_json({
            "action": "run_code", 
            "status": response.get("status"), 
            "node": data["node"],
            "output": response.get("output", ""),
            "error": response.get("error", "")
        })
    except Exception as e:
        await session.websocket.send_json({
            "action": "run_code", 
            "status": "error", 
            "node": data["node"],
            "error": str(e)
        })

@ws_registry.register("get_variable")
async def handle_get_variable(session, data: dict):
    try:
        if not verif_args(data, ["node", "name"]):
            await session.websocket.send_json({"error": "missing arguments for get_variable"})
            return
        response = await session.user.send_request({
            "action": "get_variable",
            "node": data["node"],
            "name": data["name"]
        })
        await session.websocket.send_json({
            "action": "get_variable",
            "node": data["node"],
            "name": data["name"],
            "value": response.get("value"),
            "type": response.get("type")
        })
    except Exception as e:
        print(f"Error in ws_get_variable: {e}")
        await session.websocket.send_json({
            "action": "get_variable",
            "node": data.get("node"),
            "name": data.get("name"),
            "error": str(e)
        })

@ws_registry.register("save_project")
async def handle_save_project(session, data: dict):
    try:
        if not verif_args(data, ["project_data"]):
            await session.websocket.send_json({"error": "missing project_data for save_project"})
            return

        projects_dir = session.user.projects_dir
        os.makedirs(projects_dir, exist_ok=True)
        project_path = os.path.join(projects_dir, "project.json")

        with open(project_path, "w", encoding="utf-8") as f:
            json.dump(data["project_data"], f, indent=2)

        await session.websocket.send_json({
            "action": "save_project",
            "status": "success"
        })
    except Exception as e:
        print(f"Error saving project: {e}")
        await session.websocket.send_json({
            "action": "save_project",
            "status": "error",
            "error": str(e)
        })

@ws_registry.register("load_project")
async def handle_load_project(session, data: dict):
    try:
        projects_dir = session.user.projects_dir
        project_path = os.path.join(projects_dir, "project.json")

        if os.path.exists(project_path):
            with open(project_path, "r", encoding="utf-8") as f:
                project_data = json.load(f)
            await session.websocket.send_json({
                "action": "load_project",
                "status": "success",
                "project_data": project_data
            })
        else:
            await session.websocket.send_json({
                "action": "load_project",
                "status": "empty",
                "message": "No saved project found"
            })
    except Exception as e:
        print(f"Error loading project: {e}")
        await session.websocket.send_json({
            "action": "load_project",
            "status": "error",
            "error": str(e)
        })


