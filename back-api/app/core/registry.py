class WebSocketRegistry:
    def __init__(self):
        self._handlers = {}

    def register(self, action_name: str):
        def decorator(func):
            self._handlers[action_name] = func
            return func
        return decorator

    def get_handler(self, action_name: str):
        return self._handlers.get(action_name)

ws_registry = WebSocketRegistry()
