import copy
import os
import cloudpickle as pickle
from .execution import run_code_in_process
from .converter import convert_value
from loguru import logger

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
                logger.warning(f"Could not pickle variable '{key}': {e}")
                
        try:
            with open(state_file, 'wb') as f:
                pickle.dump(clean_scope, f)
        except Exception as e:
            logger.error(f"Error saving state for node {node_id}: {e}")

    def _load_node_state(self, node_id: str) -> dict:
        state_dir = self._get_state_dir()
        state_file = os.path.join(state_dir, f"{node_id}.pkl")
        
        if os.path.exists(state_file):
            try:
                with open(state_file, 'rb') as f:
                    return pickle.load(f)
            except Exception as e:
                logger.error(f"Error loading state for node {node_id}: {e}")
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

        # Ensure user storage directory exists
        os.makedirs(self.storage_dir, exist_ok=True)
        
        self.is_running_code = True
        
        status = "finished"
        output = ""
        error_msg = ""
        local_scope = {}
        
        try:
            result = run_code_in_process(code, new_context, timeout, cwd=os.path.join(self.storage_dir, 'files'))
            status = result["status"]
            output = result.get("stdout", "")
            error_msg = result.get("error", "")
            local_scope = result.get("local_scope", {})
        except TimeoutError as e:
            status = "timeout"
            error_msg = str(e)
        except Exception as e:
            status = "error"
            error_msg = str(e)
            
        self.is_running_code = False
        self._save_node_state(node, local_scope)
            
        return status, output, error_msg
