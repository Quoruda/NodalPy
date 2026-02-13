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


# --- File Upload Logic ---
import shutil
from fastapi import UploadFile, File, Form

# Ensure storage directory exists
STORAGE_DIR = os.path.abspath(os.path.join(os.getcwd(), "storage"))
if not os.path.exists(STORAGE_DIR):
    os.makedirs(STORAGE_DIR)

@app.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    user_id: str = Form(...),
    node_id: str = Form(...)
):
    # Security: Validate user_id/node_id are safe (alphanumeric/dashes)
    safe_user_id = "".join([c for c in user_id if c.isalnum() or c in "-_"])
    safe_node_id = "".join([c for c in node_id if c.isalnum() or c in "-_"])
    
    if not safe_user_id or not safe_node_id:
        return {"error": "Invalid IDs"}

    user_dir = os.path.join(STORAGE_DIR, safe_user_id)
    if not os.path.exists(user_dir):
        os.makedirs(user_dir)

    # Determine extension
    _, ext = os.path.splitext(file.filename)
    # Filename based on Node ID to avoid clutter and auto-cleanup
    filename = f"{safe_node_id}{ext}"
    file_path = os.path.join(user_dir, filename)

    # Save file
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        print(f"✅ File saved: {file_path}")
        return {
            "filename": file.filename,
            "saved_name": filename,
            "status": "success"
        }
    except Exception as e:
        print(f"❌ Upload failed: {e}")
        return {"error": str(e)}
# -------------------------

@app.get("/{full_path:path}")
async def serve_react_app(full_path: str):
    index_path = os.path.join(frontend_dir, "index.html")
    return FileResponse(index_path)



@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    user_websocket = UserWebSocket(websocket, user_manager)
    await user_websocket.loop()


