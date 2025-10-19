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

        self.is_running_code = True
        try:
            exec(code, exec_globals, local_scope)
        except Exception as e:
            print(e)
            pass
        self.is_running_code = False


        print(local_scope)
        return local_scope["__stdout__"].getvalue() if "__stdout__" in local_scope else ""


