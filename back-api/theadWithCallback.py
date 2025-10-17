import threading

class ThreadWithCallback(threading.Thread):
    def __init__(self, target=None, on_finish=None, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._target = target
        self._args = kwargs.get('args', ())
        self._kwargs = kwargs.get('kwargs', {})
        self.on_finish = on_finish

    def run(self):
        try:
            if self._target:
                self._target(*self._args, **self._kwargs)
        finally:
            if self.on_finish:
                try:
                    self.on_finish(self)
                except Exception as e:
                    print(f"Error on finish: {e}")

