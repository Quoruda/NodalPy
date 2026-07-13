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
import MissingPluginNode from './components/Nodes/MissingPluginNode.jsx';
import Sidebar from './components/Sidebar/Sidebar.jsx';
import { availableNodes } from './components/Nodes/nodeConfig';
import { FlowProvider } from './components/FlowContext.jsx';
import { useWebSocket } from './hooks/useWebSocket.js';
import { useProjectPersistence } from './hooks/useProjectPersistence.js';
import { useNodeFactory } from './hooks/useNodeFactory.js';
import { useHistory } from './hooks/useHistory.js';
import { useClipboard } from './hooks/useClipboard.js';
import { usePluginShortcuts } from './hooks/usePluginShortcuts.js';
import { toast } from 'react-toastify';
import { wouldCreateCycle } from './utils/cycleDetection.js';
import.meta.glob('../../plugins/*/frontend.jsx', { eager: true });
import { uiRegistry } from './core/uiRegistry';

const edgeTypes = {};

const defaultNodes = [];
const defaultEdges = [];

function Flow() {
    const [nodes, setNodes, onNodesChange] = useNodesState(defaultNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(defaultEdges);
    const [selectedEdges, setSelectedEdges] = useState([]);
    const [selectedNodes, setSelectedNodes] = useState([]);
    const [serverConfig, setServerConfig] = useState({ debounce: 50, batch_interval: 0 });
    const [sidebarView, setSidebarView] = useState('nodes');

    const { screenToFlowPosition } = useReactFlow();

    const wsUrl = import.meta.env.VITE_WS_URL || "ws://127.0.0.1:8000/ws";

    const { wsRef, isConnected, sendMessage } = useWebSocket(wsUrl, setNodes, setServerConfig, (data) => loadProject(data));
    const { isLoaded, loadProject, saveProjectToFile, loadProjectFromFile } = useProjectPersistence(nodes, edges, setNodes, setEdges, isConnected, sendMessage);
    const { addNode } = useNodeFactory(nodes, setNodes);

    const { takeSnapshot } = useHistory(nodes, edges, setNodes, setEdges);
    useClipboard(nodes, edges, selectedNodes, selectedEdges, setNodes, setEdges, takeSnapshot);
    usePluginShortcuts({ nodes, edges, selectedNodes, selectedEdges, setNodes, setEdges, takeSnapshot });

    const handleNodesChange = useCallback((changes) => {
        const shouldSnapshot = changes.some(c =>
            c.type === 'remove' || c.type === 'add' || c.type === 'replace'
        );
        if (shouldSnapshot) takeSnapshot();
        onNodesChange(changes);
        uiRegistry.fireCallbacks('onNodesChange', changes, contextRef.current);
    }, [onNodesChange, takeSnapshot]);

    const handleEdgesChange = useCallback((changes) => {
        const shouldSnapshot = changes.some(c => c.type === 'remove' || c.type === 'add');
        if (shouldSnapshot) takeSnapshot();
        onEdgesChange(changes);
    }, [onEdgesChange, takeSnapshot]);

    const onNodeDragStart = useCallback(() => {
        takeSnapshot();
    }, [takeSnapshot]);

    const contextRef = React.useRef({ nodes, edges, selectedNodes, selectedEdges, setNodes, setEdges, takeSnapshot });
    React.useEffect(() => {
        contextRef.current = { nodes, edges, selectedNodes, selectedEdges, setNodes, setEdges, takeSnapshot };
    });

    const onNodeDragStop = useCallback((_event, node) => {
        uiRegistry.fireCallbacks('onNodeDragStop', _event, node, contextRef.current);
    }, []);

    const onNodeDrag = useCallback((_event, node) => {
        uiRegistry.fireCallbacks('onNodeDrag', _event, node, contextRef.current);
    }, []);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.closest('.cm-editor') || event.target.closest('.nodrag')) {
                return;
            }
            if ((event.ctrlKey || event.metaKey) && event.key === 's') {
                event.preventDefault();
                saveProjectToFile();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [saveProjectToFile]);

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

    const onConnectEdge = useCallback(
        (params) => {
            if (wouldCreateCycle(nodes, edges, params)) {
                toast.error("Cycles forbidden! 🚫 Loop detected.");
                return;
            }
            takeSnapshot();
            setEdges((eds) => addEdge(params, eds));
        },
        [setEdges, nodes, edges, takeSnapshot]
    );

    const onSelectionChange = useCallback(({ nodes, edges }) => {
        setSelectedNodes(nodes || []);
        setSelectedEdges(edges || []);
    }, []);

    const styledEdges = useMemo(() =>
        edges.map((edge) => ({
            ...edge,
            style: {
                stroke: selectedEdges.some(sel => sel.id === edge.id) ? '#ff0072' : '#999',
                strokeWidth: selectedEdges.some(sel => sel.id === edge.id) ? 3 : 1.5,
            },
        }))
        , [edges, selectedEdges]);

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

            const position = screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });

            takeSnapshot();
            addNode(type, position);
        },
        [addNode, screenToFlowPosition, takeSnapshot],
    );

    const allNodeTypes = useMemo(() => {
        const types = { 
            ...NodeTypes,
            missingPlugin: MissingPluginNode 
        };
        uiRegistry.slots.nodeTypes.forEach(n => {
            types[n.type] = n.component;
        });
        return types;
    }, []);

    if (!isLoaded) {
        return <div className="loading-screen">Loading Project...</div>;
    }

    return (
        <FlowProvider edges={edges} nodes={nodes} setNodes={setNodes} setEdges={setEdges} wsRef={wsRef} sendMessage={sendMessage} isConnected={isConnected} serverConfig={serverConfig} setServerConfig={setServerConfig}>
            <div style={{ width: '100vw', height: '100vh', display: 'flex' }}>
                <Sidebar
                    onLoadDemo={loadProject}
                    onImport={handleImportClick}
                    onExport={saveProjectToFile}
                    isConnected={isConnected}
                    sendMessage={sendMessage}
                    sidebarView={sidebarView}
                    setSidebarView={setSidebarView}
                />
                <div style={{ flex: 1, height: '100vh', position: 'relative' }} onDrop={onDrop} onDragOver={onDragOver}>
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
                        onNodesChange={handleNodesChange}
                        onEdgesChange={handleEdgesChange}
                        onNodeDragStart={onNodeDragStart}
                        onNodeDrag={onNodeDrag}
                        onNodeDragStop={onNodeDragStop}
                        onConnect={onConnectEdge}
                        nodeTypes={allNodeTypes}
                        edgeTypes={edgeTypes}
                        defaultEdgeOptions={{ type: 'default' }}
                        nodeOrigin={[0.5, 0.5]}
                        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
                    >
                        <Background variant="dots" gap={16} size={1} />
                        <MiniMap
                            nodeColor={(n) => {
                                const allConfigs = [
                                    ...availableNodes,
                                    ...uiRegistry.slots.nodeTypes.map(node => node.config)
                                ];
                                const config = allConfigs.find(node => node.type === n.type);
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