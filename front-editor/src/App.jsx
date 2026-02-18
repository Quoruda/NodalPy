import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ReactFlow,
    useNodesState,
    useEdgesState,
    addEdge,
    Controls,
    MiniMap,
    Background,
    ReactFlowProvider,
    useReactFlow
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './App.css';

import { NodeTypes } from './components/Nodes/NodeTypes.jsx';
import Sidebar from './components/Sidebar/Sidebar.jsx';
import { availableNodes } from './components/Nodes/nodeConfig';
import { FlowProvider } from './components/FlowContext.jsx';
import { useWebSocket } from './hooks/useWebSocket.js';
import { useProjectPersistence } from './hooks/useProjectPersistence.js';
import { useNodeFactory } from './hooks/useNodeFactory.js';
import { get, set } from 'idb-keyval';
import { toast } from 'react-toastify';
import { wouldCreateCycle } from './utils/cycleDetection.js';

const edgeTypes = {
    // default: SelfLoopEdge, // Removed: Loops forbidden
};

// Default empty state
const defaultNodes = [];
const defaultEdges = [];

function Flow() {
    const [nodes, setNodes, onNodesChange] = useNodesState(defaultNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(defaultEdges);
    const [nodeCount, setNodeCount] = useState(3);
    const [selectedEdges, setSelectedEdges] = useState([]);
    const [selectedNodes, setSelectedNodes] = useState([]);
    const [serverConfig, setServerConfig] = useState({ debounce: 50, batch_interval: 0 });

    // ✅ Use the hook to get instance methods (robust coordinate conversion)
    const { screenToFlowPosition } = useReactFlow();

    // === Custom Hooks ===
    const { isLoaded, saveProjectToIDB, saveProjectToFile, loadProjectFromFile } = useProjectPersistence(nodes, edges, setNodes, setEdges, setNodeCount);
    const { addNode } = useNodeFactory(nodes, setNodes, nodeCount, setNodeCount);
    const { wsRef, isConnected } = useWebSocket("ws://127.0.0.1:8000/ws", setNodes, setServerConfig);

    // === Event Handlers ===
    const onConnectEdge = useCallback(
        (params) => {
            if (wouldCreateCycle(nodes, edges, params)) {
                toast.error("Cycles forbidden! 🚫 Loop detected.");
                return;
            }
            setEdges((eds) => addEdge(params, eds));
        },
        [setEdges, nodes, edges]
    );

    const onSelectionChange = useCallback(({ nodes, edges }) => {
        setSelectedNodes(nodes || []);
        setSelectedEdges(edges || []);
    }, []);

    // Styled Edges
    const styledEdges = useMemo(() =>
        edges.map((edge) => ({
            ...edge,
            style: {
                stroke: selectedEdges.some(sel => sel.id === edge.id) ? '#ff0072' : '#999',
                strokeWidth: selectedEdges.some(sel => sel.id === edge.id) ? 3 : 1.5,
            },
        }))
        , [edges, selectedEdges]);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (event) => {
            // Save (Ctrl+S)
            if ((event.ctrlKey || event.metaKey) && event.key === 's') {
                event.preventDefault();
                saveProjectToFile();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [saveProjectToFile]);

    // Import/Load Handlers
    const handleImportClick = () => {
        document.getElementById('loading-file-input').click();
    };

    const handleFileLoad = (event) => {
        const file = event.target.files[0];
        if (file) {
            loadProjectFromFile(file);
        }
        event.target.value = '';
    };

    // Drag & Drop
    const onDragOver = useCallback((event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback(
        (event) => {
            event.preventDefault();
            const type = event.dataTransfer.getData('application/reactflow');

            if (typeof type === 'undefined' || !type) {
                return;
            }

            // check if the dropped element is valid
            // screenToFlowPosition handles zoom and pan automatically
            // Using logic from useReactFlow hook which is context-aware
            const position = screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });

            addNode(type, position);
        },
        [addNode, screenToFlowPosition],
    );

    if (!isLoaded) {
        return <div className="loading-screen">Loading Project...</div>;
    }

    return (
        <FlowProvider edges={edges} nodes={nodes} setNodes={setNodes} setEdges={setEdges} wsRef={wsRef} serverConfig={serverConfig} setServerConfig={setServerConfig}>
            <div style={{ width: '100vw', height: '100vh', display: 'flex' }}>
                <Sidebar onSave={saveProjectToFile} onLoad={handleImportClick} isConnected={isConnected} />
                <div style={{ flex: 1, height: '100vh', position: 'relative' }} onDrop={onDrop} onDragOver={onDragOver}>

                    {/* Hidden Input for File Loading */}
                    <input
                        type="file"
                        accept=".json"
                        onChange={handleFileLoad}
                        style={{ display: 'none' }}
                        id="loading-file-input"
                    />

                    <ReactFlow
                        nodes={nodes}
                        edges={styledEdges}
                        onSelectionChange={onSelectionChange}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnectEdge}
                        nodeTypes={NodeTypes}
                        edgeTypes={edgeTypes}
                        defaultEdgeOptions={{ type: 'default' }}
                        nodeOrigin={[0.5, 0.5]}
                        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
                    >
                        <Background variant="dots" gap={16} size={1} />
                        <MiniMap
                            nodeColor={(n) => {
                                const config = availableNodes.find(node => node.type === n.type);
                                return config ? config.color : '#aaa';
                            }}
                            position="bottom-left"
                        />
                        <Controls position="bottom-left" />
                    </ReactFlow>
                </div>
            </div>
        </FlowProvider>
    );
}

export default function App() {
    return (
        <ReactFlowProvider>
            <Flow />
        </ReactFlowProvider>
    );
}