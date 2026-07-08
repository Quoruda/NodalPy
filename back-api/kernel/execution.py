import os
import sys
from io import StringIO
from multiprocessing import Process, Queue
import queue
import time
import cloudpickle as pickle

def child_target(code: str, initial_context: dict, cwd: str, q: Queue):
    if cwd:
        storage_dir = os.path.dirname(cwd)
        venv_site_packages = os.path.join(
            storage_dir,
            ".venv",
            "lib",
            f"python{sys.version_info.major}.{sys.version_info.minor}",
            "site-packages"
        )
        if os.path.exists(venv_site_packages):
            sys.path.insert(0, venv_site_packages)
        try:
            os.chdir(cwd)
        except Exception as e:
            q.put({
                "status": "error",
                "stdout": "",
                "error": f"Failed to change directory to {cwd}: {str(e)}",
                "serialized_scope": pickle.dumps({})
            })
            return

    # Prepare stdout/stderr redirection
    stdout_buffer = StringIO()
    stderr_buffer = stdout_buffer

    def custom_print(*args, **kwargs):
        file = kwargs.get('file', stdout_buffer)
        if file == sys.stderr:
            kwargs['file'] = stderr_buffer
        elif file == sys.stdout or 'file' not in kwargs:
            kwargs['file'] = stdout_buffer
        print(*args, **kwargs)

    exec_globals = {
        'print': custom_print,
        'sys': type('sys', (), {
            'stdout': stdout_buffer,
            'stderr': stderr_buffer,
            '__dict__': sys.__dict__,
            '__name__': 'sys'
        })(),
        '__builtins__': __builtins__,
        'STORAGE_DIR': cwd,
        'os': os
    }

    # Populate local scope with initial context (upstream variables)
    local_scope = {}
    for k, v in initial_context.items():
        local_scope[k] = v

    status = "finished"
    error_val = ""

    try:
        exec(code, exec_globals, local_scope)
    except Exception as e:
        status = "error"
        error_val = str(e)

    stdout_val = stdout_buffer.getvalue()

    # Filter out non-pickleable variables and system names
    clean_scope = {}
    for key, value in local_scope.items():
        if key.startswith("__"):
            continue
        try:
            pickle.dumps(value)
            clean_scope[key] = value
        except Exception:
            pass

    try:
        serialized_scope = pickle.dumps(clean_scope)
    except Exception as e:
        serialized_scope = pickle.dumps({})
        status = "error"
        error_val = f"Failed to serialize execution context: {str(e)}"

    q.put({
        "status": status,
        "stdout": stdout_val,
        "error": error_val,
        "serialized_scope": serialized_scope
    })

def run_code_in_process(code: str, initial_context: dict, timeout: float = None, cwd: str = None) -> dict:
    q = Queue()
    p = Process(target=child_target, args=(code, initial_context, cwd, q))
    p.start()

    start_time = time.time()
    result = None

    while True:
        try:
            # Poll the queue with a short timeout to remain responsive
            result = q.get(timeout=0.1)
            break
        except queue.Empty:
            # Check if process died unexpectedly
            if not p.is_alive():
                try:
                    result = q.get_nowait()
                except queue.Empty:
                    exit_code = p.exitcode
                    return {
                        "status": "error",
                        "stdout": "",
                        "error": f"Execution process crashed/exited unexpectedly with code {exit_code}.",
                        "local_scope": {}
                    }
                break

            # Enforce timeout if specified
            if timeout and (time.time() - start_time) > timeout:
                p.terminate()
                p.join(timeout=1)
                if p.is_alive():
                    p.kill()
                    p.join()
                raise TimeoutError(f"Execution timed out after {timeout}s")

    # Wait for the child process to exit cleanly
    p.join(timeout=1)
    if p.is_alive():
        p.kill()
        p.join()

    # Deserialize the scope in the parent process
    local_scope = {}
    if "serialized_scope" in result:
        try:
            local_scope = pickle.loads(result["serialized_scope"])
        except Exception as e:
            result["status"] = "error"
            result["error"] = f"Failed to deserialize execution context on host: {str(e)}"

    return {
        "status": result["status"],
        "stdout": result.get("stdout", ""),
        "error": result.get("error", ""),
        "local_scope": local_scope
    }
