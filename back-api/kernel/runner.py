import copy
import os
import cloudpickle as pickle
from .execution import prepare_contexts, run_code_in_thread
from .converter import convert_value

class KernelRunner:
    def __init__(self, user_id: str, storage_dir: str):
        self.user_id = user_id
        self.storage_dir = storage_dir
        self.is_running_code = False

    def _get_state_dir(self):
        state_dir = os.path.join(self.storage_dir, ".states")
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
                # Test pickleability
                pickle.dumps(value)
                clean_scope[key] = value
            except Exception as e:
                print(f"Warning: Could not pickle variable '{key}': {e}", flush=True)
                
        try:
            with open(state_file, 'wb') as f:
                pickle.dump(clean_scope, f)
        except Exception as e:
            print(f"Error saving state for node {node_id}: {e}", flush=True)

    def _load_node_state(self, node_id: str) -> dict:
        state_dir = self._get_state_dir()
        state_file = os.path.join(state_dir, f"{node_id}.pkl")
        
        if os.path.exists(state_file):
            try:
                with open(state_file, 'rb') as f:
                    return pickle.load(f)
            except Exception as e:
                print(f"Error loading state for node {node_id}: {e}", flush=True)
        return {}

    def get_variable(self, node: str, name: str):
        node_context = self._load_node_state(node)
        value = node_context.get(name, None)
        return convert_value(value)

    def run_node(self, node: str, code: str, variables: list[dict], timeout: float = None, inputs: list[str] = None) -> tuple[str, str, str]:
        if self.is_running_code:
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
        
        # Ensure user storage directory exists
        os.makedirs(self.storage_dir, exist_ok=True)
        
        exec_globals['STORAGE_DIR'] = self.storage_dir
        exec_globals['os'] = os
        
        self.is_running_code = True
        
        status = "finished"
        output = ""
        error_msg = ""
        
        try:
            run_code_in_thread(code, exec_globals, local_scope, timeout, cwd=self.storage_dir)
        except TimeoutError:
             status = "timeout"
             error_msg = f"Execution timed out ({timeout}s)"
        except Exception as e:
             status = "error"
             error_msg = str(e)
            
        self.is_running_code = False
        self._save_node_state(node, local_scope)
        
        if "__stdout__" in local_scope:
            output = local_scope["__stdout__"].getvalue()
            
        return status, output, error_msg
