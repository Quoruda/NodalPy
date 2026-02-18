import { useCallback, useRef } from 'react';

export const CustomNodeOperations = (setNodes, wsRef, nodes, edges) => {

    const nodesRef = useRef(nodes);
    const edgesRef = useRef(edges);
    const executionQueueRef = useRef([]);

    // Update refs on each render
    nodesRef.current = nodes;
    edgesRef.current = edges;

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
                inputs: node.inputs.map(i => i.name),
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

    const processQueue = useCallback(() => {
        try {
            // Simple FIFO Queue Processing
            // We run everything in the queue immediately (async firing)
            // No prerequisite checks (Manual runs are forced / FastNodes manage their own downstream triggers)

            const queue = executionQueueRef.current;
            const currentNodes = nodesRef.current;

            while (queue.length > 0) {
                const nodeId = queue.shift(); // FIFO
                const node = currentNodes.find(n => n.id === nodeId);

                if (node) {
                    // Normalize data structure if needed
                    const nodeData = { ...node.data, id: node.id };
                    runCode(nodeData);
                }
            }
        } catch (error) {
            console.error("Queue processing error:", error);
            // Emergency cleanup
            executionQueueRef.current = [];
        }
    }, [runCode]);

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
                // Must pass ID explicitly as it might not be in data
                addNodeToQueue({ ...targetNode.data, id: targetNode.id });
            }
        });

    }, [addNodeToQueue]);

    return { updateNode, runCode, addNodeToQueue, processQueue, triggerDownstreamNodes }
}