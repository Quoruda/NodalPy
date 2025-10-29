from server import *
import uvicorn
import threading
import webview
import argparse


if __name__ == "__main__":
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
        webview.create_window("NodalPy", "http://127.0.0.1:8000")
        webview.start(gui='qt')
    elif args.mode == "local":
        start_server()
    elif args.mode == "help":
        print("Mode disponible: ")
        print("desktop -> Lance l'application dans une fenêtre.")
        print("local -> Lance l'application en mode serveur accessible via une interface web.")






