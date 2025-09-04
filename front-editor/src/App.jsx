import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
    ReactFlow,
    useNodesState,
    useEdgesState,
    addEdge,
    Controls,
    MiniMap,
    Background
} from '@xyflow/react';
import { NodeTypes } from './components/Nodes/NodeTypes.jsx';

import '@xyflow/react/dist/style.css';
import './App.css';
import { FlowProvider } from './components/FlowContext.jsx';
import {CustomNodeOperations} from './components/Nodes/CustomNode/CustomNodeOperations.js';

const initialNodes = [];
const initialEdges = [];

export default function App() {
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [nodeCount, setNodeCount] = useState(3);
    const [selectedEdges, setSelectedEdges] = useState([]);
    const [selectedNodes, setSelectedNodes] = useState([]);
    const [, setWs] = useState(null);

    // Ref pour éviter les re-renders inutiles
    const wsRef = useRef(null);

    const { updateNode, updateNodeCode, runCode} = CustomNodeOperations(setNodes, wsRef);


    const onConnect = useCallback(
        (params) => setEdges((eds) => addEdge(params, eds)),
        [setEdges]
    );

    // Optimisation WebSocket: utiliser useRef pour éviter les re-créations
    useEffect(() => {
        const socket = new WebSocket("ws://localhost:8000/ws");
        wsRef.current = socket;

        socket.onopen = () => console.log("✅ WebSocket connecté");
        socket.onclose = () => console.log("❌ WebSocket fermé");
        socket.onerror = (err) => console.error("⚠️ WS error", err);

        socket.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            console.log("WS reçu:", msg);

            setNodes((nds) =>
                nds.map((n) => {
                    if (n.id === msg.node) {
                        if (msg.status === "running") {
                            return { ...n, data: { ...n.data, state: 1 } };
                        }
                        if (msg.output) {
                            return {
                                ...n,
                                data: {
                                    ...n.data,
                                    output: (n.data.output || "") + msg.output,
                                },
                            };
                        }
                        if (msg.status === "finished") {
                            return { ...n, data: { ...n.data, state: 2 } };
                        }
                    }
                    return n;
                })
            );
        };

        setWs(socket);

        return () => {
            socket.close();
            wsRef.current = null;
        };
    }, [setNodes]); // Pas de dépendances pour éviter les reconnexions



    // Optimisation des events handlers
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'Delete' || event.key === 'Backspace') {
                const activeTag = document.activeElement.tagName;
                const isTyping = activeTag === 'INPUT' || activeTag === 'TEXTAREA' ||
                               document.activeElement.isContentEditable;
                const isInCodeMirror = document.activeElement.closest('.cm-editor');

                if (isTyping || isInCodeMirror) {
                    return;
                }

                if (selectedEdges.length > 0) {
                    setEdges((eds) =>
                        eds.filter((e) => !selectedEdges.some((sel) => sel.id === e.id))
                    );
                    setSelectedEdges([]);
                }

                if (selectedNodes.length > 0) {
                    const selectedIds = selectedNodes.map((n) => n.id);
                    setNodes((nds) => nds.filter((n) => !selectedIds.includes(n.id)));
                    setEdges((eds) =>
                        eds.filter((e) => !selectedIds.includes(e.source) && !selectedIds.includes(e.target))
                    );
                    setSelectedNodes([]);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedEdges, selectedNodes, setEdges, setNodes]);

    // Optimisation: addNode stable
    const addNode = useCallback(() => {
        const newNode = {
            id: `fn${nodeCount}`,
            type: 'CustomNode',
            data: {
                code: '',
                title: `Node ${nodeCount}`,
                inputs: [],
                outputs: [],
                state: 0
            },
            position: { x: 100 + nodeCount * 50, y: 100 + nodeCount * 50 },
        };
        setNodes((nds) => [...nds, newNode]);
        setNodeCount((count) => count + 1);
    }, [nodeCount, setNodes]);

    const saveProject = useCallback(() => {
        const data = {nodes: nodes, edges:edges}
        const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "data.json";
        a.click();
        URL.revokeObjectURL(url);
    }, [nodes, edges]);

    // Optimisation: mémoisation des edges stylés
    const styledEdges = useMemo(() =>
        edges.map((edge) => ({
            ...edge,
            style: {
                stroke: selectedEdges.some(sel => sel.id === edge.id) ? '#ff0072' : '#999',
                strokeWidth: selectedEdges.some(sel => sel.id === edge.id) ? 3 : 1.5,
            },
        }))
    , [edges, selectedEdges]);

    // CRITIQUE: Optimisation principale - éviter la re-création des nodes à chaque render
    const preparedNodes = useMemo(() =>
        nodes.map((node) => ({
            ...node,
            data: {
                ...node.data,
                id: node.id,
                onChange: updateNodeCode,
                onUpdate: updateNode,
                runCode: runCode,
            },
            edges: edges,
        }))
    , [nodes, updateNodeCode, updateNode, runCode, edges]);

    // Optimisation: handler de selection stable
    const onSelectionChange = useCallback(({ nodes, edges }) => {
        setSelectedNodes(nodes || []);
        setSelectedEdges(edges || []);
    }, []);

    return (
        <FlowProvider edges={edges} nodes={nodes}>
        <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
            <button className="add-node-button" onClick={addNode}>
                Ajouter un nœud
            </button>
            <button className="save-button" onClick={saveProject}>
                Sauvegarder
            </button>
                <ReactFlow
                    nodes={preparedNodes}
                    edges={styledEdges}
                    onSelectionChange={onSelectionChange}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    nodeTypes={NodeTypes}
                    fitView
                >
                    <Background variant="dots" gap={16} size={1} />
                    <MiniMap nodeColor={(n) => (n.type === 'functionNode' ? '#ffcc00' : '#aaa')} />
                    <Controls />
                </ReactFlow>
        </div>
        </FlowProvider>
    );
}