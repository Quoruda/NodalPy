import os
import json
import time
import uuid
from datetime import datetime, timezone
from ..core.registry import ws_registry
from ..services import filesystem as fs
from ..core.node_registry import node_registry

def verif_args(data: dict, required_args: list[str]) -> bool:
    for arg in required_args:
        if arg not in data:
            return False
    return True

def _migrate_legacy_project(projects_dir):
    old_path = os.path.join(projects_dir, "project.json")
    if not os.path.exists(old_path):
        return
    try:
        with open(old_path, "r", encoding="utf-8") as f:
            old_data = json.load(f)
        now = datetime.now(timezone.utc).isoformat()
        new_id = str(uuid.uuid4())
        new_data = {
            "meta": {
                "name": "My Project",
                "createdAt": now,
                "updatedAt": now
            },
            "nodes": old_data.get("nodes", []),
            "edges": old_data.get("edges", [])
        }
        new_path = os.path.join(projects_dir, f"{new_id}.json")
        with open(new_path, "w", encoding="utf-8") as f:
            json.dump(new_data, f, indent=2)
        os.remove(old_path)
        print(f"✅ Migrated legacy project.json → {new_id}.json", flush=True)
    except Exception as e:
        print(f"❌ Error migrating legacy project: {e}", flush=True)

def _scan_projects(projects_dir):
    projects = []
    for filename in os.listdir(projects_dir):
        if not filename.endswith(".json") or filename == "project.json":
            continue
        filepath = os.path.join(projects_dir, filename)
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
            meta = data.get("meta", {})
            project_id = filename[:-5]
            projects.append({
                "id": project_id,
                "name": meta.get("name", "Untitled"),
                "createdAt": meta.get("createdAt", ""),
                "updatedAt": meta.get("updatedAt", "")
            })
        except Exception:
            pass
    projects.sort(key=lambda p: p.get("updatedAt", ""), reverse=True)
    return projects

@ws_registry.register("ping")
async def handle_ping(session, data: dict):
    await session.websocket.send_json({"action": "pong"})

@ws_registry.register("list_projects")
async def handle_list_projects(session, data: dict):
    try:
        projects_dir = session.user.projects_dir
        os.makedirs(projects_dir, exist_ok=True)
        _migrate_legacy_project(projects_dir)
        projects = _scan_projects(projects_dir)
        await session.websocket.send_json({
            "action": "list_projects",
            "status": "success",
            "projects": projects
        })
    except Exception as e:
        await session.websocket.send_json({
            "action": "list_projects",
            "status": "error",
            "error": str(e)
        })

@ws_registry.register("create_project")
async def handle_create_project(session, data: dict):
    try:
        projects_dir = session.user.projects_dir
        os.makedirs(projects_dir, exist_ok=True)
        now = datetime.now(timezone.utc).isoformat()
        project_id = str(uuid.uuid4())
        name = data.get("name", "Untitled")
        project_data = {
            "meta": {
                "name": name,
                "createdAt": now,
                "updatedAt": now
            },
            "nodes": [],
            "edges": []
        }
        project_path = os.path.join(projects_dir, f"{project_id}.json")
        with open(project_path, "w", encoding="utf-8") as f:
            json.dump(project_data, f, indent=2)
        await session.websocket.send_json({
            "action": "create_project",
            "status": "success",
            "project": {
                "id": project_id,
                "name": name,
                "createdAt": now,
                "updatedAt": now
            }
        })
    except Exception as e:
        await session.websocket.send_json({
            "action": "create_project",
            "status": "error",
            "error": str(e)
        })

@ws_registry.register("delete_project")
async def handle_delete_project(session, data: dict):
    try:
        if not verif_args(data, ["project_id"]):
            await session.websocket.send_json({"error": "missing project_id"})
            return
        projects_dir = session.user.projects_dir
        project_path = os.path.join(projects_dir, f"{data['project_id']}.json")
        if os.path.exists(project_path):
            os.remove(project_path)
        await session.websocket.send_json({
            "action": "delete_project",
            "status": "success",
            "project_id": data["project_id"]
        })
    except Exception as e:
        await session.websocket.send_json({
            "action": "delete_project",
            "status": "error",
            "error": str(e)
        })

@ws_registry.register("rename_project")
async def handle_rename_project(session, data: dict):
    try:
        if not verif_args(data, ["project_id", "name"]):
            await session.websocket.send_json({"error": "missing project_id or name"})
            return
        projects_dir = session.user.projects_dir
        project_path = os.path.join(projects_dir, f"{data['project_id']}.json")
        if not os.path.exists(project_path):
            await session.websocket.send_json({
                "action": "rename_project",
                "status": "error",
                "error": "Project not found"
            })
            return
        with open(project_path, "r", encoding="utf-8") as f:
            project_data = json.load(f)
        project_data.setdefault("meta", {})["name"] = data["name"]
        project_data["meta"]["updatedAt"] = datetime.now(timezone.utc).isoformat()
        with open(project_path, "w", encoding="utf-8") as f:
            json.dump(project_data, f, indent=2)
        await session.websocket.send_json({
            "action": "rename_project",
            "status": "success",
            "project_id": data["project_id"],
            "name": data["name"]
        })
    except Exception as e:
        await session.websocket.send_json({
            "action": "rename_project",
            "status": "error",
            "error": str(e)
        })

@ws_registry.register("run_node")
async def handle_run_node(session, data: dict):
    if not verif_args(data, ["node", "code", "variables"]):
        await session.websocket.send_json({"error": "missing arguments for run_code"})
        return

    node_type = data.get("node_type", "CustomNode")
    timeout = node_registry.get_timeout(node_type)

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
        if not verif_args(data, ["project_id", "project_data"]):
            await session.websocket.send_json({"error": "missing project_id or project_data"})
            return

        projects_dir = session.user.projects_dir
        os.makedirs(projects_dir, exist_ok=True)
        project_path = os.path.join(projects_dir, f"{data['project_id']}.json")

        # Preserve existing meta, only update nodes/edges and updatedAt
        meta = {}
        if os.path.exists(project_path):
            try:
                with open(project_path, "r", encoding="utf-8") as f:
                    existing = json.load(f)
                meta = existing.get("meta", {})
            except Exception:
                pass

        meta["updatedAt"] = datetime.now(timezone.utc).isoformat()
        if "createdAt" not in meta:
            meta["createdAt"] = meta["updatedAt"]
        if "name" not in meta:
            meta["name"] = "Untitled"

        full_data = {
            "meta": meta,
            "nodes": data["project_data"].get("nodes", []),
            "edges": data["project_data"].get("edges", [])
        }

        with open(project_path, "w", encoding="utf-8") as f:
            json.dump(full_data, f, indent=2)

        await session.websocket.send_json({
            "action": "save_project",
            "status": "success",
            "project_id": data["project_id"]
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
        if not verif_args(data, ["project_id"]):
            await session.websocket.send_json({"error": "missing project_id"})
            return

        projects_dir = session.user.projects_dir
        project_path = os.path.join(projects_dir, f"{data['project_id']}.json")

        if os.path.exists(project_path):
            with open(project_path, "r", encoding="utf-8") as f:
                project_data = json.load(f)
            await session.websocket.send_json({
                "action": "load_project",
                "status": "success",
                "project_id": data["project_id"],
                "project_data": project_data
            })
        else:
            await session.websocket.send_json({
                "action": "load_project",
                "status": "error",
                "project_id": data["project_id"],
                "error": "Project not found"
            })
    except Exception as e:
        print(f"Error loading project: {e}")
        await session.websocket.send_json({
            "action": "load_project",
            "status": "error",
            "error": str(e)
        })
