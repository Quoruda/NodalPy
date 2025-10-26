import os
from fastapi import FastAPI, WebSocket

from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from user_manager import UserManager
from user_websocket import UserWebSocket


user_manager = UserManager()

app = FastAPI()
frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "front"))
app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dir, "assets")), name="assets")

# Ajoute ce middleware CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],  # adapte à ton port React
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/{full_path:path}")
async def serve_react_app(full_path: str):
    index_path = os.path.join(frontend_dir, "index.html")
    return FileResponse(index_path)



@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    user_websocket = UserWebSocket(websocket, user_manager)
    await user_websocket.loop()


