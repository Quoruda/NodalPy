import os
import asyncio
import time
import json
import docker
from ..core.config import STORAGE_DIR

class UserKernelProxy:
    def __init__(self, user_id: str):
        self.user_id = user_id
        
        # Paths
        self.local_storage_dir = os.path.join(STORAGE_DIR, user_id)
        self.projects_dir = os.path.join(self.local_storage_dir, "projects")
        self.files_dir = os.path.join(self.local_storage_dir, "files")
        self.nodes_dir = os.path.join(self.local_storage_dir, "nodes")
        
        # Docker execution properties
        self.container_name = f"nodalpy_kernel_{user_id}"
        self.image_name = os.getenv("NODAL_KERNEL_IMAGE", "nodalpy_server:latest")
        self.network_name = os.getenv("NODAL_DOCKER_NETWORK", "nodalpy_network")
        self.host_storage_path = os.getenv("HOST_STORAGE_PATH", os.path.join(os.getcwd(), "storage"))
        self.user_host_files_path = os.path.join(self.host_storage_path, user_id, "files")
        self.container = None
        self.docker_client = None

        # Common properties
        self.reader = None
        self.writer = None
        self.last_activity = time.time()
        self.lock = asyncio.Lock()

    def can_run_code(self) -> bool:
        return not self.lock.locked()

    async def start(self):
        async with self.lock:
            os.makedirs(self.projects_dir, exist_ok=True)
            os.makedirs(self.files_dir, exist_ok=True)
            os.makedirs(self.nodes_dir, exist_ok=True)
            await self._start_docker()

    async def _start_docker(self):
        if self.container is not None:
            return

        print(f"🐳 Spawning kernel container '{self.container_name}' using image '{self.image_name}'...", flush=True)
        
        try:
            self.docker_client = docker.from_env()
        except Exception as e:
            print(f"❌ Failed to connect to host Docker daemon: {e}", flush=True)
            raise RuntimeError(f"Failed to connect to Docker daemon: {e}")

        # Ensure container folder exists inside /app/storage
        os.makedirs(self.files_dir, exist_ok=True)

        # Check and remove any stale container with the same name
        try:
            stale = self.docker_client.containers.get(self.container_name)
            print(f"♻️ Found stale container '{self.container_name}'. Stopping and removing it...", flush=True)
            stale.stop(timeout=2)
            stale.remove()
        except docker.errors.NotFound:
            pass

        try:
            self.container = self.docker_client.containers.run(
                image=self.image_name,
                command=[
                    "python",
                    "-m",
                    "kernel.main",
                    "--user-id",
                    self.user_id,
                    "--host",
                    "0.0.0.0",
                    "--port",
                    "8000",
                    "--storage-dir",
                    "/app/storage"
                ],
                name=self.container_name,
                network=self.network_name,
                volumes={
                    os.path.join(self.host_storage_path, self.user_id): {
                        "bind": "/app/storage",
                        "mode": "rw"
                    }
                },
                detach=True,
                auto_remove=True
            )
        except Exception as e:
            print(f"❌ Failed to run Docker container '{self.container_name}': {e}", flush=True)
            self.container = None
            raise e

        # Wait for container port to be ready
        connected = False
        for _ in range(50):
            # Check if container died
            self.container.reload()
            if self.container.status == "exited":
                logs = self.container.logs().decode('utf-8')
                print(f"❌ Kernel container '{self.container_name}' exited immediately. Logs:\n{logs}", flush=True)
                self.container = None
                raise RuntimeError("Kernel container exited immediately after launch")

            try:
                # Inside docker network, the container name acts as hostname
                self.reader, self.writer = await asyncio.open_connection(self.container_name, 8000)
                connected = True
                break
            except Exception:
                await asyncio.sleep(0.1)

        if not connected:
            print(f"❌ Failed to connect to kernel container '{self.container_name}' after 5 seconds.", flush=True)
            try:
                self.container.stop(timeout=2)
            except Exception:
                pass
            self.container = None
            raise RuntimeError("Failed to connect to spawned user kernel container")

        print(f"✅ Connected to user kernel container '{self.container_name}'", flush=True)

    async def stop(self):
        async with self.lock:
            await self._stop_docker()

    async def _stop_docker(self):
        if self.container is None:
            return

        print(f"🐳 Stopping kernel container '{self.container_name}'...", flush=True)
        try:
            if self.writer:
                self.writer.write(json.dumps({"action": "shutdown"}).encode('utf-8') + b"\n")
                await self.writer.drain()
        except Exception:
            pass

        try:
            self.container.stop(timeout=2)
        except Exception as e:
            print(f"⚠️ Error stopping container: {e}", flush=True)

        self.container = None
        self.reader = None
        self.writer = None
        print(f"🐳 Kernel container '{self.container_name}' stopped.", flush=True)

    async def send_request(self, request: dict) -> dict:
        self.last_activity = time.time()
        
        if self.container is None:
            await self.start()
            
        async with self.lock:
            try:
                payload = json.dumps(request) + "\n"
                self.writer.write(payload.encode('utf-8'))
                await self.writer.drain()
                
                response_bytes = await self.reader.readline()
                if not response_bytes:
                    raise ConnectionError("Connection closed by kernel")
                    
                return json.loads(response_bytes.decode('utf-8'))
            except Exception as e:
                print(f"⚠️ Kernel communication error for user {self.user_id}: {e}. Restarting...", flush=True)
                await self._stop_docker()
                await self._start_docker()
                payload = json.dumps(request) + "\n"
                self.writer.write(payload.encode('utf-8'))
                await self.writer.drain()
                response_bytes = await self.reader.readline()
                return json.loads(response_bytes.decode('utf-8'))
