import copy
import sys
from io import StringIO
from runFunctions import *



class UserData:
    def __init__(self, userId: str):
        self.userId = userId
        self.nodeContexts = {}
        self.thread = None

    def can_run_code(self):
        return self.thread is None or not self.thread.is_alive()

    def run_node(self, node: str, code: str, variables: list[dict]):
        if not self.can_run_code():
            raise RuntimeError("Code is already running")

        new_context = {}

        for var in variables:
            var_context = self.nodeContexts.get(var["source"], {})
            value = var_context.get(var["name"], None)
            value = copy.deepcopy(value)
            new_context[var["target"]] = value


        exec_globals, local_scope = prepare_contexts(new_context)
        self.nodeContexts[node] = local_scope

        self.thread = run_code_in_thread(code, exec_globals, local_scope)
        self.thread.join()

        return local_scope["__stdout__"].getvalue() if "__stdout__" in local_scope else ""


