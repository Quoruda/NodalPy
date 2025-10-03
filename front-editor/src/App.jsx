import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
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

const initialNodes = [];
const initialEdges = [];

export default function App() {
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [nodeCount, setNodeCount] = useState(3);
    const [selectedEdges, setSelectedEdges] = useState([]);
    const [selectedNodes, setSelectedNodes] = useState([]);
    const [reactFlowInstance, setReactFlowInstance] = useState(null);

    const {wsRef} = useWebSocket("ws://localhost:8000/ws", setNodes);

    const onConnectEdge = useCallback(
        (params) => setEdges((eds) => addEdge(params, eds)),
        [setEdges]
    );

    /*
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

     */

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
                    newNodes.splice(0,nodes.length);
                    for(let node of data.nodes){
                        node.data.state = 0;
                        newNodes.push(node);
                    }

                    let newEdges = [];
                    edges.splice(0,edges.length);
                    for(let edge of data.edges){
                        newEdges.push(edge);
                    }
                    setNodes(newNodes);
                    setEdges(newEdges);

                    console.log("Projet chargé avec succès");

                    if(wsRef.current){
                        setTimeout(() => wsRef.current.send({"action":  "get_ouput"}), 0.1)
                    }

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
    }, [nodes.length, edges, setNodes, setEdges, wsRef]);

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

    const generateUniqueId = () => {
        return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    };

    // Optimisation: addNode stable
    const addNode = useCallback(() => {
        const id = generateUniqueId();
        if(!reactFlowInstance) return;

        console.log(reactFlowInstance)

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

            while(!canBePlaced){
                canBePlaced = true
                for(let node of nodes){
                    if(node.position.x === position.x && node.position.y === position.y){
                        console.log("TRUE")
                        canBePlaced = false;
                    }
                }
                if(!canBePlaced){
                    position.x += 50;
                    position.y += 50;
                }
            }

            const newNode = {
                id: id,
                type: 'CustomNode',
                data: {
                    id: id,
                    code: '',
                    title: `Node ${nodeCount}`,
                    inputs: [],
                    outputs: [],
                    state: 0
                },
                position: position,

            };
            setNodes((nds) => [...nds, newNode]);
            setNodeCount((count) => count + 1);
        }


    }, [nodeCount, nodes, reactFlowInstance, setNodes]);

    // Optimisation: handler de selection stable
    const onSelectionChange = useCallback(({ nodes, edges }) => {
        setSelectedNodes(nodes || []);
        setSelectedEdges(edges || []);
    }, []);

    console.log(nodes);

    return (
        <FlowProvider edges={edges} nodes={nodes} setNodes={setNodes} setEdges={setEdges}>
        <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
            <button className="add-node-button" onClick={addNode}>
                Ajouter un nœud
            </button>
            <button className="save-button" onClick={saveProject}>
                Sauvegarder
            </button>
            <input
                type="file"
                accept=".json"
                onChange={loadProject}
                style={{display: 'none'}}
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
                    <MiniMap nodeColor={(n) => (n.type === 'CustomNode' ? '#ffcc00' : '#aaa')} position="bottom-left"/>
                    <Controls position="bottom-left"/>
                </ReactFlow>
        </div>
        </FlowProvider>
    );
}