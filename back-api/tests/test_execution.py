import os
import tempfile
import unittest
from kernel.execution import run_code_in_process

class TestExecution(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()

    def test_read_only_user_code_write_attempt(self):
        code = """with open('test_output.txt', 'w') as f:
    f.write('hello world')
"""
        result = run_code_in_process(code=code, initial_context={}, timeout=5.0, cwd=self.temp_dir)
        self.assertEqual(result["status"], "error")
        self.assertTrue("OSError" in result["error"] or "File too large" in result["error"] or "exceeded" in result["error"] or "Errno 27" in result["error"])

    def test_standard_math_code_execution(self):
        code = """a = 10
b = 20
result = a + b
"""
        result = run_code_in_process(code=code, initial_context={}, timeout=5.0, cwd=self.temp_dir)
        self.assertEqual(result["status"], "finished")
        self.assertEqual(result["local_scope"].get("result"), 30)

if __name__ == "__main__":
    unittest.main()
