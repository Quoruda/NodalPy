import asyncio


class ThreadStdout:
    """
    Objet stdout utilisé DANS LE THREAD.
    Bufferise jusqu'à newline et poste des messages threadsafe dans la queue via loop.call_soon_threadsafe.
Capture aussi tout le contenu dans un buffer pour __output__.
    """
    def __init__(self, loop: asyncio.AbstractEventLoop, queue: asyncio.Queue, node: str, output_buffer: list):
        self.loop = loop
        self.queue = queue
        self.node = node
        self.output_buffer = output_buffer  # référence partagée pour capturer tout l'output
        self._buffer = ""

    def write(self, data):
        if not data:
            return
        s = str(data)
        self._buffer += s

        # Ajouter à l'output_buffer pour __output__
        self.output_buffer.append(s)

        while "\n" in self._buffer:
            line, self._buffer = self._buffer.split("\n", 1)
            payload = {"type": "stdout", "node": self.node, "text": line + "\n"}
            # threadsafe post to asyncio queue
            self.loop.call_soon_threadsafe(self.queue.put_nowait, payload)

    def flush(self):
        if self._buffer:
            payload = {"type": "stdout", "node": self.node, "text": self._buffer}
            self.loop.call_soon_threadsafe(self.queue.put_nowait, payload)
            self._buffer = ""