import unittest
from app.core.node_registry import NodeRegistry

class TestNodeRegistry(unittest.TestCase):
    def setUp(self):
        self.registry = NodeRegistry()

    def test_case_insensitive_timeout(self):
        self.registry.node_settings["fastnode"] = type("Manager", (), {"get": lambda s, k: 1.0})()
        
        self.assertEqual(self.registry.get_timeout("FastNode"), 1.0)
        self.assertEqual(self.registry.get_timeout("fastNode"), 1.0)
        self.assertEqual(self.registry.get_timeout("FASTNODE"), 1.0)
        self.assertEqual(self.registry.get_timeout("fastnode"), 1.0)

    def test_unknown_node_type(self):
        self.assertIsNone(self.registry.get_timeout("NonExistentNode"))

if __name__ == "__main__":
    unittest.main()
