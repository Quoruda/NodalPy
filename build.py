import subprocess
import shutil
import os
import sys

# --- Config ---
FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "front-editor"))  # dossier React
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "back-api"))  # dossier React

BUILD_DIR = os.path.join(FRONTEND_DIR, "dist")  # dossier généré par CRA
TARGET_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "build"))

def run_build():
    print("📦 Lancement du build React...")
    subprocess.run(["npm", "run", "build"], cwd=FRONTEND_DIR, check=True)

def move_build():
    print(f"📂 Déplacement de {BUILD_DIR} vers {TARGET_DIR} ...")

    # Supprimer l’ancien build s’il existe
    if os.path.exists(TARGET_DIR):
        shutil.rmtree(TARGET_DIR)

    shutil.move(BUILD_DIR, os.path.join(TARGET_DIR, 'front'))
    print("✅ Build déplacé avec succès !")


def move_backend():
    print(f"📂 Déplacement du backend depuis {BACKEND_DIR} ...")
    
    # Liste des dossiers/fichiers à exclure
    exclusions = {
        "__pycache__", 
        ".venv", 
        ".idea",
        "front"  # Le dossier front est géré par move_build
    }

    for item in os.listdir(BACKEND_DIR):
        if item in exclusions:
            continue
            
        src_path = os.path.join(BACKEND_DIR, item)
        dst_path = os.path.join(TARGET_DIR, item)

        if os.path.isfile(src_path):
            shutil.copy(src_path, dst_path)
        elif os.path.isdir(src_path):
             # On copie recursivement les dossiers qui ne sont pas exclus
            if os.path.exists(dst_path):
                shutil.rmtree(dst_path)
            shutil.copytree(src_path, dst_path)
            
    print("✅ Backend déplacé avec succès !")

if __name__ == "__main__":
    try:
        run_build()
        move_build()
        move_backend()
    except subprocess.CalledProcessError:
        print("❌ Erreur : le build a échoué.")
        sys.exit(1)
