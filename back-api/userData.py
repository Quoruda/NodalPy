import copy
from runFunctions import *

class UserData:
    def __init__(self, identifier: str):
        self.userId = identifier
        self.nodeContexts = {}
        self.is_running_code = False

    def can_run_code(self):
        return not self.is_running_code

    def get_variable(self, node: str, name: str):
        node_context = self.nodeContexts.get(node, {})
        return node_context.get(name, None)

    def run_node(self, node: str, code: str, variables: list[dict], timeout: float = None) -> tuple[str, str]:
        if not self.can_run_code():
            raise RuntimeError("Code is already running")

        new_context = {}

        for var in variables:
            var_context = self.nodeContexts.get(var["source"], {})
            value = var_context.get(var["name"], None)
            value = copy.deepcopy(value)
            new_context[var["target"]] = value


        exec_globals, local_scope = prepare_contexts(new_context)
        
        # Inject STORAGE_DIR and 'os' for portability
        # Use absolute path for robustness. 
        # Assuming storage is at project root / storage / userId
        import os
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        storage_dir = os.path.join(base_dir, "storage", self.userId)
        
        # Ensure directory exists (execution safety)
        os.makedirs(storage_dir, exist_ok=True)
        
        exec_globals['STORAGE_DIR'] = storage_dir
        exec_globals['os'] = os # Expose os module directly
        
        self.nodeContexts[node] = local_scope

        self.is_running_code = True
        
        status = "finished"
        output = ""
        error_msg = ""
        
        try:
            # Pass storage_dir as cwd to allow relative path access (e.g. open("file.txt"))
            run_code_in_thread(code, exec_globals, local_scope, timeout, cwd=storage_dir)
        except TimeoutError:
             status = "timeout"
             error_msg = f"Execution timed out ({timeout}s)"
             print(error_msg)
        except Exception as e:
            status = "error"
            error_msg = str(e)
            print(e)
            
        self.is_running_code = False
        
        if "__stdout__" in local_scope:
            output = local_scope["__stdout__"].getvalue()
            
        return status, output, error_msg


