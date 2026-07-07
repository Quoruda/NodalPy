import os
import json
from app.core.registry import ws_registry

def get_dir_size(path):
    total = 0
    if not os.path.exists(path):
        return total
    for dirpath, dirnames, filenames in os.walk(path):
        for f in filenames:
            fp = os.path.join(dirpath, f)
            if not os.path.islink(fp):
                total += os.path.getsize(fp)
    return total

@ws_registry.register("get_storage_info")
async def handle_get_storage_info(session, data: dict):
    files_dir = session.user.files_dir
    projects_dir = session.user.projects_dir
    
    files_size = get_dir_size(files_dir)
    projects_size = get_dir_size(projects_dir)
    states_dir = os.path.join(session.user.local_storage_dir, ".states")
    states_size = get_dir_size(states_dir)
    
    num_files = 0
    if os.path.exists(files_dir):
        num_files = sum([len(files) for r, d, files in os.walk(files_dir)])
        
    num_projects = 0
    if os.path.exists(projects_dir):
        num_projects = sum([len(files) for r, d, files in os.walk(projects_dir)])

    num_states = 0
    if os.path.exists(states_dir):
        num_states = sum([len(files) for r, d, files in os.walk(states_dir)])

    await session.websocket.send_json({
        "action": "get_storage_info",
        "status": "success",
        "files_size": files_size,
        "files_count": num_files,
        "projects_size": projects_size,
        "projects_count": num_projects,
        "states_size": states_size,
        "states_count": num_states
    })
