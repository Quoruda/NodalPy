from typing import Callable, Any
import threading

class ThreadWithCallback(threading.Thread):
    def __init__(
        self,
        target: Callable[..., Any],
        on_finish: Callable[..., Any],
        target_args: tuple = (),
        on_finish_args: tuple = (),
        **thread_kwargs
    ):
        super().__init__(**thread_kwargs)
        self._target = target
        self.on_finish = on_finish
        self.targetArgs = target_args
        self.onFinishArgs = on_finish_args


    def run(self):
        try:
            if self._target:
                self._target(*self.targetArgs)
        finally:
            if self.on_finish:
                try:
                    self.on_finish(*self.onFinishArgs)
                except Exception as e:
                    print(f"Error on finish: {e}")