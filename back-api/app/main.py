import os
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from .services.user_manager import UserManager
from .api.websocket import UserWebSocket
from .core.config import STORAGE_DIR, FRONTEND_DIR
from .core.database import engine, Base
from .auth.routes import router as auth_router
import logging
from loguru import logger

class InterceptHandler(logging.Handler):
    def emit(self, record):
        try:
            level = logger.level(record.levelname).name
        except ValueError:
            level = record.levelno

        frame, depth = logging.currentframe(), 2
        while frame.f_code.co_filename == logging.__file__:
            frame = frame.f_back
            depth += 1

        logger.opt(depth=depth, exception=record.exc_info).log(level, record.getMessage())

logging.basicConfig(handlers=[InterceptHandler()], level=0)
for _log in ['uvicorn', 'uvicorn.error', 'uvicorn.access', 'fastapi']:
    _logger = logging.getLogger(_log)
    _logger.handlers = [InterceptHandler()]
    _logger.propagate = False

user_manager = UserManager()
app = FastAPI()

app.include_router(auth_router)

@app.on_event("startup")
async def startup_event():
    Base.metadata.create_all(bind=engine)
    await user_manager.cleanup_orphans()
    await user_manager.start_cleanup_loop()

@app.on_event("shutdown")
async def shutdown_event():
    await user_manager.stop_all_kernels()

app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIR, "assets")), name="assets")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/{full_path:path}")
async def serve_react_app(full_path: str):
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    return FileResponse(index_path)

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    user_websocket = UserWebSocket(websocket, user_manager)
    await user_websocket.loop()
