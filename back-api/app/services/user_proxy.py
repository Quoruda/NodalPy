import subprocess
import sys
import os
import asyncio
import socket
import time
import json
from ..core.config import STORAGE_DIR

try:
    import docker
except ImportError:
    docker = None

def find_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]

class UserKernelProxy:
    def __init__(self, user_id: str):
        self.user_id = user_id
        self.execution_mode = os.getenv("NODAL_EXECUTION_MODE", "local")
        
        # Paths
        self.local_storage_dir = os.path.join(STORAGE_DIR, user_id)
        
        # Local execution properties
        self.process = None
        self.port = None
        
        # Docker execution properties
        self.container_name = f"nodalpy_kernel_{user_id}"
        self.image_name = os.getenv("NODAL_KERNEL_IMAGE", "nodalpy_server:latest")
        self.network_name = os.getenv("NODAL_DOCKER_NETWORK", "nodalpy_network")
        self.host_storage_path = os.getenv("HOST_STORAGE_PATH", os.path.join(os.getcwd(), "storage"))
        self.user_host_storage_path = os.path.join(self.host_storage_path, user_id)
        self.container = None
        self.docker_client = None

        # Common properties
        self.reader = None
        self.writer = None
        self.last_activity = time.time()
        self.lock = asyncio.Lock()

    async def start(self):
        async with self.lock:
            if self.execution_mode == "docker":
                await self._start_docker()
            else:
                await self._start_local()

    async def _start_local(self):
        if self.process is not None:
            return

        self.port = find_free_port()
        print(f"🔧 Spawning local kernel process for user {self.user_id} on port {self.port}...", flush=True)
        
        self.process = subprocess.Popen(
            [
                sys.executable,
                "-m",
                "kernel.main",
                "--user-id",
                self.user_id,
                "--port",
                str(self.port),
                "--storage-dir",
                self.local_storage_dir
            ]
        )
        
        connected = False
        for _ in range(30):
            if self.process.poll() is not None:
                print(f"❌ Local kernel process died with code {self.process.returncode}.", flush=True)
                self.process = None
                raise RuntimeError(f"Local kernel process died immediately with code {self.process.returncode}")

            try:
                self.reader, self.writer = await asyncio.open_connection('127.0.0.1', self.port)
                connected = True
                break
            except ConnectionRefusedError:
                await asyncio.sleep(0.1)
        
        if not connected:
            self.process.terminate()
            self.process = None
            raise RuntimeError("Failed to connect to spawned local user kernel process")
            
        print(f"✅ Connected to local user kernel {self.user_id}", flush=True)

    async def _start_docker(self):
        if self.container is not None:
            return

        if docker is None:
            raise RuntimeError("Python 'docker' package is not installed. Cannot use docker execution mode.")

        print(f"🐳 Spawning kernel container '{self.container_name}' using image '{self.image_name}'...", flush=True)
        
        try:
            self.docker_client = docker.from_env()
        except Exception as e:
            print(f"❌ Failed to connect to host Docker daemon: {e}", flush=True)
            raise RuntimeError(f"Failed to connect to Docker daemon: {e}")

        # Ensure container folder exists inside /app/storage
        os.makedirs(self.local_storage_dir, exist_ok=True)

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
                    "--port",
                    "8000",
                    "--storage-dir",
                    "/app/storage"
                ],
                name=self.container_name,
                network=self.network_name,
                volumes={
                    self.user_host_storage_path: {
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
            if self.execution_mode == "docker":
                await self._stop_docker()
            else:
                await self._stop_local()

    async def _stop_local(self):
        if self.process is None:
            return
        
        print(f"🛑 Stopping local user kernel {self.user_id}...", flush=True)
        try:
            if self.writer:
                self.writer.write(json.dumps({"action": "shutdown"}).encode('utf-8') + b"\n")
                await self.writer.drain()
        except Exception:
            pass
        
        self.process.terminate()
        try:
            self.process.wait(timeout=2)
        except subprocess.TimeoutExpired:
            self.process.kill()
            
        self.process = None
        self.reader = None
        self.writer = None
        print(f"Local user kernel {self.user_id} stopped.", flush=True)

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
        
        if (self.execution_mode == "docker" and self.container is None) or \
           (self.execution_mode != "docker" and self.process is None):
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
                await self._stop_internal()
                await self._start_internal()
                payload = json.dumps(request) + "\n"
                self.writer.write(payload.encode('utf-8'))
                await self.writer.drain()
                response_bytes = await self.reader.readline()
                return json.loads(response_bytes.decode('utf-8'))

    async def _stop_internal(self):
        if self.execution_mode == "docker":
            await self._stop_docker()
        else:
            await self._stop_local()

    async def _start_internal(self):
        if self.execution_mode == "docker":
            await self._start_docker()
        else:
            await self._start_local()
