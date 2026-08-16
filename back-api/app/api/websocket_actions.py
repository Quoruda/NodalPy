import os
import json
import time
import uuid
from datetime import datetime, timezone
from loguru import logger
from ..core.registry import ws_registry
from ..services import filesystem as fs
from ..core.node_registry import node_registry
from ..core.tier_manager import get_tier_config
from ..core.storage_manager import check_user_quota
from ..services.trigger_manager import trigger_manager

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
        logger.info(f"Migrated legacy project.json → {new_id}.json")
    except Exception as e:
        logger.error(f"Error migrating legacy project: {e}")

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
        tier_config = get_tier_config(session.user.tier)
        max_projects = tier_config.get("max_projects")
        
        projects_dir = session.user.projects_dir
        os.makedirs(projects_dir, exist_ok=True)
        
        if max_projects is not None:
            existing_projects = _scan_projects(projects_dir)
            if len(existing_projects) >= max_projects:
                await session.websocket.send_json({
                    "action": "create_project",
                    "status": "error",
                    "error": f"Limit of {max_projects} projects reached."
                })
                await session.websocket.send_json({
                    "action": "notification",
                    "level": "warning",
                    "message": f"Project limit reached ({max_projects}). Delete a project first."
                })
                return
                
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
        await trigger_manager.delete_project_triggers(data["project_id"])
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

@ws_registry.register("update_trigger")
async def handle_update_trigger(session, data: dict):
    try:
        if not verif_args(data, ["project_id", "node_id", "node_type"]):
            await session.websocket.send_json({"error": "missing arguments for update_trigger"})
            return
        
        is_active = data.get("is_active", True)
        config = data.get("config", {})
        
        await trigger_manager.update_trigger(
            user_id=session.user.user_id,
            project_id=data["project_id"],
            node_id=data["node_id"],
            node_type=data["node_type"],
            is_active=is_active,
            config=config
        )
        
        await session.websocket.send_json({
            "action": "update_trigger",
            "status": "success",
            "node_id": data["node_id"],
            "is_active": is_active
        })
    except Exception as e:
        await session.websocket.send_json({
            "action": "update_trigger",
            "status": "error",
            "error": str(e)
        })

@ws_registry.register("delete_trigger")
async def handle_delete_trigger(session, data: dict):
    try:
        if not verif_args(data, ["node_id"]):
            await session.websocket.send_json({"error": "missing node_id"})
            return
            
        await trigger_manager.delete_trigger(data["node_id"])
        await session.websocket.send_json({
            "action": "delete_trigger",
            "status": "success",
            "node_id": data["node_id"]
        })
    except Exception as e:
        await session.websocket.send_json({
            "action": "delete_trigger",
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
    
    tier_config = get_tier_config(session.user.tier)
    tier_timeout = tier_config.get("execution_timeout")
    if tier_timeout is not None:
        if timeout is None or tier_timeout < timeout:
            timeout = tier_timeout

    inputs = data.get("inputs", [])
    node_id = data["node"]

    if not check_user_quota(session.user.user_id, tier=session.user.tier):
        await session.websocket.send_json({
            "action": "notification",
            "level": "warning",
            "message": "Storage quota reached. Delete files to free up space."
        })
        await session.websocket.send_json({
            "action": "run_code",
            "status": "error",
            "node": node_id,
            "error": "STORAGE_QUOTA_EXCEEDED"
        })
        return

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
        
        if response.get("error") == "STORAGE_QUOTA_EXCEEDED":
            await session.websocket.send_json({
                "action": "notification",
                "level": "warning",
                "message": "Storage quota reached. Delete files to free up space."
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
        
        if response.get("error") == "STORAGE_QUOTA_EXCEEDED":
            await session.websocket.send_json({
                "action": "notification",
                "level": "warning",
                "message": "Storage quota reached. Delete files to free up space."
            })
            
        await session.websocket.send_json({
            "action": "get_variable",
            "node": data["node"],
            "name": data["name"],
            "value": response.get("value"),
            "type": response.get("type")
        })
    except Exception as e:
        logger.error(f"Error in ws_get_variable: {e}")
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

        if not check_user_quota(session.user.user_id, tier=session.user.tier):
            await session.websocket.send_json({
                "action": "notification",
                "level": "error",
                "message": "Storage quota reached. Cannot save project."
            })
            await session.websocket.send_json({
                "action": "save_project",
                "status": "error",
                "error": "STORAGE_QUOTA_EXCEEDED"
            })
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
    except OSError as e:
        if e.errno == 28:
            await session.websocket.send_json({
                "action": "notification",
                "level": "error",
                "message": "Storage quota reached. Cannot save project."
            })
            await session.websocket.send_json({
                "action": "save_project",
                "status": "error",
                "error": "STORAGE_QUOTA_EXCEEDED"
            })
        else:
            logger.error(f"Error saving project: {e}")
            await session.websocket.send_json({
                "action": "save_project",
                "status": "error",
                "error": str(e)
            })
    except Exception as e:
        logger.error(f"Error saving project: {e}")
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
        logger.error(f"Error loading project: {e}")
        await session.websocket.send_json({
            "action": "load_project",
            "status": "error",
            "error": str(e)
        })
