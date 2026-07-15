import React, { useState, useRef, useEffect, useCallback } from 'react';
import './ProjectTabs.css';

const ProjectTabs = ({
    openTabs,
    activeProjectId,
    onSwitchTab,
    onCloseTab,
    onCreateProject,
    onDeleteProject,
    onRenameProject,
    allProjects,
    onOpenProject
}) => {
    const [editingTabId, setEditingTabId] = useState(null);
    const [editValue, setEditValue] = useState('');
    const [contextMenu, setContextMenu] = useState(null);
    const [showProjectPicker, setShowProjectPicker] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(null);
    const editInputRef = useRef(null);
    const pickerRef = useRef(null);

    const handleInputRef = useCallback((node) => {
        if (node) {
            node.focus();
            node.select();
        }
        editInputRef.current = node;
    }, []);

    // Close picker on outside click
    useEffect(() => {
        if (!showProjectPicker) return;
        const handler = (e) => {
            if (pickerRef.current && !pickerRef.current.contains(e.target)) {
                setShowProjectPicker(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showProjectPicker]);

    // Close context menu on any click
    useEffect(() => {
        if (!contextMenu) return;
        const handler = () => setContextMenu(null);
        document.addEventListener('click', handler);
        return () => document.removeEventListener('click', handler);
    }, [contextMenu]);

    const startRename = useCallback((tab) => {
        if (!openTabs.some(t => t.id === tab.id)) {
            onOpenProject(tab.id, tab.name);
        }
        setEditingTabId(tab.id);
        setEditValue(tab.name);
        setContextMenu(null);
    }, [openTabs, onOpenProject]);

    const commitRename = useCallback(() => {
        if (editingTabId && editValue.trim()) {
            onRenameProject(editingTabId, editValue.trim());
        }
        setEditingTabId(null);
    }, [editingTabId, editValue, onRenameProject]);

    const handleContextMenu = useCallback((e, tab) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, tab });
    }, []);

    const handleDeleteClick = useCallback((tab) => {
        setConfirmDelete(tab);
        setContextMenu(null);
    }, []);

    const unopenedProjects = allProjects.filter(
        p => !openTabs.some(t => t.id === p.id)
    );

    return (
        <div className="project-tabs-bar">
            <div className="project-tabs-scroll">
                {openTabs.map(tab => (
                    <div
                        key={tab.id}
                        className={`project-tab ${tab.id === activeProjectId ? 'active' : ''}`}
                        onClick={() => onSwitchTab(tab.id)}
                        onDoubleClick={() => startRename(tab)}
                        onContextMenu={(e) => handleContextMenu(e, tab)}
                        onMouseDown={(e) => {
                            if (e.button === 1) {
                                e.preventDefault();
                                onCloseTab(tab.id);
                            }
                        }}
                    >
                        <span className="project-tab-icon">📄</span>
                        {editingTabId === tab.id ? (
                            <input
                                ref={handleInputRef}
                                className="project-tab-edit"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={commitRename}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') commitRename();
                                    if (e.key === 'Escape') setEditingTabId(null);
                                }}
                                onClick={(e) => e.stopPropagation()}
                            />
                        ) : (
                            <span className="project-tab-name">{tab.name}</span>
                        )}
                        {openTabs.length > 1 && (
                            <button
                                className="project-tab-close"
                                onClick={(e) => { e.stopPropagation(); onCloseTab(tab.id); }}
                                title="Close tab"
                            >×</button>
                        )}
                    </div>
                ))}
            </div>

            <div className="project-tabs-actions" ref={pickerRef}>
                <button
                    className="project-tab-add"
                    onClick={() => setShowProjectPicker(prev => !prev)}
                    title="New or open project"
                >＋</button>

                {showProjectPicker && (
                    <div className="project-picker">
                        <button
                            className="project-picker-new"
                            onClick={() => { onCreateProject(); setShowProjectPicker(false); }}
                        >
                            ✨ New Project
                        </button>
                        {unopenedProjects.length > 0 && (
                            <>
                                <div className="project-picker-divider" />
                                <div className="project-picker-label">Open existing</div>
                                {unopenedProjects.map(p => (
                                    <button
                                        key={p.id}
                                        className="project-picker-item"
                                        onClick={() => { onOpenProject(p.id, p.name); setShowProjectPicker(false); }}
                                        onContextMenu={(e) => { e.preventDefault(); handleContextMenu(e, p); setShowProjectPicker(false); }}
                                    >
                                        📄 {p.name}
                                    </button>
                                ))}
                            </>
                        )}
                    </div>
                )}
            </div>

            {contextMenu && (
                <div
                    className="project-tab-context-menu"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                >
                    <button onClick={() => startRename(contextMenu.tab)}>
                        ✏️ Rename
                    </button>
                    <button
                        className="danger"
                        onClick={() => handleDeleteClick(contextMenu.tab)}
                    >
                        🗑️ Delete
                    </button>
                </div>
            )}

            {confirmDelete && (
                <div className="project-delete-overlay" onClick={() => setConfirmDelete(null)}>
                    <div className="project-delete-dialog" onClick={(e) => e.stopPropagation()}>
                        <p>Delete project <strong>"{confirmDelete.name}"</strong>?</p>
                        <p className="project-delete-warning">This action cannot be undone.</p>
                        <div className="project-delete-actions">
                            <button onClick={() => setConfirmDelete(null)}>Cancel</button>
                            <button
                                className="danger"
                                onClick={() => { onDeleteProject(confirmDelete.id); setConfirmDelete(null); }}
                            >Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProjectTabs;
