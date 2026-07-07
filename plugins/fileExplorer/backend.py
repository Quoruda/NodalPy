import os
from app.core.registry import ws_registry
from app.services import filesystem as fs

def verif_args(data: dict, required_args: list[str]) -> bool:
    for arg in required_args:
        if arg not in data:
            return False
    return True

@ws_registry.register("fs_list")
async def handle_fs_list(session, data: dict):
    result = await fs.fs_list(session.user.files_dir)
    await session.websocket.send_json(result)

@ws_registry.register("fs_read")
async def handle_fs_read(session, data: dict):
    if not verif_args(data, ["path"]):
        await session.websocket.send_json({"action": "fs_read", "status": "error", "error": "missing path"})
        return
    result = await fs.fs_read(session.user.files_dir, data["path"])
    await session.websocket.send_json(result)

@ws_registry.register("fs_write")
async def handle_fs_write(session, data: dict):
    if not verif_args(data, ["path", "content"]):
        await session.websocket.send_json({"action": "fs_write", "status": "error", "error": "missing path or content"})
        return
    result = await fs.fs_write(session.user.files_dir, data["path"], data["content"], data.get("encoding", "utf-8"))
    await session.websocket.send_json(result)
    tree_result = await fs.fs_list(session.user.files_dir)
    await session.websocket.send_json(tree_result)

@ws_registry.register("fs_delete")
async def handle_fs_delete(session, data: dict):
    if not verif_args(data, ["path"]):
        await session.websocket.send_json({"action": "fs_delete", "status": "error", "error": "missing path"})
        return
    result = await fs.fs_delete(session.user.files_dir, data["path"])
    await session.websocket.send_json(result)
    tree_result = await fs.fs_list(session.user.files_dir)
    await session.websocket.send_json(tree_result)

@ws_registry.register("fs_mkdir")
async def handle_fs_mkdir(session, data: dict):
    if not verif_args(data, ["path"]):
        await session.websocket.send_json({"action": "fs_mkdir", "status": "error", "error": "missing path"})
        return
    result = await fs.fs_mkdir(session.user.files_dir, data["path"])
    await session.websocket.send_json(result)
    tree_result = await fs.fs_list(session.user.files_dir)
    await session.websocket.send_json(tree_result)

@ws_registry.register("fs_rename")
async def handle_fs_rename(session, data: dict):
    if not verif_args(data, ["old_path", "new_path"]):
        await session.websocket.send_json({"action": "fs_rename", "status": "error", "error": "missing old_path or new_path"})
        return
    result = await fs.fs_rename(session.user.files_dir, data["old_path"], data["new_path"])
    await session.websocket.send_json(result)
    tree_result = await fs.fs_list(session.user.files_dir)
    await session.websocket.send_json(tree_result)
