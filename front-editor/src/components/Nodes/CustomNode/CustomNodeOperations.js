import { useCallback, useRef } from 'react';

export const CustomNodeOperations = (setNodes, wsRef, nodes, edges) => {

    const nodesRef = useRef(nodes);
    const edgesRef = useRef(edges);
    const executionQueueRef = useRef([]);

    // Update refs on each render
    nodesRef.current = nodes;
    edgesRef.current = edges;

    const getNextNodeInQueue = useCallback(() => {
        let node = null;
        const currentNodes = nodesRef.current;

        while (executionQueueRef.current.length > 0) {
            const IdNode = executionQueueRef.current.at(executionQueueRef.current.length - 1);
            for (let n of currentNodes) {
                if (n.id === IdNode) {
                    node = n;
                }
            }
            if (node !== null) {
                break;
            } else {
                executionQueueRef.current.pop();
            }
        }

        if (node === null) {
            return null;
        }
        return { ...node.data, id: node.id };
    }, []);

    const updateNode = useCallback((nodeId, updates) => {
        // Optimistic update of the Ref for immediate consistency in specific callbacks (like runCode)
        const nodeIndex = nodesRef.current.findIndex(n => n.id === nodeId);
        if (nodeIndex !== -1) {
            const updatedNode = {
                ...nodesRef.current[nodeIndex],
                data: { ...nodesRef.current[nodeIndex].data, ...updates }
            };
            const newNodes = [...nodesRef.current];
            newNodes[nodeIndex] = updatedNode;
            nodesRef.current = newNodes;
        }

        setNodes((nds) =>
            nds.map((node) =>
                node.id === nodeId
                    ? {
                        ...node,
                        data: {
                            ...node.data,
                            ...updates
                        },
                    }
                    : node
            )
        );
    }, [setNodes]);

    const runCode = useCallback((node, timeout = null) => {
        const currentWs = wsRef.current;
        if (currentWs && currentWs.readyState === WebSocket.OPEN) {
            // ...
            // (Logic unchanged)
            // ...

            const currentNodes = nodesRef.current;
            const currentEdges = edgesRef.current;

            const variables = [];

            for (let edge of currentEdges) {
                if (edge.target === node.id) {
                    const var_node = edge.source;
                    const var_sourceHandle = edge.sourceHandle;
                    const var_targetHandle = edge.targetHandle;
                    let var_target_name = "";

                    for (let v of node.inputs) {
                        if (v.id === var_targetHandle) {
                            var_target_name = v.name;
                        }
                    }

                    for (let n of currentNodes) {
                        if (n.id === var_node) {
                            for (let output of n.data.outputs) {
                                if (output.id === var_sourceHandle) {

                                    const var_source_name = output.name;
                                    const variable = {
                                        source: var_node,
                                        name: var_source_name,
                                        target: var_target_name,
                                    };
                                    variables.push(variable);
                                    break;
                                }
                            }
                            break;
                        }
                    }
                }
            }

            const request_data = {
                action: "run_node",
                code: node.code,
                variables: variables,
                node: node.id,
                timeout: timeout
            };

            currentWs.send(JSON.stringify(request_data));

            setNodes((nds) =>
                nds.map((n) =>
                    n.id === node.id ? { ...n, data: { ...n.data, state: 1, output: "", error: null } } : n
                )
            );
        } else {
            console.error("WebSocket not connected!");
        }
    }, [setNodes, wsRef]);

    const runCodeWithPrerequisites = useCallback((node) => {
        const currentEdges = edgesRef.current;
        const currentNodes = nodesRef.current;
        // ... (lines 132-156 unchanged)

        // Simplified view for replacement context, assume unchanged logic inside
        // ...

        const edgeInputs = [];
        for (let edge of currentEdges) {
            if (edge.target === node.id) {
                edgeInputs.push(edge.source)
            }
        }

        let hasPrerequisites = false

        for (let n of currentNodes) {
            if (edgeInputs.includes(n.id)) {
                if (n.data.state !== 2) {
                    hasPrerequisites = true;
                    if (n.data.state === 0 && !executionQueueRef.current.includes(n.id)) {
                        executionQueueRef.current.push(n.id);
                    }
                }
            }
        }

        if (!hasPrerequisites) {
            // Remove self from queue
            const index = executionQueueRef.current.indexOf(node.id);
            if (index !== -1) executionQueueRef.current.splice(index, 1);

            runCode(node);
            return;
        } else {
            const index = executionQueueRef.current.indexOf(node.id);
            if (index !== -1) executionQueueRef.current.splice(index, 1);
        }

        let next = getNextNodeInQueue();
        if (next !== null) {
            runCodeWithPrerequisites(next)
        }

    }, [getNextNodeInQueue, runCode]);

    const processQueue = useCallback(() => {
        try {
            // Loop until queue empty or blocked
            while (executionQueueRef.current.length > 0) {
                let node = getNextNodeInQueue();
                if (node !== null) {
                    runCodeWithPrerequisites(node);
                } else {
                    break;
                }
            }
        } catch (error) {
            console.error("Queue processing error:", error);
            // Emergency cleanup: clear queue to prevent zombie state
            executionQueueRef.current = [];
        }
    }, [getNextNodeInQueue, runCodeWithPrerequisites]);

    const addNodeToQueue = useCallback((node, timeout = null) => {
        if (executionQueueRef.current.includes(node.id)) {
            return;
        }

        executionQueueRef.current.push(node.id);

        // Use timeout 0 to break call stack and allow UI updates
        setTimeout(() => processQueue(), 0);

    }, [processQueue])

    const triggerDownstreamNodes = useCallback((sourceNodeId) => {
        const currentEdges = edgesRef.current;
        const currentNodes = nodesRef.current;

        // Find connected target nodes
        const targetIds = currentEdges
            .filter(e => e.source === sourceNodeId)
            .map(e => e.target);

        // Deduplicate
        const uniqueTargetIds = [...new Set(targetIds)];

        uniqueTargetIds.forEach(targetId => {
            const targetNode = currentNodes.find(n => n.id === targetId);

            if (targetNode && targetNode.type === 'FastNode') {
                // Fix: Use addNodeToQueue to ensure prerequisites are checked!
                addNodeToQueue(targetNode.data);
            }
        });

    }, [addNodeToQueue]);

    return { updateNode, runCode, addNodeToQueue, processQueue, triggerDownstreamNodes }
}