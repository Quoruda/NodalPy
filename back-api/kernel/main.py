import asyncio
import json
import argparse
import sys
import os
import venv
from loguru import logger
from .runner import KernelRunner

async def handle_client(reader, writer, runner):
    logger.info("Host connected to kernel.")
    try:
        while True:
            data = await reader.readline()
            if not data:
                break
            
            line = data.decode('utf-8').strip()
            if not line:
                continue
            
            try:
                request = json.loads(line)
            except Exception as e:
                err_resp = {"error": f"Invalid JSON request: {str(e)}"}
                writer.write((json.dumps(err_resp) + "\n").encode('utf-8'))
                await writer.drain()
                continue
            
            action = request.get("action")
            
            if action == "run_node":
                node = request.get("node")
                code = request.get("code")
                variables = request.get("variables", [])
                timeout = request.get("timeout")
                inputs = request.get("inputs")
                
                logger.info(f"Running node {node}...")
                try:
                    status, output, error_msg = runner.run_node(
                        node=node,
                        code=code,
                        variables=variables,
                        timeout=timeout,
                        inputs=inputs
                    )
                    response = {
                        "action": "run_node",
                        "status": status,
                        "node": node,
                        "output": output,
                        "error": error_msg
                    }
                except Exception as e:
                    response = {
                        "action": "run_node",
                        "status": "error",
                        "node": node,
                        "error": str(e)
                    }
                
                writer.write((json.dumps(response) + "\n").encode('utf-8'))
                await writer.drain()
                
            elif action == "get_variable":
                node = request.get("node")
                name = request.get("name")
                
                try:
                    res = runner.get_variable(node, name)
                    response = {
                        "action": "get_variable",
                        "node": node,
                        "name": name,
                        "value": res.get("value"),
                        "type": res.get("type"),
                        "error": None
                    }
                except Exception as e:
                    response = {
                        "action": "get_variable",
                        "node": node,
                        "name": name,
                        "error": str(e)
                    }
                
                writer.write((json.dumps(response) + "\n").encode('utf-8'))
                await writer.drain()
                
            elif action == "shutdown":
                logger.info("Shutdown request received. Exiting kernel.")
                writer.write((json.dumps({"status": "shutdown_ack"}) + "\n").encode('utf-8'))
                await writer.drain()
                sys.exit(0)
                
            else:
                writer.write((json.dumps({"error": f"Unknown action: {action}"}) + "\n").encode('utf-8'))
                await writer.drain()
                
    except asyncio.CancelledError:
        pass
    except Exception as e:
        logger.warning(f"Error handling client: {e}")
    finally:
        logger.info("Host disconnected from kernel.")
        writer.close()
        await writer.wait_closed()

async def main():
    parser = argparse.ArgumentParser(description="NodalPy Isolated Execution Kernel")
    parser.add_argument("--user-id", required=True, help="User identifier")
    parser.add_argument("--host", default="127.0.0.1", help="Host IP to bind to")
    parser.add_argument("--port", type=int, required=True, help="TCP port to listen on")
    parser.add_argument("--storage-dir", required=True, help="Path to persist user files and states")
    args = parser.parse_args()

    venv_dir = os.path.join(args.storage_dir, ".venv")
    if not os.path.exists(venv_dir):
        logger.info(f"Initializing user virtual environment in {venv_dir}...")
        try:
            venv.create(venv_dir, with_pip=True, system_site_packages=True)
            logger.info(f"Virtual environment initialized successfully.")
        except Exception as e:
            logger.error(f"Failed to create virtual environment: {e}")

    runner = KernelRunner(user_id=args.user_id, storage_dir=args.storage_dir)

    server = await asyncio.start_server(
        lambda r, w: handle_client(r, w, runner),
        args.host,
        args.port
    )

    addr = server.sockets[0].getsockname()
    logger.info(f"Kernel started for user {args.user_id} on {addr[0]}:{addr[1]}")
    logger.info(f"Storage path set to: {args.storage_dir}")

    async with server:
        await server.serve_forever()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Kernel stopped by user.")
