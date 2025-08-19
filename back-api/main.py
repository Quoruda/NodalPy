from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
import sys
import io
import traceback
from fastapi.middleware.cors import CORSMiddleware
import copy
import asyncio



contexts = {}

app = FastAPI()

# Ajoute ce middleware CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],  # adapte à ton port React
    allow_credentials=True,
    allow_methods=["*"],  # autorise GET, POST, OPTIONS, etc.
    allow_headers=["*"],
)

# Petit wrapper pour capter stdout et envoyer directement via websocket
class WebSocketStdout(io.StringIO):
    def __init__(self, ws: WebSocket, node: str):
        super().__init__()
        self.ws = ws
        self.node = node

    def write(self, s: str):
        if s.strip():  # évite d’envoyer des trucs vides
            asyncio.create_task(self.ws.send_json({
                "node": self.node,
                "output": s
            }))
        return super().write(s)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_json()

            if data.get("action") == "run":
                code = data["code"]
                variables = data["variables"]
                node = data["node"]

                # ✅ Prévenir le front que l’exécution démarre
                await websocket.send_json({"node": node, "status": "running"})

                # Préparer le contexte
                context = {}
                for var in variables:
                    var_context = contexts.get(var["source"], {})
                    value = var_context.get(var["name"], None)
                    value = copy.deepcopy(value)
                    context[var["target"]] = value

                # Rediriger stdout
                real_stdout = sys.stdout
                sys.stdout = WebSocketStdout(websocket, node)

                try:
                    exec(code, context)  # exécution du code
                except Exception:
                    err = traceback.format_exc()
                    await websocket.send_json({"node": node, "output": err})

                # Remettre stdout
                sys.stdout = real_stdout

                # Sauvegarder le contexte pour d’autres nœuds
                contexts[node] = context

                # ✅ Prévenir que l’exécution est terminée
                await websocket.send_json({"node": node, "status": "finished"})

    except WebSocketDisconnect:
        print("❌ Client déconnecté")
    except Exception as e:
        print("⚠️ Erreur WebSocket:", e)