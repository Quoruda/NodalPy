from .user_proxy import UserKernelProxy
import asyncio
import time

class UserManager:
    def __init__(self):
        self.users = {}
        self.active_connections = {}
        self.cleanup_task = None

    def get_user(self, user_id) -> UserKernelProxy:
        if user_id not in self.users:
            self.users[user_id] = UserKernelProxy(user_id)
        return self.users[user_id]

    async def start_cleanup_loop(self):
        if self.cleanup_task is not None:
            return
        
        async def loop():
            while True:
                await asyncio.sleep(60)  # Check every minute
                now = time.time()
                for user_id, proxy in list(self.users.items()):
                    # Check if the kernel container is running
                    is_running = proxy.container is not None
                    if is_running and (now - proxy.last_activity) > 600:
                        print(f"⏰ Idle timeout (10m) for user {user_id}. Stopping kernel.", flush=True)
                        await proxy.stop()
        
        self.cleanup_task = asyncio.create_task(loop())

    async def cleanup_orphans(self):
        def do_cleanup():
            import os
            try:
                import docker
                client = docker.from_env()
                containers = client.containers.list(all=True)
                for container in containers:
                    if container.name.startswith("nodalpy_kernel_"):
                        print(f"🧹 Found orphaned kernel container '{container.name}'. Stopping & removing...", flush=True)
                        try:
                            container.stop(timeout=2)
                            container.remove()
                        except Exception:
                            pass
            except Exception as e:
                    print(f"⚠️ Docker connection error during startup cleanup: {e}", flush=True)
        
        await asyncio.to_thread(do_cleanup)

    async def stop_all_kernels(self):
        print("🛑 Shutting down all user kernels...", flush=True)
        for user_id, proxy in list(self.users.items()):
            await proxy.stop()
        if self.cleanup_task:
            self.cleanup_task.cancel()