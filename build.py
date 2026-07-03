import subprocess
import shutil
import os
import sys

FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "front-editor"))
BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "back-api"))

BUILD_DIR = os.path.join(FRONTEND_DIR, "dist")
TARGET_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "build"))

def run_build():
    print("📦 Launching React build...")
    subprocess.run(["npm", "run", "build"], cwd=FRONTEND_DIR, check=True)

def move_build():
    print(f"📂 Moving {BUILD_DIR} to {TARGET_DIR} ...")

    if os.path.exists(TARGET_DIR):
        shutil.rmtree(TARGET_DIR)

    shutil.move(BUILD_DIR, os.path.join(TARGET_DIR, 'front'))
    print("✅ Build moved successfully!")

def move_backend():
    print(f"📂 Moving backend from {BACKEND_DIR} ...")
    
    exclusions = {
        "__pycache__", 
        ".venv", 
        ".idea",
        "front"
    }

    for item in os.listdir(BACKEND_DIR):
        if item in exclusions:
            continue
            
        src_path = os.path.join(BACKEND_DIR, item)
        dst_path = os.path.join(TARGET_DIR, item)

        if os.path.isfile(src_path):
            shutil.copy(src_path, dst_path)
        elif os.path.isdir(src_path):
            if os.path.exists(dst_path):
                shutil.rmtree(dst_path)
            shutil.copytree(src_path, dst_path)
            
    print("✅ Backend moved successfully!")

if __name__ == "__main__":
    try:
        run_build()
        move_build()
        move_backend()
    except subprocess.CalledProcessError:
        print("❌ Error: build failed.")
        sys.exit(1)
