import sys
from threadStdout import ThreadStdout
import asyncio
import traceback


def run_user_code_in_thread(code: str, imports_context: dict, node: str, loop: asyncio.AbstractEventLoop, queue: asyncio.Queue):
    """
Exécutée dans un thread. Prépare un local_scope, redirige stdout/stderr vers ThreadStdout,
exécute le code, poste le contexte final (deepcopied) dans la queue avec __output__.
    """
    local_scope = {}
    # injecte les imports (déjà deepcopied avant d'appeler cette fonction)
    local_scope.update(imports_context)

    # Buffer partagé pour capturer tout l'output
    output_buffer = []

    old_stdout = sys.stdout
    old_stderr = sys.stderr
    try:
        thread_stdout = ThreadStdout(loop, queue, node, output_buffer)
        thread_stderr = ThreadStdout(loop, queue, node, output_buffer)
        sys.stdout = thread_stdout
        sys.stderr = thread_stderr

        # Exécuter avec un globals minimal mais avec builtins
        exec_globals = {"__builtins__": __builtins__}
        exec(code, exec_globals, local_scope)

        # flush final pour envoyer tout ce qui reste dans le buffer
        thread_stdout.flush()
        thread_stderr.flush()

        # Ajouter __output__ au contexte local
        local_scope["__output__"] = "".join(output_buffer)

        # Poster le contexte final (deepcopy pour éviter aliasing)
        loop.call_soon_threadsafe(queue.put_nowait, {
            "type": "context",
            "node": node,
            "context": local_scope,
        })
    except Exception:
        err = traceback.format_exc()
        # Ajouter l'erreur à l'output buffer aussi
        output_buffer.append(err)

        # poster l'erreur comme stdout/error pour que le client la reçoive immédiatement
        loop.call_soon_threadsafe(queue.put_nowait, {"type": "error", "node": node, "text": err})

        # Ajouter __output__ au contexte même en cas d'erreur
        local_scope["__output__"] = "".join(output_buffer)

        # Poster quand même le contexte (même si incomplet) pour garder cohérence
        loop.call_soon_threadsafe(queue.put_nowait, {
            "type": "context",
            "node": node,
            "context": local_scope,
        })
    finally:
        # restore
        sys.stdout = old_stdout
        sys.stderr = old_stderr
        # marque la fin d'exécution pour la forward task
        loop.call_soon_threadsafe(queue.put_nowait, {"type": "status", "node": node, "status": "thread_finished"})
