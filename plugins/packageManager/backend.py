import os
import shutil
import asyncio
import json
import venv
from app.core.registry import ws_registry

def ensure_venv(user_storage_dir):
    venv_dir = os.path.join(user_storage_dir, ".venv")
    if not os.path.exists(venv_dir):
        venv.create(venv_dir, with_pip=True, system_site_packages=True)
    return os.path.join(venv_dir, "bin", "python")

@ws_registry.register("package_manager:list")
async def handle_list_packages(session, data: dict):
    python_path = ensure_venv(session.user.local_storage_dir)
    try:
        proc = await asyncio.create_subprocess_exec(
            python_path, "-m", "pip", "list", "--format=json",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await proc.communicate()
        if proc.returncode == 0:
            packages = json.loads(stdout.decode('utf-8'))
            await session.websocket.send_json({
                "action": "package_manager:list",
                "status": "success",
                "packages": packages
            })
        else:
            await session.websocket.send_json({
                "action": "package_manager:list",
                "status": "error",
                "error": stderr.decode('utf-8')
            })
    except Exception as e:
        await session.websocket.send_json({
            "action": "package_manager:list",
            "status": "error",
            "error": str(e)
        })

@ws_registry.register("package_manager:install")
async def handle_install_package(session, data: dict):
    package_name = data.get("package")
    if not package_name:
        await session.websocket.send_json({
            "action": "package_manager:install",
            "status": "error",
            "error": "No package specified"
        })
        return

    python_path = ensure_venv(session.user.local_storage_dir)
    try:
        proc = await asyncio.create_subprocess_exec(
            python_path, "-m", "pip", "install", package_name,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )

        async def read_stream(stream, log_type):
            while True:
                line = await stream.readline()
                if not line:
                    break
                await session.websocket.send_json({
                    "action": "package_manager:log",
                    "type": log_type,
                    "line": line.decode('utf-8').rstrip()
                })

        await asyncio.gather(
            read_stream(proc.stdout, "stdout"),
            read_stream(proc.stderr, "stderr")
        )
        await proc.wait()

        if proc.returncode == 0:
            await session.websocket.send_json({
                "action": "package_manager:install",
                "status": "success",
                "package": package_name
            })
        else:
            await session.websocket.send_json({
                "action": "package_manager:install",
                "status": "error",
                "error": f"Pip exited with code {proc.returncode}"
            })
    except Exception as e:
        await session.websocket.send_json({
            "action": "package_manager:install",
            "status": "error",
            "error": str(e)
        })

@ws_registry.register("package_manager:uninstall")
async def handle_uninstall_package(session, data: dict):
    package_name = data.get("package")
    if not package_name:
        await session.websocket.send_json({
            "action": "package_manager:uninstall",
            "status": "error",
            "error": "No package specified"
        })
        return

    python_path = ensure_venv(session.user.local_storage_dir)
    try:
        proc = await asyncio.create_subprocess_exec(
            python_path, "-m", "pip", "uninstall", "-y", package_name,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )

        async def read_stream(stream, log_type):
            while True:
                line = await stream.readline()
                if not line:
                    break
                await session.websocket.send_json({
                    "action": "package_manager:log",
                    "type": log_type,
                    "line": line.decode('utf-8').rstrip()
                })

        await asyncio.gather(
            read_stream(proc.stdout, "stdout"),
            read_stream(proc.stderr, "stderr")
        )
        await proc.wait()

        if proc.returncode == 0:
            await session.websocket.send_json({
                "action": "package_manager:uninstall",
                "status": "success",
                "package": package_name
            })
        else:
            await session.websocket.send_json({
                "action": "package_manager:uninstall",
                "status": "error",
                "error": f"Pip exited with code {proc.returncode}"
            })
    except Exception as e:
        await session.websocket.send_json({
            "action": "package_manager:uninstall",
            "status": "error",
            "error": str(e)
        })

@ws_registry.register("package_manager:reset")
async def handle_reset_env(session, data: dict):
    venv_dir = os.path.join(session.user.local_storage_dir, ".venv")
    try:
        if os.path.exists(venv_dir):
            shutil.rmtree(venv_dir)
        ensure_venv(session.user.local_storage_dir)
        await session.websocket.send_json({
            "action": "package_manager:reset",
            "status": "success"
        })
    except Exception as e:
        await session.websocket.send_json({
            "action": "package_manager:reset",
            "status": "error",
            "error": str(e)
        })
