import { useCallback, useRef } from 'react';

export const CustomNodeOperations = (setNodes, wsRef, nodes, edges) => {

    // ✅ Utiliser des refs pour accéder aux valeurs actuelles sans dépendances
    const nodesRef = useRef(nodes);
    const edgesRef = useRef(edges);

    // Mettre à jour les refs à chaque render
    nodesRef.current = nodes;
    edgesRef.current = edges;

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

    const updateNodeCode = useCallback((nodeId, newCode) => {
        setNodes((nds) => nds.map((node) =>
            node.id === nodeId
                ? { ...node, data: { ...node.data, code: newCode } }
                : node
        ));
    }, [setNodes]);

    // ✅ SOLUTION CORRECTE : Callbacks stables avec useRef
    const runCode = useCallback((node) => {
        const currentWs = wsRef.current;
        if (currentWs && currentWs.readyState === WebSocket.OPEN) {

            // ✅ Utiliser les refs pour accéder aux valeurs actuelles
            const currentNodes = nodesRef.current;
            const currentEdges = edgesRef.current;

            const variables = [];

            for (let edge of currentEdges) {
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

                    for (let n of currentNodes) {
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

            // ✅ Envoyer le message WebSocket UNE SEULE FOIS (en dehors de setNodes)
            const request_data = {
                action: "run",
                code: node.code,
                variables: variables,
                node: node.id,
            };
            currentWs.send(JSON.stringify(request_data));

            // ✅ Mettre à jour le state séparément
            setNodes((nds) =>
                nds.map((n) =>
                    n.id === node.id ? { ...n, data: { ...n.data, state: 1, output: "" } } : n
                )
            );
        }
    }, [setNodes, wsRef]); // ✅ Plus de dépendance sur nodes et edges !

    return {updateNode, updateNodeCode, runCode}
}