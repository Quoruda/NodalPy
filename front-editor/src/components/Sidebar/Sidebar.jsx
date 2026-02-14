import React from 'react';
import { availableNodes } from '../Nodes/nodeConfig';
import './Sidebar.css';

const Sidebar = ({ onSave, onLoad }) => {
    const [isFileOpen, setIsFileOpen] = React.useState(false);

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
                            <button onClick={() => { onSave(); setIsFileOpen(false); }}>
                                Save Project
                            </button>
                            <button onClick={() => { onLoad(); setIsFileOpen(false); }}>
                                Open Project
                            </button>
                        </div>
                    )}
                </div>
                {/* Placeholders for future menus */}
                <div className="menu-item disabled">
                    <span className="menu-label">View</span>
                </div>
                <div className="menu-item disabled">
                    <span className="menu-label">Settings</span>
                </div>
            </div>

            {/* Nodes Section */}
            <div className="sidebar-section flex-grow">
                <div className="sidebar-header">
                    <h3>Nodes</h3>
                </div>
                <div className="sidebar-content">
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
                </div>
            </div>

            <div className="sidebar-footer">
                <small>Drag & Drop UI</small>
            </div>
        </aside>
    );
};

export default Sidebar;
