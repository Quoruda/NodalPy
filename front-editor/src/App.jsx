import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useWebSocket } from './hooks/useWebSocket.js';

import { get, set } from 'idb-keyval';

// Default empty state
const defaultNodes = [];
const defaultEdges = [];

export default function App() {
    const [nodes, setNodes, onNodesChange] = useNodesState(defaultNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(defaultEdges);
    const [nodeCount, setNodeCount] = useState(3);
    const [selectedEdges, setSelectedEdges] = useState([]);
    const [selectedNodes, setSelectedNodes] = useState([]);
    const [reactFlowInstance, setReactFlowInstance] = useState(null);
    const [isLoaded, setIsLoaded] = useState(false); // Track initial load

    const { wsRef } = useWebSocket("ws://localhost:8000/ws", setNodes);

    // Load from IndexedDB on mount
    useEffect(() => {
        const loadFromIDB = async () => {
            try {
                const flowData = await get('flowData');
                if (flowData) {
                    const parsedData = JSON.parse(flowData);
                    console.log("Loaded flow data from IndexedDB");
                    if (parsedData.nodes && parsedData.edges) {
                        setNodes(parsedData.nodes);
                        setEdges(parsedData.edges);

                        // Calculate next node ID based on existing nodes to avoid collision
                        // Simple heuristic: count nodes + 1, or use max ID + 1 if integer IDs (but we use custom strings now)
                        setNodeCount(parsedData.nodes.length + 1);
                    }
                }
            } catch (err) {
                console.error("Failed to load from IndexedDB:", err);
            } finally {
                setIsLoaded(true);
            }
        };
        loadFromIDB();
    }, [setNodes, setEdges]);


    const onConnectEdge = useCallback(
        (params) => setEdges((eds) => addEdge(params, eds)),
        [setEdges]
    );


    useEffect(() => {
        const handleBeforeUnload = (e) => {
            e.preventDefault();
            e.returnValue = "";
        };

        window.addEventListener("beforeunload", handleBeforeUnload);


        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
        };
    }, []);

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

    const saveProjectToIDB = useCallback(() => {
        if (!isLoaded) return; // Don't save before initial load completes

        // Sanitize nodes to remove heavy execution data (output, error)
        const sanitizedNodes = nodes.map(node => ({
            ...node,
            data: {
                ...node.data,
                output: undefined, // Clear large outputs
                error: undefined,
                state: 0 // Reset state on save
            }
        }));

        const data = { nodes: sanitizedNodes, edges: edges }
        const json_data = JSON.stringify(data)

        set('flowData', json_data)
            .then(() => console.log("Project saved to IndexedDB (async)"))
            .catch(err => console.error("Failed to save to IndexedDB:", err));

    }, [nodes, edges, isLoaded]);

    useEffect(() => {
        // Debounce saving to avoid lag during drag/resize
        const timeoutId = setTimeout(() => {
            if (isLoaded) {
                saveProjectToIDB();
            }
        }, 1000); // 1 second debounce

        return () => clearTimeout(timeoutId);
    }, [nodes, edges, saveProjectToIDB, isLoaded]);


    const saveProjectToFile = useCallback(() => {
        const data = { nodes: nodes, edges: edges }
        const jsonString = JSON.stringify(data);

        // Check for pywebview API (Desktop Mode)
        if (window.pywebview && window.pywebview.api) {
            console.log("Saving via PyWebView API...");
            window.pywebview.api.save_file(jsonString).then((response) => {
                console.log("Save response:", response);
            }).catch(err => console.error("PyWebView Save Error:", err));
            return;
        }

        // Fallback for browser (Local Mode)
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "data.json";
        a.click();
        URL.revokeObjectURL(url);
    }, [nodes, edges]);

    const handleImportClick = () => {
        document.getElementById('loading-file-input').click();
    };

    const loadProject = useCallback((event) => {
        const file = event.target.files[0];

        if (!file) {
            return;
        }

        // Vérifier que c'est bien un fichier JSON
        if (file.type !== "application/json" && !file.name.endsWith('.json')) {
            alert("Veuillez sélectionner un fichier JSON valide");
            return;
        }

        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);

                // Vérifier que le fichier contient les propriétés attendues
                if (data.nodes && data.edges) {
                    // Ici vous devez utiliser vos setters d'état pour mettre à jour nodes et edges
                    let newNodes = [];
                    newNodes.splice(0, nodes.length);
                    for (let node of data.nodes) {
                        node.data.state = 0;
                        newNodes.push(node);
                    }

                    let newEdges = [];
                    edges.splice(0, edges.length);
                    for (let edge of data.edges) {
                        newEdges.push(edge);
                    }
                    setNodes(newNodes);
                    setEdges(newEdges);

                    console.log("Projet chargé avec succès");


                } else {
                    alert("Format de fichier invalide. Le fichier doit contenir 'nodes' et 'edges'");
                }
            } catch (error) {
                console.error("Erreur lors du parsing du fichier:", error);
                alert("Erreur lors de la lecture du fichier. Assurez-vous que c'est un fichier JSON valide.");
            }
        };

        reader.onerror = () => {
            console.error("Erreur lors de la lecture du fichier");
            alert("Erreur lors de la lecture du fichier");
        };

        // Lire le fichier comme du texte
        reader.readAsText(file);

        // Réinitialiser la valeur de l'input pour permettre de recharger le même fichier
        event.target.value = '';
    }, [nodes.length, edges, setNodes, setEdges]);

    // Optimisation: mémorisation des edges stylés
    const styledEdges = useMemo(() =>
        edges.map((edge) => ({
            ...edge,
            style: {
                stroke: selectedEdges.some(sel => sel.id === edge.id) ? '#ff0072' : '#999',
                strokeWidth: selectedEdges.some(sel => sel.id === edge.id) ? 3 : 1.5,
            },
        }))
        , [edges, selectedEdges]);

    const generateUniqueId = () => {
        return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    };

    // Optimisation: addNode stable
    const addNode = useCallback((type = 'CustomNode') => {
        const id = generateUniqueId();
        if (!reactFlowInstance) return;

        console.log("Adding node type:", type);

        const flowElement = document.querySelector('.react-flow');
        const bounds = flowElement?.getBoundingClientRect();

        if (bounds) {
            const centerX = bounds.width / 2;
            const centerY = bounds.height / 2;
            //
            // Utiliser project au lieu de screenToFlowPosition
            const position = reactFlowInstance.screenToFlowPosition({
                x: centerX,
                y: centerY
            });

            let canBePlaced = false;

            while (!canBePlaced) {
                canBePlaced = true
                for (let node of nodes) {
                    if (node.position.x === position.x && node.position.y === position.y) {
                        canBePlaced = false;
                    }
                }
                if (!canBePlaced) {
                    position.x += 50;
                    position.y += 50;
                }
            }

            let newNode;

            if (type === 'ObserverNode') {
                newNode = {
                    id: id,
                    type: 'ObserverNode',
                    data: {},
                    position: position,
                }
            } else if (type === 'IntegerNode') {
                newNode = {
                    id: id,
                    type: 'IntegerNode',
                    width: 140,
                    data: {
                        id: id,
                        title: `Integer ${nodeCount}`,
                        value: 0,
                        code: 'output = 0',
                        inputs: [],
                        outputs: [{ id: 'output', name: 'output', type: 'int' }], // Pre-defined output
                        state: 0
                    },
                    position: position,
                };
            } else if (type === 'FloatNode') {
                newNode = {
                    id: id,
                    type: 'FloatNode',
                    width: 140,
                    data: {
                        id: id,
                        title: `Float ${nodeCount}`,
                        value: 0.0,
                        code: 'output = 0.0',
                        inputs: [],
                        outputs: [{ id: 'output', name: 'output', type: 'float' }],
                        state: 0
                    },
                    position: position,
                };
            } else if (type === 'BooleanNode') {
                newNode = {
                    id: id,
                    type: 'BooleanNode',
                    width: 140,
                    data: {
                        id: id,
                        title: `Boolean ${nodeCount}`,
                        value: true,
                        code: 'output = True',
                        inputs: [],
                        outputs: [{ id: 'output', name: 'output', type: 'bool' }],
                        state: 0
                    },
                    position: position,
                };
            } else if (type === 'StringNode') {
                newNode = {
                    id: id,
                    type: 'StringNode',
                    width: 160,
                    data: {
                        id: id,
                        title: `String ${nodeCount}`,
                        value: '',
                        code: 'output = ""',
                        inputs: [],
                        outputs: [{ id: 'output', name: 'output', type: 'str' }],
                        state: 0
                    },
                    position: position,
                };
            } else if (type === 'FileNode') {
                newNode = {
                    id: id,
                    type: 'FileNode',
                    width: 200,
                    data: {
                        id: id,
                        title: `File ${nodeCount}`,
                        fileName: 'No file',
                        code: 'output = None',
                        inputs: [],
                        outputs: [{ id: 'output', name: 'output', type: 'file' }],
                        state: 0
                    },
                    position: position,
                };
            } else {
                // CustomNode or FastNode
                newNode = {
                    id: id,
                    type: type,
                    data: {
                        id: id,
                        code: '',
                        title: type === 'FastNode' ? `Fast Node ${nodeCount}` : `Node ${nodeCount}`,
                        inputs: [],
                        outputs: [],
                        state: 0
                    },
                    position: position,
                };
            }


            setNodes((nds) => [...nds, newNode]);
            setNodeCount((count) => count + 1);
        }


    }, [nodeCount, nodes, reactFlowInstance, setNodes]);

    // Optimisation: handler de selection stable
    const onSelectionChange = useCallback(({ nodes, edges }) => {
        setSelectedNodes(nodes || []);
        setSelectedEdges(edges || []);
    }, []);

    return (
        <FlowProvider edges={edges} nodes={nodes} setNodes={setNodes} setEdges={setEdges} wsRef={wsRef}>
            <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
                <div className="toolbar-container">
                    <button className="add-node-button" onClick={() => addNode('CustomNode')}>
                        Ajouter Node (Manuel)
                    </button>
                    <button className="add-node-button" onClick={() => addNode('FastNode')} style={{ background: '#e056fd' }}>
                        Fast Node ⚡
                    </button>
                    <button className="add-node-button" onClick={() => addNode('IntegerNode')} style={{ background: '#007bff' }}>
                        Integer 1️⃣
                    </button>
                    <button className="add-node-button" onClick={() => addNode('FloatNode')} style={{ background: '#00cec9' }}>
                        Float 0.0
                    </button>
                    <button className="add-node-button" onClick={() => addNode('BooleanNode')} style={{ background: '#fd79a8' }}>
                        Boolean ✅
                    </button>
                    <button className="add-node-button" onClick={() => addNode('StringNode')} style={{ background: '#FFC312' }}>
                        String 📝
                    </button>
                    <button className="add-node-button" onClick={() => addNode('FileNode')} style={{ background: '#5f27cd' }}>
                        File 📂
                    </button>
                    <button className="add-node-button" onClick={() => addNode('ObserverNode')} style={{ background: '#2bad60' }}>
                        Observer 👀
                    </button>
                </div>
                <button className="save-button" onClick={saveProjectToFile}>
                    Sauvegarder
                </button>
                <input
                    type="file"
                    accept=".json"
                    onChange={loadProject}
                    style={{ display: 'none' }}
                    id="loading-file-input"
                />
                <button className="import-button" onClick={handleImportClick}>
                    Importer
                </button>
                <ReactFlow
                    onInit={setReactFlowInstance}
                    nodes={nodes}
                    edges={styledEdges}
                    onSelectionChange={onSelectionChange}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnectEdge}
                    nodeTypes={NodeTypes}
                    fitView
                >
                    <Background variant="dots" gap={16} size={1} />
                    <MiniMap nodeColor={(n) => (n.type === 'CustomNode' ? '#ffcc00' : '#aaa')} position="bottom-left" />
                    <Controls position="bottom-left" />
                </ReactFlow>
            </div>
        </FlowProvider>
    );
}