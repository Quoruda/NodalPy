import threading

import websocket
import json
import time

# URL de ton serveur WebSocket
WS_URL = "ws://localhost:8000/ws"


def on_message(ws, message):
    print("Réponse du serveur :", message)


def on_error(ws, error):
    print("Erreur :", error)


def on_close(ws, close_status_code, close_msg):
    print(f"Connexion fermée ({close_status_code} - {close_msg})")


def on_open(ws):
    print("Connexion ouverte")


# Création de la connexion WebSocket
ws_app = websocket.WebSocketApp(
    WS_URL,
    on_open=on_open,
    on_message=on_message,
    on_error=on_error,
    on_close=on_close
)

wst = threading.Thread(target=ws_app.run_forever, daemon=True)
wst.start()

time.sleep(1)

tests = [
    {"action": "login", "identifier": "test_user"},
    {"action": "ping"},
    {
        "action": "run_node",
        "node": "node1",
        "code": "result = 5 + 7\nprint('Result:', result)",
        "variables": []
    },
    {
        "action": "get_variable",
        "node": "node1",
        "name": "result"
    },
    {
        "action": "run_node",
        "node": "node2",
        "code": "import time\nx = 10\ntime.sleep(10)\nx = 15",
        "variables": []
    },
    {
        "action": "ping",
    }
]

for msg in tests:
    print("➡️ Envoi :", msg)
    ws_app.send(json.dumps(msg))
    time.sleep(1)

input("Appuyez sur Entrée pour fermer la connexion...\n")
ws_app.close()
wst.join()