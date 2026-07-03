import threading
import os
from io import StringIO
import sys

# Global lock to prevent race conditions when changing CWD
EXECUTION_LOCK = threading.Lock()

def _run_code(code: str, global_context: dict, local_context: dict):
    exec(code, global_context, local_context)

def run_code_in_thread(code: str, global_context: dict, local_context: dict, timeout: float = None, cwd: str = None):
    result_container = {"error": None}
    
    def target():
        if cwd:
            with EXECUTION_LOCK:
                original_cwd = os.getcwd()
                try:
                    os.chdir(cwd)
                    _run_code(code, global_context, local_context)
                except Exception as e:
                    result_container["error"] = e
                finally:
                    os.chdir(original_cwd)
        else:
            try:
                _run_code(code, global_context, local_context)
            except Exception as e:
                result_container["error"] = e

    thread = threading.Thread(target=target, daemon=True)
    thread.start()
    
    if timeout:
        thread.join(timeout)
        if thread.is_alive():
             raise TimeoutError(f"Execution timed out after {timeout}s")
    else:
        thread.join()
        
    if result_container["error"]:
        raise result_container["error"]

    return thread

def prepare_contexts(local_scope=None) -> tuple[dict, dict]:
    if local_scope is None:
        local_scope = {}
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
        '__builtins__': __builtins__
    }
    local_scope.update({
        '__stdout__': stdout_buffer,
        '__stderr__': stderr_buffer,
    })
    return exec_globals, local_scope
