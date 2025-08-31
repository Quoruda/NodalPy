import asyncio
import copy
import sys
import traceback

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

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


class ThreadStdout:
    """
    Objet stdout utilisé DANS LE THREAD.
    Bufferise jusqu'à newline et poste des messages threadsafe dans la queue via loop.call_soon_threadsafe.
    """
    def __init__(self, loop: asyncio.AbstractEventLoop, queue: asyncio.Queue, node: str):
        self.loop = loop
        self.queue = queue
        self.node = node
        self._buffer = ""

    def write(self, data):
        if not data:
            return
        s = str(data)
        self._buffer += s
        while "\n" in self._buffer:
            line, self._buffer = self._buffer.split("\n", 1)
            payload = {"type": "stdout", "node": self.node, "text": line + "\n"}
            # threadsafe post to asyncio queue
            self.loop.call_soon_threadsafe(self.queue.put_nowait, payload)

    def flush(self):
        if self._buffer:
            payload = {"type": "stdout", "node": self.node, "text": self._buffer}
            self.loop.call_soon_threadsafe(self.queue.put_nowait, payload)
            self._buffer = ""


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
                # envoi immédiat du stdout
                try:
                    await websocket.send_json({"node": node, "output": payload.get("text", "")})
                except WebSocketDisconnect:
                    # si le client est déconnecté, on arrête la forward loop proprement
                    queue.task_done()
                    break
            elif ptype == "error":
                try:
                    await websocket.send_json({"node": node, "output": payload.get("text", "")})
                except WebSocketDisconnect:
                    queue.task_done()
                    break
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
# Fonction exécutée DANS LE THREAD
# -------------------------
def run_user_code_in_thread(code: str, imports_context: dict, node: str, loop: asyncio.AbstractEventLoop, queue: asyncio.Queue):
    """
Exécutée dans un thread. Prépare un local_scope, redirige stdout/stderr vers ThreadStdout,
exécute le code, poste le contexte final (deepcopied) dans la queue.
    """
    local_scope = {}
    # injecte les imports (déjà deepcopied avant d'appeler cette fonction)
    local_scope.update(imports_context)

    old_stdout = sys.stdout
    old_stderr = sys.stderr
    try:
        thread_stdout = ThreadStdout(loop, queue, node)
        sys.stdout = thread_stdout
        sys.stderr = thread_stdout

        # Exécuter avec un globals minimal mais avec builtins
        exec_globals = {"__builtins__": __builtins__}
        exec(code, exec_globals, local_scope)

        # flush final pour envoyer tout ce qui reste dans le buffer
        thread_stdout.flush()

        # Poster le contexte final (deepcopy pour éviter aliasing)
        loop.call_soon_threadsafe(queue.put_nowait, {
            "type": "context",
            "node": node,
            "context": local_scope,
        })
    except Exception:
        err = traceback.format_exc()
        # poster l'erreur comme stdout/error pour que le client la reçoive immédiatement
        loop.call_soon_threadsafe(queue.put_nowait, {"type": "error", "node": node, "text": err})
        # Poster quand même le contexte (même si incomplet) pour garder cohérence
        loop.call_soon_threadsafe(queue.put_nowait, {
            "type": "context",
            "node": node,
            "context": local_scope,
        })
    finally:
        # restore
        sys.stdout = old_stdout
        sys.stderr = old_stderr
        # marque la fin d'exécution pour la forward task
        loop.call_soon_threadsafe(queue.put_nowait, {"type": "status", "node": node, "status": "thread_finished"})

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
                code = data["code"]
                variables = data["variables"]
                node = data["node"]

                # Prévenir le front que l’exécution démarre
                await websocket.send_json({"node": node, "status": "running"})

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

                # Prévenir que l’exécution est terminée
                await websocket.send_json({"node": node, "status": "finished"})

    except WebSocketDisconnect:
        print("❌ Client déconnecté")
    except Exception as e:
        print("⚠️ Erreur WebSocket:", e)
