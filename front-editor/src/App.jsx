import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
    ReactFlow,
    useNodesState,
    useEdgesState,
    addEdge,
    Controls,
    MiniMap,
    Background
} from '@xyflow/react';
import { nodeTypes } from './components/nodeTypes.jsx';

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



    const [selectedEdges, setSelectedEdges] = useState([]);
    const [selectedNodes, setSelectedNodes] = useState([]);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'Delete' || event.key === 'Backspace') {

                const activeTag = document.activeElement.tagName;
                const isTyping = activeTag === 'INPUT' || activeTag === 'TEXTAREA' || document.activeElement.isContentEditable;

                // Pour CodeMirror : il met le focus sur un élément avec la classe cm-content
                const isInCodeMirror = document.activeElement.closest('.cm-editor');

                if (isTyping || isInCodeMirror) {
                    return; // Ne rien faire si on tape dans un champ ou l'éditeur
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
        console.log(nodes);
    }, [setNodes, nodes]);


    const [ws, setWs] = useState(null);

    useEffect(() => {
      const socket = new WebSocket("ws://localhost:8000/ws");

        socket.onopen = () => console.log("✅ WebSocket connecté");
        socket.onclose = () => console.log("❌ WebSocket fermé");
        socket.onerror = (err) => console.error("⚠️ WS error", err);

        // Réception des messages du serveur
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

        return () => socket.close();
      }, [setNodes]);

      // ⚡ runCode modifié
      const runCode = useCallback((node) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          const variables = []; // comme ton code actuel qui analyse edges
          const request_data = {
            action: "run",
            code: node.code,
            variables: variables,
            node: node.id,
          };
          ws.send(JSON.stringify(request_data));

          // Mettre tout de suite en "running"
          setNodes((nds) =>
            nds.map((n) =>
              n.id === node.id ? { ...n, data: { ...n.data, state: 1, output: "" } } : n
            )
          );
        }
      }, [ws, edges, nodes, setNodes]);



    // Callback pour modifier le code d'un noeud
    const updateNodeCode = useCallback((nodeId, newCode) => {
        setNodes((nds) => nds.map((node) =>
            node.id === nodeId
                ? { ...node, data: { ...node.data, code: newCode, onChange: updateNodeCode } }
                : node
        ));
    }, [setNodes]);



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
            stroke: edge.id === selectedEdges?.id ? '#ff0072' : '#999',
            strokeWidth: edge.id === selectedEdges?.id ? 3 : 1.5,
        },
    }));


    // Injecte updateNodeCode dans chaque noeud existant au démarrage
    const preparedNodes = useMemo(() => nodes.map((node) => ({
        ...node,
        data: {
            ...node.data,
            id: node.id,
            onChange: updateNodeCode,
            onUpdate: updateNode,
            runCode: runCode,

        },
    })), [nodes, updateNodeCode, updateNode, runCode]);

    return (
        <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
            <button className="add-node-button" onClick={addNode}>
                Ajouter un nœud
            </button>

            <ReactFlow
                nodes={preparedNodes}
                edges={styledEdges}
                onSelectionChange={({ nodes, edges }) => {
                    setSelectedNodes(nodes || []);
                    setSelectedEdges(edges || []);
                }}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                fitView
                onNodeDragStop={(event, node) => {
                      setNodes((nds) =>
                          nds.map((n) =>
                              n.id === node.id ? { ...n, position: node.position } : n
                          )
                      );
                  }}
            >
                <Background variant="dots" gap={16} size={1} />
                <MiniMap nodeColor={(n) => (n.type === 'functionNode' ? '#ffcc00' : '#aaa')} />
                <Controls />
            </ReactFlow>
        </div>
    );
}
