import threading
from io import StringIO
import sys

def _run_code(code: str, global_context: dict, local_context: dict):
    exec(code, global_context, local_context)

def run_code_in_thread(code: str, global_context: dict, local_context: dict, timeout: float = None):
    # Create a mutable object to store exception from thread
    result_container = {"error": None}
    
    def target():
        try:
            _run_code(code, global_context, local_context)
        except Exception as e:
            result_container["error"] = e

    thread = threading.Thread(target=target, daemon=True)
    thread.start()
    
    if timeout:
        thread.join(timeout)
        if thread.is_alive():
             # We cannot really kill the thread in Python easily without ctypes or subprocess
             # For now, we just stop waiting and raise TimeoutError
             # The thread will continue in background (potentially bad for infinite loops)
             # Ideally we should use multiprocessing for true isolation and killing
             raise TimeoutError(f"Execution timed out after {timeout}s")
    else:
        thread.join()
        
    if result_container["error"]:
        raise result_container["error"]

    return thread

def observe_variable(local_context: dict, var_name: str ):
    value = local_context.get(var_name, None)
    return value

def prepare_contexts(local_scope=None) -> tuple[dict, dict]:
    if local_scope is None:
        local_scope = {}
    stdout_buffer = StringIO()
    stderr_buffer = stdout_buffer

    # Custom print function for capturing output
    def custom_print(*args, **kwargs):
        # Redirect to appropriate buffer
        file = kwargs.get('file', stdout_buffer)
        if file == sys.stderr:
            kwargs['file'] = stderr_buffer
        elif file == sys.stdout or 'file' not in kwargs:
            kwargs['file'] = stdout_buffer
        print(*args, **kwargs)

    # Prepare the exec environment
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