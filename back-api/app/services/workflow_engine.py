import os
import json
import asyncio
from typing import Dict, List, Any, Optional, Set
from loguru import logger

from ..core.config import STORAGE_DIR
from ..core.node_registry import node_registry
from ..core.tier_manager import get_tier_config
from ..core.storage_manager import check_user_quota

def get_user_states_dir(user_id: str) -> str:
    """
    Returns the host path where node state pickles (.states) are located.
    The kernel container mounts STORAGE_DIR/users/{user_id}/kernel_data to /app/storage.
    """
    kernel_states = os.path.join(STORAGE_DIR, "users", str(user_id), "kernel_data", ".states")
    os.makedirs(kernel_states, exist_ok=True)
    return kernel_states

def has_node_state(user_id: str, node_id: str) -> bool:
    """
    Checks whether a state pickle exists in kernel_data/.states or legacy .states.
    """
    p1 = os.path.join(STORAGE_DIR, "users", str(user_id), "kernel_data", ".states", f"{node_id}.pkl")
    p2 = os.path.join(STORAGE_DIR, "users", str(user_id), ".states", f"{node_id}.pkl")
    return os.path.exists(p1) or os.path.exists(p2)

class WorkflowEngine:
    """
    Autonomous Backend Workflow Engine.
    Executes DAG workflows independently of web client presence.
    """

    def get_reachable_nodes(self, source_id: str, edges: list[dict]) -> set[str]:
        """
        Computes the complete downstream reachable subgraph from source_id via BFS.
        Used to resolve diamond dependencies (avoiding premature execution with stale state).
        """
        reachable = set()
        queue = [source_id]
        while queue:
            curr = queue.pop(0)
            reachable.add(curr)
            for edge in edges:
                if edge.get("source") == curr:
                    target = edge.get("target")
                    if target and target not in reachable:
                        reachable.add(target)
                        queue.append(target)
        return reachable

    def build_variables(self, target_node: dict, edges: list[dict], nodes: list[dict]) -> list[dict]:
        """
        Builds variable mappings for a target node from upstream connected nodes.
        Maps source output handles to target input handles/names.
        Safe against arbitrary inputs (dictionaries or strings).
        """
        variables = []
        target_id = target_node.get("id")
        target_inputs = target_node.get("data", {}).get("inputs", []) or target_node.get("inputs", [])

        for edge in edges:
            if edge.get("target") != target_id:
                continue

            source_id = edge.get("source")
            source_node = next((n for n in nodes if n.get("id") == source_id), None)
            if not source_node:
                continue

            # Identify target variable name
            target_handle = edge.get("targetHandle")
            target_input = next((v for v in target_inputs if isinstance(v, dict) and v.get("id") == target_handle), None)
            if not target_input and len(target_inputs) == 1:
                target_input = target_inputs[0]

            if isinstance(target_input, dict):
                target_var_name = target_input.get("name")
            elif isinstance(target_input, str):
                target_var_name = target_input
            else:
                target_var_name = None

            # Identify source variable name
            source_handle = edge.get("sourceHandle")
            source_outputs = source_node.get("data", {}).get("outputs", []) or source_node.get("outputs", [])
            source_output = next((o for o in source_outputs if isinstance(o, dict) and o.get("id") == source_handle), None)

            if not source_output and len(source_outputs) == 1:
                source_output = source_outputs[0]

            if isinstance(source_output, dict):
                source_var_name = source_output.get("name")
            elif isinstance(source_output, str):
                source_var_name = source_output
            else:
                source_var_name = None

            # Fallback for trigger nodes or nodes without explicit output schema
            if not source_var_name:
                is_source_trigger = (
                    source_node.get("data", {}).get("isTrigger", False) or
                    source_node.get("type", "").lower() in ["timernode", "trigger"]
                )
                if is_source_trigger:
                    source_var_name = "output"

            if source_var_name and target_var_name:
                variables.append({
                    "source": source_id,
                    "name": source_var_name,
                    "target": target_var_name
                })

        return variables

    def load_project(self, user_id: str, project_id: str) -> dict:
        """
        Loads project configuration (nodes, edges, meta) from storage.
        If project_id is default or missing, falls back to scanning available projects.
        """
        projects_dir = os.path.join(STORAGE_DIR, "users", str(user_id), "projects")
        project_path = os.path.join(projects_dir, f"{project_id}.json")

        if not os.path.exists(project_path) and os.path.exists(projects_dir):
            # Scan for candidate project files
            files = [f for f in os.listdir(projects_dir) if f.endswith(".json") and f != "project.json"]
            if files:
                project_path = os.path.join(projects_dir, files[0])

        if not os.path.exists(project_path):
            logger.warning(f"Project file not found: {project_path}")
            return {"meta": {}, "nodes": [], "edges": []}

        try:
            with open(project_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error reading project {project_id} for user {user_id}: {e}")
            return {"meta": {}, "nodes": [], "edges": []}

    def save_project(self, user_id: str, project_id: str, project_data: dict):
        """
        Persists updated project state (node statuses, logs) to storage atomically.
        """
        project_path = os.path.join(STORAGE_DIR, "users", str(user_id), "projects", f"{project_id}.json")
        os.makedirs(os.path.dirname(project_path), exist_ok=True)
        try:
            temp_path = f"{project_path}.tmp"
            with open(temp_path, "w", encoding="utf-8") as f:
                json.dump(project_data, f, indent=2)
            os.replace(temp_path, project_path)
        except Exception as e:
            logger.error(f"Error persisting project {project_id} for user {user_id}: {e}")

    async def broadcast_to_user(self, user_manager, user_id: str, payload: dict):
        """
        Sends an event to the user's active WebSocket connection if open.
        Fails safely and silently if the user is disconnected.
        """
        if not user_manager:
            return
        conn = user_manager.active_connections.get(str(user_id))
        if conn and conn.is_open():
            try:
                await conn.websocket.send_json(payload)
            except Exception as e:
                logger.debug(f"Could not send websocket payload to user {user_id}: {e}")

    def _get_node_code(self, node: dict, nodes: list[dict]) -> str:
        """
        Resolves node code, accounting for ShadowNodes pointing to a masterId.
        """
        data = node.get("data", {})
        master_id = data.get("masterId")
        if master_id:
            master_node = next((n for n in nodes if n.get("id") == master_id), None)
            if master_node:
                return master_node.get("data", {}).get("code", "")
        return data.get("code", "")

    def _is_node_auto_trigger(self, node: dict) -> bool:
        """
        Determines whether a node should auto-trigger based on its data or type defaults.
        FastNode / ValueNode default to True; ManualNode / GroupNode default to False.
        """
        data = node.get("data", {})
        if "autoTrigger" in data and data["autoTrigger"] is not None:
            return bool(data["autoTrigger"])
        node_type = str(node.get("type", "")).lower()
        if "manual" in node_type or "group" in node_type:
            return False
        return True

    async def execute_node(
        self,
        user_id: str,
        project_id: str,
        node: dict,
        project_data: dict,
        user_manager,
        override_code: Optional[str] = None
    ) -> dict:
        """
        Executes a single node in the user's isolated kernel environment.
        Streams progress events via WebSocket if the client is connected.
        Updates and persists node status in project_data.
        """
        node_id = node.get("id")
        node_type = node.get("type", "CustomNode")
        nodes = project_data.get("nodes", [])
        edges = project_data.get("edges", [])

        # Non-executable visual nodes (e.g. ObserverNode, GroupNode)
        if str(node_type).lower() in ["observernode", "groupnode"]:
            node_data = node.setdefault("data", {})
            node_data["state"] = 2
            self.save_project(user_id, project_id, project_data)
            return {"action": "run_code", "status": "finished", "node": node_id, "output": "", "error": ""}

        code = override_code if override_code is not None else self._get_node_code(node, nodes)
        node_inputs = node.get("data", {}).get("inputs", []) or node.get("inputs", [])
        inputs_list = [i.get("name") if isinstance(i, dict) else i for i in node_inputs if (isinstance(i, dict) and "name" in i) or isinstance(i, str)]
        variables = self.build_variables(node, edges, nodes)

        user_proxy = None
        if user_manager:
            user_tier = "default"
            if str(user_id) not in user_manager.users:
                try:
                    from ..core.database import SessionLocal
                    from ..models.user import User
                    from sqlalchemy import select
                    async with SessionLocal() as db:
                        result = await db.execute(select(User).where(User.id == str(user_id)))
                        db_user = result.scalars().first()
                        if db_user and db_user.tier:
                            user_tier = db_user.tier
                except Exception as e:
                    logger.debug(f"Could not load tier from DB for user {user_id}: {e}")
            user_proxy = user_manager.get_user(user_id, tier=user_tier)

        tier = user_proxy.tier if user_proxy else "default"

        # Quota verification
        if not check_user_quota(user_id, tier=tier):
            await self.broadcast_to_user(user_manager, user_id, {
                "action": "notification",
                "level": "warning",
                "message": "Storage quota reached. Delete files to free up space."
            })
            error_res = {
                "action": "run_code",
                "status": "error",
                "node": node_id,
                "error": "STORAGE_QUOTA_EXCEEDED"
            }
            node_data = node.setdefault("data", {})
            node_data["state"] = 3
            node_data["error"] = "STORAGE_QUOTA_EXCEEDED"
            self.save_project(user_id, project_id, project_data)
            await self.broadcast_to_user(user_manager, user_id, error_res)
            return error_res

        # Timeout calculation
        timeout = node_registry.get_timeout(node_type)
        tier_config = get_tier_config(tier)
        tier_timeout = tier_config.get("execution_timeout")
        if tier_timeout is not None:
            if timeout is None or tier_timeout < timeout:
                timeout = tier_timeout

        # Broadcast running state
        await self.broadcast_to_user(user_manager, user_id, {
            "action": "run_code",
            "status": "running",
            "node": node_id
        })

        if not user_proxy:
            err_msg = f"User proxy not available for user {user_id}"
            logger.error(err_msg)
            return {"status": "error", "error": err_msg, "node": node_id}

        try:
            max_disk_mb = tier_config.get("max_disk_mb")
            response = await user_proxy.send_request({
                "action": "run_node",
                "node": node_id,
                "code": code,
                "variables": variables,
                "timeout": timeout,
                "inputs": inputs_list,
                "max_disk_mb": max_disk_mb
            })

            status = response.get("status", "finished")
            output = response.get("output", "")
            error = response.get("error", "")

            # Update node data in project
            node_data = node.setdefault("data", {})
            if status == "finished":
                node_data["state"] = 2
                node_data["error"] = None
                if output:
                    node_data["logs"] = output
            elif status == "error":
                node_data["state"] = 3
                node_data["error"] = error

            self.save_project(user_id, project_id, project_data)

            if error == "STORAGE_QUOTA_EXCEEDED":
                await self.broadcast_to_user(user_manager, user_id, {
                    "action": "notification",
                    "level": "warning",
                    "message": "Storage quota reached. Delete files to free up space."
                })

            result_payload = {
                "action": "run_code",
                "status": status,
                "node": node_id,
                "output": output,
                "error": error
            }
            await self.broadcast_to_user(user_manager, user_id, result_payload)
            return result_payload

        except Exception as e:
            logger.error(f"Execution error on node {node_id}: {e}")
            node_data = node.setdefault("data", {})
            node_data["state"] = 3
            node_data["error"] = str(e)
            self.save_project(user_id, project_id, project_data)

            err_payload = {
                "action": "run_code",
                "status": "error",
                "node": node_id,
                "error": str(e)
            }
            await self.broadcast_to_user(user_manager, user_id, err_payload)
            return err_payload

    async def run_downstream(
        self,
        user_id: str,
        project_id: str,
        source_node_id: str,
        user_manager,
        completed_nodes: Optional[Set[str]] = None,
        project_data: Optional[dict] = None,
        reachable_nodes: Optional[Set[str]] = None
    ) -> List[str]:
        """
        Orchestrates sequential downstream workflow execution originating from source_node_id.
        Operates completely autonomously on the backend with cycle & diamond DAG protection.
        """
        if completed_nodes is None:
            completed_nodes = set()
        completed_nodes.add(source_node_id)

        if project_data is None:
            project_data = self.load_project(user_id, project_id)

        nodes = project_data.get("nodes", [])
        edges = project_data.get("edges", [])

        if reachable_nodes is None:
            reachable_nodes = self.get_reachable_nodes(source_node_id, edges)

        source_node = next((n for n in nodes if n.get("id") == source_node_id), None)
        is_source_trigger = True if not source_node else (
            source_node.get("data", {}).get("isTrigger", False) or
            source_node.get("type", "").lower() in ["timernode", "trigger"]
        )

        # Find direct downstream targets
        target_ids = list(dict.fromkeys(
            e.get("target") for e in edges if e.get("source") == source_node_id and e.get("target")
        ))

        executed_sequence = []

        for target_id in target_ids:
            # Prevent infinite loops / re-executing already completed nodes in same workflow run
            if target_id in completed_nodes:
                continue

            target_node = next((n for n in nodes if n.get("id") == target_id), None)
            if not target_node:
                continue

            # Auto-trigger check (FastNode: True, ManualNode: False unless configured or connected to trigger)
            is_auto_trigger = self._is_node_auto_trigger(target_node)
            if not is_auto_trigger and not is_source_trigger:
                continue

            # Verify all upstream dependencies are satisfied
            incoming_edges = [e for e in edges if e.get("target") == target_id]
            all_sources_ready = True

            for in_edge in incoming_edges:
                src_id = in_edge.get("source")
                if src_id == source_node_id or src_id in completed_nodes:
                    continue

                # If the upstream source is part of the triggered downstream workflow,
                # it MUST wait until it has completed in this run (diamond dependency resolution)
                if src_id in reachable_nodes:
                    all_sources_ready = False
                    break

                # If the upstream source is external (e.g. constant/ValueNode), verify state on disk
                if not has_node_state(user_id, src_id):
                    all_sources_ready = False
                    break

            if not all_sources_ready:
                continue

            # Execute the target node
            res = await self.execute_node(user_id, project_id, target_node, project_data, user_manager)
            executed_sequence.append(target_id)

            if res.get("status") == "finished":
                completed_nodes.add(target_id)
                # Recurse downstream with shared project_data and reachable_nodes
                further = await self.run_downstream(
                    user_id=user_id,
                    project_id=project_id,
                    source_node_id=target_id,
                    user_manager=user_manager,
                    completed_nodes=completed_nodes,
                    project_data=project_data,
                    reachable_nodes=reachable_nodes
                )
                executed_sequence.extend(further)
            else:
                logger.warning(f"Node {target_id} finished with status '{res.get('status')}'. Stopping downstream propagation on this branch.")

        return executed_sequence

workflow_engine = WorkflowEngine()
