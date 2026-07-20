import React, { useMemo, useState } from 'react';
import {
    ReactFlow,
    useNodesState,
    useEdgesState,
    Controls,
    MiniMap,
    Background,
    ReactFlowProvider,
    useReactFlow
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './App.css';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './components/Auth/LoginPage.jsx';
import RegisterPage from './components/Auth/RegisterPage.jsx';
import { useAuthStore } from './store/useAuthStore.js';

import { NodeTypes } from './components/Nodes/NodeTypes.jsx';
import MissingPluginNode from './components/Nodes/MissingPluginNode.jsx';
import Sidebar from './components/Sidebar/Sidebar.jsx';
import ProjectTabs from './components/ProjectTabs/ProjectTabs.jsx';
import { availableNodes } from './components/Nodes/nodeConfig';
import { FlowProvider } from './components/FlowContext.jsx';
import { useWebSocket } from './hooks/useWebSocket.js';
import { useProjectPersistence } from './hooks/useProjectPersistence.js';
import { useNodeFactory } from './hooks/useNodeFactory.js';
import { useHistory } from './hooks/useHistory.js';
import { useClipboard } from './hooks/useClipboard.js';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts.js';
import { useFlowEvents } from './hooks/useFlowEvents.js';
import './core/pluginLoader.js';
import { uiRegistry } from './core/uiRegistry';

const edgeTypes = {};

const defaultNodes = [];
const defaultEdges = [];

function Flow() {
    const [nodes, setNodes, onNodesChange] = useNodesState(defaultNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(defaultEdges);
    const [selectedEdges, setSelectedEdges] = useState([]);
    const [selectedNodes, setSelectedNodes] = useState([]);
    const [serverConfig, setServerConfig] = useState({ core: { debounce: 50, batch_interval: 0 }, plugins: {} });
    const [sidebarView, setSidebarView] = useState('nodes');

    const { screenToFlowPosition } = useReactFlow();

    const wsUrl = import.meta.env.VITE_WS_URL || "ws://127.0.0.1:8000/ws";

    const { wsRef, isConnected, sendMessage } = useWebSocket(wsUrl, setNodes, setServerConfig);
    const {
        isLoaded,
        openTabs,
        activeProjectId,
        allProjects,
        switchToProject,
        openProject,
        closeTab,
        createProject,
        deleteProject,
        renameProject,
        saveProjectToFile,
        loadProjectFromFile,
        loadProjectFromData
    } = useProjectPersistence(nodes, edges, setNodes, setEdges, isConnected, sendMessage);
    const { addNode } = useNodeFactory(nodes, setNodes);

    const { takeSnapshot } = useHistory(nodes, edges, setNodes, setEdges);
    useClipboard(nodes, edges, selectedNodes, selectedEdges, setNodes, setEdges, takeSnapshot);
    useKeyboardShortcuts(
        { nodes, edges, selectedNodes, selectedEdges, setNodes, setEdges, takeSnapshot },
        { saveProjectToFile }
    );

    const {
        handleNodesChange,
        handleEdgesChange,
        onNodeDragStart,
        onNodeDragStop,
        onNodeDrag,
        onConnectEdge,
        onSelectionChange,
        onDragOver,
        onDrop
    } = useFlowEvents({
        nodes, edges, selectedNodes, selectedEdges,
        setNodes, setEdges,
        onNodesChange, onEdgesChange,
        takeSnapshot,
        addNode,
        screenToFlowPosition,
        setSelectedNodes, setSelectedEdges
    });

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

    const styledEdges = useMemo(() =>
        edges.map((edge) => ({
            ...edge,
            style: {
                stroke: selectedEdges.some(sel => sel.id === edge.id) ? '#ff0072' : '#999',
                strokeWidth: selectedEdges.some(sel => sel.id === edge.id) ? 3 : 1.5,
            },
        }))
        , [edges, selectedEdges]);

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
                    onLoadDemo={loadProjectFromData}
                    onImport={handleImportClick}
                    onExport={saveProjectToFile}
                    onNewProject={createProject}
                    isConnected={isConnected}
                    sendMessage={sendMessage}
                    sidebarView={sidebarView}
                    setSidebarView={setSidebarView}
                />
                <div style={{ flex: 1, height: '100vh', display: 'flex', flexDirection: 'column' }}>
                    <ProjectTabs
                        openTabs={openTabs}
                        activeProjectId={activeProjectId}
                        onSwitchTab={switchToProject}
                        onCloseTab={closeTab}
                        onCreateProject={createProject}
                        onDeleteProject={deleteProject}
                        onRenameProject={renameProject}
                        allProjects={allProjects}
                        onOpenProject={openProject}
                    />
                    <div style={{ flex: 1, position: 'relative' }} onDrop={onDrop} onDragOver={onDragOver}>
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
            </div>
        </FlowProvider>
    );
}

export default function App() {
    const token = useAuthStore(state => state.token);

    return (
        <Router>
            <Routes>
                <Route path="/login" element={!token ? <LoginPage /> : <Navigate to="/" />} />
                <Route path="/register" element={!token ? <RegisterPage /> : <Navigate to="/" />} />
                <Route path="/" element={token ? (
                    <ReactFlowProvider>
                        <Flow />
                    </ReactFlowProvider>
                ) : <Navigate to="/login" />} />
            </Routes>
        </Router>
    );
}