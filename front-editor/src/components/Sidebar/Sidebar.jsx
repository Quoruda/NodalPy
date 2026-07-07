import React from 'react';
import { availableNodes } from '../Nodes/nodeConfig';
import { demos } from '../../utils/demos';
import { uiRegistry } from '../../core/uiRegistry';
import './Sidebar.css';

const NodePalette = ({ onDragStart }) => (
    <>
        {availableNodes.map((node) => (
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
        ))}
    </>
);

uiRegistry.registerSidebarTab({
    id: 'nodes',
    label: '🧩 Nodes',
    component: NodePalette
});

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
                            {uiRegistry.slots.sidebarTabs.map(tab => (
                                <button
                                    key={tab.id}
                                    className={sidebarView === tab.id ? 'active' : ''}
                                    onClick={() => { setSidebarView(tab.id); setIsViewOpen(false); }}
                                >
                                    {tab.label}
                                </button>
                            ))}
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
                    <h3>{uiRegistry.slots.sidebarTabs.find(t => t.id === sidebarView)?.label?.split(' ')[1] || 'Tab'}</h3>
                </div>
                <div className="sidebar-content">
                    {uiRegistry.slots.sidebarTabs.map(tab => {
                        if (sidebarView === tab.id) {
                            const Component = tab.component;
                            return <Component key={tab.id} onDragStart={onDragStart} sendMessage={sendMessage} />;
                        }
                        return null;
                    })}
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
