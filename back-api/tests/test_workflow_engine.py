import unittest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

# Provide mock for loguru if not installed in current environment
import sys
if "loguru" not in sys.modules:
    mock_loguru = MagicMock()
    sys.modules["loguru"] = mock_loguru

from app.services.workflow_engine import WorkflowEngine, has_node_state, get_user_states_dir

class TestWorkflowEngine(unittest.TestCase):
    def setUp(self):
        self.engine = WorkflowEngine()

    def test_build_variables_normal_matching(self):
        nodes = [
            {
                "id": "node_a",
                "type": "CustomNode",
                "data": {
                    "outputs": [{"id": "out_handle_1", "name": "result"}]
                }
            },
            {
                "id": "node_b",
                "type": "CustomNode",
                "data": {
                    "inputs": [{"id": "in_handle_1", "name": "input_val"}]
                }
            }
        ]
        edges = [
            {
                "source": "node_a",
                "sourceHandle": "out_handle_1",
                "target": "node_b",
                "targetHandle": "in_handle_1"
            }
        ]

        variables = self.engine.build_variables(nodes[1], edges, nodes)
        self.assertEqual(len(variables), 1)
        self.assertEqual(variables[0], {
            "source": "node_a",
            "name": "result",
            "target": "input_val"
        })

    def test_build_variables_single_output_fallback(self):
        nodes = [
            {
                "id": "node_a",
                "type": "CustomNode",
                "data": {
                    "outputs": [{"id": "out_single", "name": "out1"}]
                }
            },
            {
                "id": "node_b",
                "type": "CustomNode",
                "data": {
                    "inputs": [{"id": "in_1", "name": "x"}]
                }
            }
        ]
        edges = [
            {
                "source": "node_a",
                "sourceHandle": "different_handle",
                "target": "node_b",
                "targetHandle": "in_1"
            }
        ]

        variables = self.engine.build_variables(nodes[1], edges, nodes)
        self.assertEqual(len(variables), 1)
        self.assertEqual(variables[0]["name"], "out1")
        self.assertEqual(variables[0]["target"], "x")

    def test_build_variables_with_string_inputs(self):
        nodes = [
            {
                "id": "node_a",
                "type": "CustomNode",
                "data": {
                    "outputs": ["out1"]
                }
            },
            {
                "id": "node_b",
                "type": "CustomNode",
                "data": {
                    "inputs": ["in1"]
                }
            }
        ]
        edges = [
            {
                "source": "node_a",
                "target": "node_b"
            }
        ]

        variables = self.engine.build_variables(nodes[1], edges, nodes)
        self.assertEqual(len(variables), 1)
        self.assertEqual(variables[0]["name"], "out1")
        self.assertEqual(variables[0]["target"], "in1")

    def test_build_variables_trigger_node_fallback(self):
        nodes = [
            {
                "id": "timer_1",
                "type": "TimerNode",
                "data": {
                    "isTrigger": True
                }
            },
            {
                "id": "node_b",
                "type": "CustomNode",
                "data": {
                    "inputs": [{"id": "in_trigger", "name": "trig_data"}]
                }
            }
        ]
        edges = [
            {
                "source": "timer_1",
                "sourceHandle": None,
                "target": "node_b",
                "targetHandle": "in_trigger"
            }
        ]

        variables = self.engine.build_variables(nodes[1], edges, nodes)
        self.assertEqual(len(variables), 1)
        self.assertEqual(variables[0]["name"], "output")
        self.assertEqual(variables[0]["target"], "trig_data")

    def test_shadow_node_code_resolution(self):
        nodes = [
            {
                "id": "master_node",
                "data": {"code": "print('master code')"}
            },
            {
                "id": "shadow_node",
                "data": {"masterId": "master_node", "code": "ignored"}
            },
            {
                "id": "normal_node",
                "data": {"code": "print('normal')"}
            }
        ]

        self.assertEqual(self.engine._get_node_code(nodes[1], nodes), "print('master code')")
        self.assertEqual(self.engine._get_node_code(nodes[2], nodes), "print('normal')")

    def test_auto_trigger_detection(self):
        fast_node = {"type": "FastNode", "data": {}}
        manual_node = {"type": "ManualNode", "data": {}}
        explicit_manual = {"type": "ManualNode", "data": {"autoTrigger": True}}

        self.assertTrue(self.engine._is_node_auto_trigger(fast_node))
        self.assertFalse(self.engine._is_node_auto_trigger(manual_node))
        self.assertTrue(self.engine._is_node_auto_trigger(explicit_manual))

    def test_cycle_protection(self):
        async def run_test():
            project_data = {
                "nodes": [
                    {"id": "node_a", "type": "FastNode", "data": {"code": "pass", "autoTrigger": True}},
                    {"id": "node_b", "type": "FastNode", "data": {"code": "pass", "autoTrigger": True}}
                ],
                "edges": [
                    {"source": "node_a", "target": "node_b"},
                    {"source": "node_b", "target": "node_a"}
                ]
            }

            self.engine.load_project = MagicMock(return_value=project_data)

            mock_user_manager = MagicMock()
            mock_user_proxy = MagicMock()
            mock_user_proxy.tier = "default"
            mock_user_proxy.send_request = AsyncMock(return_value={"status": "finished", "output": "", "error": ""})
            mock_user_manager.get_user.return_value = mock_user_proxy
            mock_user_manager.active_connections = {}

            with patch("app.services.workflow_engine.check_user_quota", return_value=True):
                executed = await self.engine.run_downstream(
                    user_id="user_test",
                    project_id="proj_cycle",
                    source_node_id="node_a",
                    user_manager=mock_user_manager
                )

            self.assertEqual(executed, ["node_b"])
            self.assertEqual(mock_user_proxy.send_request.call_count, 1)

        asyncio.run(run_test())

    def test_diamond_dag_dependency_resolution(self):
        async def run_test():
            # A -> B, A -> C, B -> D, C -> D
            project_data = {
                "nodes": [
                    {"id": "A", "type": "TimerNode", "data": {"isTrigger": True}},
                    {"id": "B", "type": "FastNode", "data": {"code": "b=1", "autoTrigger": True}},
                    {"id": "C", "type": "FastNode", "data": {"code": "c=2", "autoTrigger": True}},
                    {"id": "D", "type": "FastNode", "data": {"code": "d=b+c", "autoTrigger": True}}
                ],
                "edges": [
                    {"source": "A", "target": "B"},
                    {"source": "A", "target": "C"},
                    {"source": "B", "target": "D"},
                    {"source": "C", "target": "D"}
                ]
            }

            self.engine.load_project = MagicMock(return_value=project_data)

            mock_user_manager = MagicMock()
            mock_user_proxy = MagicMock()
            mock_user_proxy.tier = "default"
            mock_user_proxy.send_request = AsyncMock(return_value={"status": "finished", "output": "ok", "error": ""})
            mock_user_manager.get_user.return_value = mock_user_proxy
            mock_user_manager.active_connections = {}

            with patch("app.services.workflow_engine.check_user_quota", return_value=True):
                executed = await self.engine.run_downstream(
                    user_id="user_diamond",
                    project_id="proj_diamond",
                    source_node_id="A",
                    user_manager=mock_user_manager
                )

            # B and C execute first, and D executes exactly ONCE at the end
            self.assertIn("B", executed)
            self.assertIn("C", executed)
            self.assertEqual(executed.count("D"), 1)
            self.assertEqual(executed[-1], "D")
            self.assertEqual(mock_user_proxy.send_request.call_count, 3)

        asyncio.run(run_test())

    def test_run_downstream_sequential_chain(self):
        async def run_test():
            project_data = {
                "nodes": [
                    {"id": "timer_1", "type": "TimerNode", "data": {"isTrigger": True}},
                    {"id": "node_1", "type": "FastNode", "data": {"code": "out1 = 1", "autoTrigger": True, "inputs": []}},
                    {"id": "node_2", "type": "FastNode", "data": {"code": "out2 = 2", "autoTrigger": True, "inputs": []}}
                ],
                "edges": [
                    {"source": "timer_1", "target": "node_1"},
                    {"source": "node_1", "target": "node_2"}
                ]
            }

            self.engine.load_project = MagicMock(return_value=project_data)

            mock_user_manager = MagicMock()
            mock_user_proxy = MagicMock()
            mock_user_proxy.tier = "default"
            mock_user_proxy.send_request = AsyncMock(return_value={"status": "finished", "output": "ok", "error": ""})
            mock_user_manager.get_user.return_value = mock_user_proxy
            mock_user_manager.active_connections = {}

            with patch("app.services.workflow_engine.check_user_quota", return_value=True):
                executed = await self.engine.run_downstream(
                    user_id="user_123",
                    project_id="proj_1",
                    source_node_id="timer_1",
                    user_manager=mock_user_manager
                )

            self.assertEqual(executed, ["node_1", "node_2"])
            self.assertEqual(mock_user_proxy.send_request.call_count, 2)

        asyncio.run(run_test())

if __name__ == "__main__":
    unittest.main()
