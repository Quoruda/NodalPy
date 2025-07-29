import React, {useCallback, useEffect, useState} from 'react';
import {
    ReactFlow,
    useNodesState,
    useEdgesState,
    addEdge,
    Controls,
    MiniMap,
    Background
} from '@xyflow/react';
import { nodeTypes } from './components/nodes.jsx';

import '@xyflow/react/dist/style.css';
import './App.css'; // Ajoute tes styles ici


function extractNumber(str) {
  const match = str.match(/\d+/); // Cherche un ou plusieurs chiffres
  return match ? parseInt(match[0], 10) : null;
}

const initialNodes = [

];

const initialEdges = [

];




export default function App() {
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [nodeCount, setNodeCount] = useState(3);

    const onConnect = useCallback(
        (params) => setEdges((eds) => addEdge(params, eds)),
        [setEdges]
    );

    const [selectedEdge, setSelectedEdge] = useState(null);
    const [selectedNode, setSelectedNode] = useState(null);

    // Supprimer avec "Delete"
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (selectedEdge) {
                setEdges((eds) => eds.filter((e) => e.id !== selectedEdge.id));
                setSelectedEdge(null);
            } else if (selectedNode) {
                setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
                // Supprime aussi les edges associés au node supprimé
                setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
                setSelectedNode(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedEdge,selectedNode, setEdges, setNodes]);

    const updateNode = (nodeId, updates) => {
        console.log("updates: ", updates)
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
        console.log(nodes)
    };

    const runCode = (node) => {
        const id_node = node.id;
        const variables = [];

        for (let edge of edges) {
            if (edge.target === id_node) {
                const var_node = edge.source;
                const var_sourceHandle = extractNumber(edge.sourceHandle);
                const var_targetHandle = extractNumber(edge.targetHandle);
                const var_target_name = node.inputs[var_targetHandle - 1];

                for (let n of nodes) {
                    if (n.id === var_node) {
                        const var_source_name = n.data.outputs[var_sourceHandle - 1];
                        const variable = {
                            source: var_node,
                            name: var_source_name,
                            target: var_target_name,
                        };
                        variables.push(variable);
                        break;
                    }
                }
            }
        }

        const request_data = {
            code: node.code,
            variables: variables,
            node: node.id,
        };

        console.log(request_data);

        fetch('http://localhost:8000/run', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(request_data),
        })
            .then((response) => response.json())
            .then((data) => {
                console.log('Success:', data);
                const output = data.output;

                // ✅ Mettre à jour le noeud ici, quand on a le résultat
                setNodes((nds) =>
                    nds.map((n) =>
                        n.id === id_node
                            ? {
                                  ...n,
                                  data: {
                                      ...n.data,
                                      output: output,
                                  },
                              }
                            : n
                    )
                );
            })
            .catch((error) => {
                console.error('Error:', error);
                const output = "Erreur lors de l'exécution du code";

                // ✅ Même en cas d'erreur, on met à jour le noeud
                setNodes((nds) =>
                    nds.map((n) =>
                        n.id === id_node
                            ? {
                                  ...n,
                                  data: {
                                      ...n.data,
                                      output: output,
                                  },
                              }
                            : n
                    )
                );
            });
    };


    // Callback pour modifier le code d'un noeud
    const updateNodeCode = (nodeId, newCode) => {
        setNodes((nds) =>
            nds.map((node) =>
                node.id === nodeId
                    ? {
                        ...node,
                        data: {
                            ...node.data,
                            code: newCode,
                            onChange: updateNodeCode,
                        },
                    }
                    : node
            )
        );
    };


    // Ajout d’un nouveau noeud avec une textarea vide
    const addNode = () => {
        const newNode = {
            id: `fn${nodeCount}`,
            type: 'functionNode',
            data: {
                code: '',
                onChange: updateNodeCode,
            },
            position: { x: 100 + nodeCount * 50, y: 100 + nodeCount * 50 },
        };
        setNodes((nds) => [...nds, newNode]);
        setNodeCount((count) => count + 1);
    };

    const styledEdges = edges.map((edge) => ({
        ...edge,
        style: {
            stroke: edge.id === selectedEdge?.id ? '#ff0072' : '#999',
            strokeWidth: edge.id === selectedEdge?.id ? 3 : 1.5,
        },
    }));


    // Injecte updateNodeCode dans chaque noeud existant au démarrage
    const preparedNodes = nodes.map((node) => ({
        ...node,
        data: {
            output: "",
            ...node.data,
            id: node.id,
            onChange: updateNodeCode,
            onUpdate: updateNode,
            runCode: runCode,

        },
    }));

    return (
        <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
            <button className="add-node-button" onClick={addNode}>
                Ajouter un nœud
            </button>

            <ReactFlow
                nodes={preparedNodes}
                edges={styledEdges}
                onEdgeClick={(_, edge) => setSelectedEdge(edge)}
                onNodeClick={(_, node) => setSelectedNode(node)}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                fitView
            >
                <Background variant="dots" gap={16} size={1} />
                <MiniMap nodeColor={(n) => (n.type === 'functionNode' ? '#ffcc00' : '#aaa')} />
                <Controls />
            </ReactFlow>
        </div>
    );
}
