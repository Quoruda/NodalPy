import React from 'react';
import { availableNodes } from '../Nodes/nodeConfig';
import { demos } from '../../utils/demos';
import FileTree from '../FileTree/FileTree.jsx';
import './Sidebar.css';

const Sidebar = ({ onLoadDemo, isConnected, sendMessage, sidebarView, setSidebarView }) => {
    const [isFileOpen, setIsFileOpen] = React.useState(false);
    const [isViewOpen, setIsViewOpen] = React.useState(false);

    const onDragStart = (event, nodeType) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.effectAllowed = 'move';
    };

    return (
        <aside className="sidebar">
            {/* Menu Bar */}
            <div className="sidebar-menubar">
                <div
                    className="menu-item"
                    onMouseEnter={() => setIsFileOpen(true)}
                    onMouseLeave={() => setIsFileOpen(false)}
                >
                    <span className="menu-label">File</span>
                    {isFileOpen && (
                        <div className="floating-menu">
                            <div className="submenu-container">
                                <button className="submenu-trigger">
                                    Demos & Examples ▶
                                </button>
                                <div className="floating-submenu">
                                    {Object.keys(demos).map(demoName => (
                                        <button key={demoName} onClick={() => { onLoadDemo(demos[demoName]); setIsFileOpen(false); }}>
                                            {demoName}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <div
                    className="menu-item"
                    onMouseEnter={() => setIsViewOpen(true)}
                    onMouseLeave={() => setIsViewOpen(false)}
                >
                    <span className="menu-label">View</span>
                    {isViewOpen && (
                        <div className="floating-menu">
                            <button
                                className={sidebarView === 'nodes' ? 'active' : ''}
                                onClick={() => { setSidebarView('nodes'); setIsViewOpen(false); }}
                            >
                                🧩 Nodes
                            </button>
                            <button
                                className={sidebarView === 'files' ? 'active' : ''}
                                onClick={() => { setSidebarView('files'); setIsViewOpen(false); }}
                            >
                                📂 Files
                            </button>
                        </div>
                    )}
                </div>
                <div className="menu-item disabled">
                    <span className="menu-label">Settings</span>
                </div>
            </div>

            {/* View Content */}
            <div className="sidebar-section flex-grow">
                <div className="sidebar-header">
                    <h3>{sidebarView === 'nodes' ? 'Nodes' : 'Files'}</h3>
                </div>
                <div className="sidebar-content">
                    {sidebarView === 'nodes' ? (
                        availableNodes.map((node) => (
                            <div
                                key={node.type}
                                className="sidebar-node"
                                onDragStart={(event) => onDragStart(event, node.type)}
                                draggable
                                style={{
                                    '--node-color': `var(${node.colorVar})`
                                }}
                            >
                                {node.icon && <span className="sidebar-node-icon">{node.icon}</span>}
                                <span className="sidebar-node-label">{node.label}</span>
                            </div>
                        ))
                    ) : (
                        <FileTree sendMessage={sendMessage} />
                    )}
                </div>
            </div>

            <div className="sidebar-footer">
                <div className="connection-status">
                    <span className={`status-dot ${isConnected ? 'online' : 'offline'}`}></span>
                    <small>{isConnected ? 'Online' : 'Offline'}</small>
                </div>
                <small>Drag & Drop UI</small>
            </div>
        </aside>
    );
};

export default Sidebar;
