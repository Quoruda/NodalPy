import { useCallback } from 'react';

export const CustomNodeOperations = (setNodes, wsRef, nodes, edges) => {

    const updateNode = useCallback((nodeId, updates) => {
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

            for (let edge of edges) {

                if (edge.target === node.id) {

                    const var_node = edge.source;
                    const var_sourceHandle = edge.sourceHandle;
                    const var_targetHandle = edge.targetHandle;
                    let var_target_name = "";

                    for(let v of node.inputs){
                        if(v.id === var_targetHandle){
                            var_target_name = v.name;
                        }
                    }

                    for (let n of nodes) {

                        if (n.id === var_node) {
                            for(let output of n.data.outputs){
                                if(output.id === var_sourceHandle){
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
    }, [edges, nodes, setNodes, wsRef]);

    return {updateNode, updateNodeCode, runCode}
}