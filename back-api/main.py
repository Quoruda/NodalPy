# library
import asyncio
import copy
import threading
import traceback
import os
import webview
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import uvicorn
import argparse


#files
from threadStdout import ThreadStdout
from threadTask import run_user_code_in_thread

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

# Stockage des contexts par node (la boucle d'événements sera la seule à écrire dedans)
contexts = {}

# -------------------------
# Stdout utilisé DANS LE THREAD
# -------------------------
def isatty():
    return False

# -------------------------
# Task asynchrone pour forwarder la queue -> websocket et mettre à jour contexts
# -------------------------
async def forward_queue_to_ws(queue: asyncio.Queue, websocket: WebSocket, node: str):
    """
Lis la queue et envoie chaque message au websocket.
Traite aussi les payloads 'context' pour mettre à jour contexts (opération mono-threadée).
S'arrête quand il reçoit un payload {"type":"status","status":"thread_finished"}.
    """
    try:
        while True:
            payload = await queue.get()
            if payload is None:
                queue.task_done()
                break

            ptype = payload.get("type")
            if ptype == "stdout":
                print(payload.get("text", ""))
            elif ptype == "error":
                print(payload.get("text", ""))
            elif ptype == "context":
                # Seule la boucle d'événements écrit dans contexts => safe
                contexts[payload["node"]] = payload.get("context", {})
            elif ptype == "status" and payload.get("status") == "thread_finished":
                # fin nette de l'exécution
                queue.task_done()
                break

            queue.task_done()
    except asyncio.CancelledError:
        # tâche annulée, on sort proprement
        pass
    except Exception:
        traceback.print_exc()


# -------------------------
# Endpoint WebSocket (adaptation de ton original)
# -------------------------
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_json()

            if data.get("action") == "run":
                print(data)
                code = data["code"]
                variables = data["variables"]
                node = data["node"]

                # Prévenir le front que l'exécution démarre
                await websocket.send_json({"action": "run","node": node, "status": "running"})

                # Préparer les imports (deepcopy)
                imports_context = {}
                for var in variables:
                    var_context = contexts.get(var["source"], {})
                    value = var_context.get(var["name"], None)
                    value = copy.deepcopy(value)
                    imports_context[var["target"]] = value

                # création d'une queue asyncio pour ce run
                loop = asyncio.get_running_loop()
                queue: asyncio.Queue = asyncio.Queue()

                # démarrer la task qui forwarde la queue -> websocket et met à jour contexts
                forward_task = asyncio.create_task(forward_queue_to_ws(queue, websocket, node))

                # exécuter le code dans un thread pour ne pas bloquer l'event loop
                thread_task = asyncio.to_thread(run_user_code_in_thread, code, imports_context, node, loop, queue)

                # attendre la fin du thread (run_user_code_in_thread poste un message "thread_finished")
                await thread_task

                # attendre que la forward task termine après avoir vu le marqueur "thread_finished"
                try:
                    await forward_task
                except asyncio.CancelledError:
                    # si on annule la tâche pour une raison X, on ignore
                    pass

                # contexts a été mis à jour par forward_queue_to_ws via le payload "context"



                # Prévenir que l'exécution est terminée
                await websocket.send_json({"action": "run",  "node": node, "status": "finished"})

    except WebSocketDisconnect:
        print("❌ Client déconnecté")
    except Exception as e:
        print("⚠️ Erreur WebSocket:", e)


# Catch-all: retourner index.html pour React Router
@app.get("/{full_path:path}")
async def serve_react_app(full_path: str):
    index_path = os.path.join(frontend_dir, "index.html")
    return FileResponse(index_path)

def main():
    def start_server():
        uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")

    parser = argparse.ArgumentParser(
        description="Lancer l'application React + Python",
        formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument(
        "mode",
        choices=["desktop", "local", "help"],
        nargs="?",
        default="help",
    )

    args = parser.parse_args()

    if args.mode == "desktop":
        server_thread = threading.Thread(target=start_server, daemon=True)
        server_thread.start()
        webview.create_window("NodalPy", "http://127.0.0.1:8000")
        webview.start(gui='qt')
    elif args.mode == "local":
        start_server()
    elif args.mode == "help":
        print("Mode disponible: ")
        print("desktop -> Lance l'application dans une fenêtre.")
        print("local -> Lance l'application en mode serveur accessible via une interface web.")

if __name__ == "__main__":
    main()