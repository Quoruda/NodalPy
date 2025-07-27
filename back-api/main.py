from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import sys
import io
import traceback
from fastapi.middleware.cors import CORSMiddleware
import copy

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

class CodeRequest(BaseModel):
    code: str
    variables: list
    node: str

@app.post("/run")
async def run_code(request: CodeRequest):
    try:
        stdout = io.StringIO()
        sys.stdout = stdout

        context = {}

        for var in request.variables:
            print(var)
            var_context = contexts.get(var["source"], {})
            value = var_context.get(var["name"], None)
            value = copy.deepcopy(value)
            context[var["target"]] = value

        # Execution en "sandbox"
        try:
            exec(request.code, context)
        except:
            print(traceback.format_exc())

        # Remet stdout
        sys.stdout = sys.__stdout__

        contexts[request.node] = context

        return {"output": stdout.getvalue()}
    except Exception:
        sys.stdout = sys.__stdout__
        return {"error": traceback.format_exc()}
