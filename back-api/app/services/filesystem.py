import os
import json
import base64
import asyncio
from pathlib import Path


BINARY_EXTENSIONS = {
    '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp',
    '.mp3', '.wav', '.ogg', '.mp4', '.webm', '.avi',
    '.pdf', '.zip', '.tar', '.gz', '.7z', '.rar',
    '.bin', '.exe', '.dll', '.so', '.dylib',
    '.pkl', '.pickle', '.npy', '.npz',
    '.sqlite', '.db',
}

MAX_TEXT_SIZE = 1024 * 512  # 512 KB max for text file reads
MAX_BINARY_SIZE = 1024 * 1024 * 5  # 5 MB max for binary file reads


def _is_binary(file_path: str) -> bool:
    ext = os.path.splitext(file_path)[1].lower()
    return ext in BINARY_EXTENSIONS


def _safe_resolve(base_dir: str, relative_path: str) -> str:
    """Resolve a relative path within a base directory, preventing path traversal attacks."""
    base = Path(base_dir).resolve()
    target = (base / relative_path).resolve()
    if not str(target).startswith(str(base)):
        raise PermissionError("Path traversal detected")
    return str(target)


def _build_tree(current_dir: str, root_dir: str) -> list:
    """Build a recursive file tree structure. Paths are always relative to root_dir."""
    entries = []
    try:
        items = sorted(os.listdir(current_dir), key=lambda x: (not os.path.isdir(os.path.join(current_dir, x)), x.lower()))
    except PermissionError:
        return entries

    for item in items:
        full_path = os.path.join(current_dir, item)
        rel_path = os.path.relpath(full_path, root_dir)

        if os.path.isdir(full_path):
            entries.append({
                "name": item,
                "path": rel_path,
                "type": "directory",
                "children": _build_tree(full_path, root_dir)
            })
        else:
            try:
                size = os.path.getsize(full_path)
            except OSError:
                size = 0
            entries.append({
                "name": item,
                "path": rel_path,
                "type": "file",
                "size": size,
                "binary": _is_binary(full_path)
            })

    return entries


async def fs_list(files_dir: str) -> dict:
    """List the complete file tree under the user's files directory."""
    os.makedirs(files_dir, exist_ok=True)
    tree = await asyncio.to_thread(_build_tree, files_dir, files_dir)
    return {
        "action": "fs_list",
        "status": "success",
        "tree": tree
    }


async def fs_read(files_dir: str, relative_path: str) -> dict:
    """Read a file's content. Returns text or base64 for binary files."""
    try:
        target = _safe_resolve(files_dir, relative_path)

        if not os.path.exists(target):
            return {"action": "fs_read", "status": "error", "error": "File not found"}

        if not os.path.isfile(target):
            return {"action": "fs_read", "status": "error", "error": "Not a file"}

        file_size = os.path.getsize(target)
        binary = _is_binary(target)

        if binary:
            if file_size > MAX_BINARY_SIZE:
                return {"action": "fs_read", "status": "error", "error": f"File too large ({file_size} bytes)"}

            def read_binary():
                with open(target, "rb") as f:
                    return base64.b64encode(f.read()).decode("ascii")

            content = await asyncio.to_thread(read_binary)
            return {
                "action": "fs_read",
                "status": "success",
                "path": relative_path,
                "content": content,
                "encoding": "base64",
                "size": file_size
            }
        else:
            if file_size > MAX_TEXT_SIZE:
                return {"action": "fs_read", "status": "error", "error": f"File too large ({file_size} bytes)"}

            def read_text():
                with open(target, "r", encoding="utf-8", errors="replace") as f:
                    return f.read()

            content = await asyncio.to_thread(read_text)
            return {
                "action": "fs_read",
                "status": "success",
                "path": relative_path,
                "content": content,
                "encoding": "utf-8",
                "size": file_size
            }

    except PermissionError as e:
        return {"action": "fs_read", "status": "error", "error": str(e)}
    except Exception as e:
        return {"action": "fs_read", "status": "error", "error": str(e)}


async def fs_write(files_dir: str, relative_path: str, content: str, encoding: str = "utf-8") -> dict:
    """Write content to a file. Supports text (utf-8) and binary (base64)."""
    try:
        target = _safe_resolve(files_dir, relative_path)
        os.makedirs(os.path.dirname(target), exist_ok=True)

        if encoding == "base64":
            def write_binary():
                with open(target, "wb") as f:
                    f.write(base64.b64decode(content))

            await asyncio.to_thread(write_binary)
        else:
            def write_text():
                with open(target, "w", encoding="utf-8") as f:
                    f.write(content)

            await asyncio.to_thread(write_text)

        return {"action": "fs_write", "status": "success", "path": relative_path}

    except PermissionError as e:
        return {"action": "fs_write", "status": "error", "error": str(e)}
    except Exception as e:
        return {"action": "fs_write", "status": "error", "error": str(e)}


async def fs_delete(files_dir: str, relative_path: str) -> dict:
    """Delete a file or directory."""
    try:
        target = _safe_resolve(files_dir, relative_path)

        if not os.path.exists(target):
            return {"action": "fs_delete", "status": "error", "error": "Path not found"}

        import shutil
        if os.path.isdir(target):
            await asyncio.to_thread(shutil.rmtree, target)
        else:
            await asyncio.to_thread(os.remove, target)

        return {"action": "fs_delete", "status": "success", "path": relative_path}

    except PermissionError as e:
        return {"action": "fs_delete", "status": "error", "error": str(e)}
    except Exception as e:
        return {"action": "fs_delete", "status": "error", "error": str(e)}


async def fs_mkdir(files_dir: str, relative_path: str) -> dict:
    """Create a directory."""
    try:
        target = _safe_resolve(files_dir, relative_path)
        os.makedirs(target, exist_ok=True)
        return {"action": "fs_mkdir", "status": "success", "path": relative_path}

    except PermissionError as e:
        return {"action": "fs_mkdir", "status": "error", "error": str(e)}
    except Exception as e:
        return {"action": "fs_mkdir", "status": "error", "error": str(e)}


async def fs_rename(files_dir: str, old_path: str, new_path: str) -> dict:
    """Rename or move a file or directory."""
    try:
        old_target = _safe_resolve(files_dir, old_path)
        new_target = _safe_resolve(files_dir, new_path)

        if not os.path.exists(old_target):
            return {"action": "fs_rename", "status": "error", "error": "Source path not found"}

        os.makedirs(os.path.dirname(new_target), exist_ok=True)
        await asyncio.to_thread(os.rename, old_target, new_target)

        return {"action": "fs_rename", "status": "success", "old_path": old_path, "new_path": new_path}

    except PermissionError as e:
        return {"action": "fs_rename", "status": "error", "error": str(e)}
    except Exception as e:
        return {"action": "fs_rename", "status": "error", "error": str(e)}
