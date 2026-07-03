from .user_proxy import UserKernelProxy
import asyncio
import time

class UserManager:
    def __init__(self):
        self.users = {}
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
                    # If the kernel is running and inactive for more than 10 minutes (600s), stop it
                    if proxy.process is not None and (now - proxy.last_activity) > 600:
                        print(f"⏰ Idle timeout (10m) for user {user_id}. Stopping kernel.", flush=True)
                        await proxy.stop()
        
        self.cleanup_task = asyncio.create_task(loop())

    async def stop_all_kernels(self):
        print("🛑 Shutting down all user kernels...", flush=True)
        for user_id, proxy in list(self.users.items()):
            await proxy.stop()
        if self.cleanup_task:
            self.cleanup_task.cancel()