from app.main import app
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
        class API:
            def save_file(self, content):
                file_types = ('JSON Files (*.json)', 'All files (*.*)')
                file_path = webview.windows[0].create_file_dialog(
                    webview.FileDialog.SAVE, 
                    file_types=file_types, 
                    save_filename='nodalpy_project.json'
                )
                if file_path:
                    # Handle tuple return (common in some pywebview backends like QT)
                    if isinstance(file_path, tuple):
                        file_path = file_path[0]
                    elif isinstance(file_path, list):
                         file_path = file_path[0]

                    if not isinstance(file_path, str):
                        print(f"Error: Invalid file path type: {type(file_path)}")
                        return False

                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(content)
                    return True
                return False

        server_thread = threading.Thread(target=start_server, daemon=True)
        server_thread.start()
        webview.create_window("NodalPy", "http://127.0.0.1:8000", js_api=API())
        webview.start(gui='qt')
    elif args.mode == "local":
        start_server()
    else:  # help
        print("Mode disponible: ")
        print("desktop -> Lance l'application dans une fenêtre.")
        print("local -> Lance l'application en mode serveur accessible via une interface web.")






