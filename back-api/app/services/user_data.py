import copy
import os
import cloudpickle as pickle
import types
from .execution import *
from ..core.config import STORAGE_DIR

class UserData:
    def __init__(self, identifier: str):
        self.userId = identifier
        self.is_running_code = False

    def _get_state_dir(self):
        state_dir = os.path.join(STORAGE_DIR, self.userId, ".states")
        os.makedirs(state_dir, exist_ok=True)
        return state_dir

    def _save_node_state(self, node_id: str, local_scope: dict):
        state_dir = self._get_state_dir()
        state_file = os.path.join(state_dir, f"{node_id}.pkl")
        
        clean_scope = {}
        for key, value in local_scope.items():
            if key.startswith("__"):
                continue
            
            try:
                # Test pickleability to avoid crashing the whole dump
                pickle.dumps(value)
                clean_scope[key] = value
            except Exception as e:
                print(f"Warning: Could not pickle variable '{key}': {e}")
                
        try:
            with open(state_file, 'wb') as f:
                pickle.dump(clean_scope, f)
        except Exception as e:
            print(f"Error saving state for node {node_id}: {e}")

    def _load_node_state(self, node_id: str) -> dict:
        state_dir = self._get_state_dir()
        state_file = os.path.join(state_dir, f"{node_id}.pkl")
        
        if os.path.exists(state_file):
            try:
                with open(state_file, 'rb') as f:
                    return pickle.load(f)
            except Exception as e:
                print(f"Error loading state for node {node_id}: {e}")
        return {}

    def can_run_code(self):
        return not self.is_running_code

    def get_variable(self, node: str, name: str):
        node_context = self._load_node_state(node)
        return node_context.get(name, None)

    def run_node(self, node: str, code: str, variables: list[dict], timeout: float = None, inputs: list[str] = None) -> tuple[str, str]:
        if not self.can_run_code():
            raise RuntimeError("Code is already running")

        new_context = {}

        for var in variables:
            var_context = self._load_node_state(var["source"])
            value = var_context.get(var["name"], None)
            value = copy.deepcopy(value)
            new_context[var["target"]] = value

        if inputs:
            for input_name in inputs:
                if input_name not in new_context:
                    new_context[input_name] = None


        exec_globals, local_scope = prepare_contexts(new_context)
        
        # Inject STORAGE_DIR and 'os' for portability
        # Use absolute path for robustness. 
        
        # Ensure directory exists (execution safety)
        user_storage_dir = os.path.join(STORAGE_DIR, self.userId)
        os.makedirs(user_storage_dir, exist_ok=True)
        
        exec_globals['STORAGE_DIR'] = user_storage_dir
        exec_globals['os'] = os # Expose os module directly
        
        self.is_running_code = True
        
        status = "finished"
        output = ""
        error_msg = ""
        
        try:
            # Pass storage_dir as cwd to allow relative path access (e.g. open("file.txt"))
            run_code_in_thread(code, exec_globals, local_scope, timeout, cwd=user_storage_dir)
        except TimeoutError:
             status = "timeout"
             error_msg = f"Execution timed out ({timeout}s)"
             print(error_msg)
        except Exception as e:
            status = "error"
            error_msg = str(e)
            print(e)
            
        self.is_running_code = False
        
        self._save_node_state(node, local_scope)
        
        if "__stdout__" in local_scope:
            output = local_scope["__stdout__"].getvalue()
            
        return status, output, error_msg


