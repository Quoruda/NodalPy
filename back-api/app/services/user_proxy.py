import subprocess
import sys
import os
import asyncio
import socket
import time
import json
from ..core.config import STORAGE_DIR

def find_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]

class UserKernelProxy:
    def __init__(self, user_id: str):
        self.user_id = user_id
        self.storage_dir = os.path.join(STORAGE_DIR, user_id)
        self.port = find_free_port()
        self.process = None
        self.reader = None
        self.writer = None
        self.last_activity = time.time()
        self.lock = asyncio.Lock()

    async def start(self):
        async with self.lock:
            if self.process is not None:
                return

            print(f"🔧 Spawning kernel process for user {self.user_id} on port {self.port}...", flush=True)
            
            # Start the kernel subprocess
            # We run python with -m kernel.main
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
                    self.storage_dir
                ]
            )
            
            # Wait for kernel to start up and listen on port (retry connection for 3 seconds)
            connected = False
            for _ in range(30):
                # Check if process died early
                if self.process.poll() is not None:
                    print(f"❌ Kernel process died with code {self.process.returncode}.", flush=True)
                    self.process = None
                    raise RuntimeError(f"Kernel process died immediately with code {self.process.returncode}")

                try:
                    self.reader, self.writer = await asyncio.open_connection('127.0.0.1', self.port)
                    connected = True
                    break
                except ConnectionRefusedError:
                    await asyncio.sleep(0.1)
            
            if not connected:
                self.process.terminate()
                self.process = None
                raise RuntimeError("Failed to connect to spawned user kernel process")
                
            print(f"✅ Connected to user kernel {self.user_id}", flush=True)

    async def stop(self):
        async with self.lock:
            if self.process is None:
                return
            
            print(f"🛑 Stopping user kernel {self.user_id}...", flush=True)
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
            print(f"☠️ User kernel {self.user_id} stopped.", flush=True)

    async def send_request(self, request: dict) -> dict:
        self.last_activity = time.time()
        
        if self.process is None:
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
                await self.stop()
                # Try to restart once and resend
                await self.start()
                payload = json.dumps(request) + "\n"
                self.writer.write(payload.encode('utf-8'))
                await self.writer.drain()
                response_bytes = await self.reader.readline()
                return json.loads(response_bytes.decode('utf-8'))
