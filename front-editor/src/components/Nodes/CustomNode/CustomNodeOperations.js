import { useCallback } from 'react';

export const CustomNodeOperations = (setNodes, wsRef) => {
    const updateNode = useCallback((nodeId, updates) => {
        console.log("updates: ", updates);
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

    // Optimisation: updateNodeCode stable
    const updateNodeCode = useCallback((nodeId, newCode) => {
        setNodes((nds) => nds.map((node) =>
            node.id === nodeId
                ? { ...node, data: { ...node.data, code: newCode } }
                : node
        ));
    }, [setNodes]);

    // Optimisation: runCode stable avec useCallback
    const runCode = useCallback((node) => {
        const currentWs = wsRef.current;
        if (currentWs && currentWs.readyState === WebSocket.OPEN) {
            const variables = [];
            const request_data = {
                action: "run",
                code: node.code,
                variables: variables,
                node: node.id,
            };
            currentWs.send(JSON.stringify(request_data));

            setNodes((nds) =>
                nds.map((n) =>
                    n.id === node.id ? { ...n, data: { ...n.data, state: 1, output: "" } } : n
                )
            );
        }
    }, [setNodes, wsRef]);

    return {updateNode, updateNodeCode, runCode}
}