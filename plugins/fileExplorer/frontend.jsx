import React, { useState, useCallback, useEffect, useRef } from 'react';
import { uiRegistry } from '../../front-editor/src/core/uiRegistry';
import './FileTree.css';

const FileIcon = ({ name, isDir, isOpen }) => {
    if (isDir) {
        return <span className="file-icon">{isOpen ? '📂' : '📁'}</span>;
    }
    const ext = name.split('.').pop().toLowerCase();
    const iconMap = {
        'py': '🐍', 'js': '📜', 'json': '📋', 'csv': '📊',
        'txt': '📄', 'md': '📝', 'png': '🖼️', 'jpg': '🖼️',
        'jpeg': '🖼️', 'gif': '🖼️', 'html': '🌐', 'css': '🎨',
        'pdf': '📕', 'zip': '📦',
    };
    return <span className="file-icon">{iconMap[ext] || '📄'}</span>;
};

const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const flattenVisible = (nodes, openDirs) => {
    const result = [];
    for (const node of nodes) {
        result.push(node.path);
        if (node.type === 'directory' && openDirs.has(node.path) && node.children) {
            result.push(...flattenVisible(node.children, openDirs));
        }
    }
    return result;
};

const TreeNode = ({ node, depth, onDelete, onRename, onMove, selected, onSelect, openDirs, toggleDir }) => {
    const [isContextMenu, setIsContextMenu] = useState(false);
    const [contextPos, setContextPos] = useState({ x: 0, y: 0 });
    const [isDragOver, setIsDragOver] = useState(false);
    const isOpen = openDirs.has(node.path);
    const isSelected = selected.has(node.path);

    const handleClick = (e) => {
        e.stopPropagation();
        onSelect(node.path, e);
    };

    const handleToggle = (e) => {
        e.stopPropagation();
        toggleDir(node.path);
    };

    const handleContextMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isSelected) {
            onSelect(node.path, e);
        }
        setIsContextMenu(true);
        setContextPos({ x: e.clientX, y: e.clientY });
    };

    const closeContextMenu = () => setIsContextMenu(false);

    const handleDragStart = (e) => {
        e.stopPropagation();
        const paths = isSelected ? [...selected] : [node.path];
        e.dataTransfer.setData('application/filetree-paths', JSON.stringify(paths));
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e) => {
        if (node.type !== 'directory') return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        setIsDragOver(true);
    };

    const handleDragLeave = (e) => {
        setIsDragOver(false);
    };

    const handleDrop = (e) => {
        if (node.type !== 'directory') return;
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        const raw = e.dataTransfer.getData('application/filetree-paths');
        if (!raw) return;
        const paths = JSON.parse(raw);
        paths.forEach((srcPath) => {
            if (srcPath === node.path) return;
            if (node.path.startsWith(srcPath + '/')) return;
            const fileName = srcPath.split('/').pop();
            const newPath = node.path + '/' + fileName;
            if (srcPath !== newPath) {
                onMove(srcPath, newPath);
            }
        });
    };

    return (
        <div className="tree-node-wrapper">
            <div
                className={`tree-node ${node.type}${isSelected ? ' selected' : ''}${isDragOver ? ' drag-over' : ''}`}
                style={{ paddingLeft: `${depth * 16 + 8}px` }}
                onClick={handleClick}
                onContextMenu={handleContextMenu}
                draggable
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                title={node.type === 'file' ? `${node.path} (${formatSize(node.size)})` : node.path}
            >
                {node.type === 'directory' && (
                    <span className="tree-chevron" onClick={handleToggle}>{isOpen ? '▼' : '▶'}</span>
                )}
                <FileIcon name={node.name} isDir={node.type === 'directory'} isOpen={isOpen} />
                <span className="file-name">{node.name}</span>
                {node.type === 'file' && (
                    <span className="file-size">{formatSize(node.size)}</span>
                )}
            </div>
            {node.type === 'directory' && isOpen && node.children && (
                <div className="tree-children">
                    {node.children.map((child) => (
                        <TreeNode
                            key={child.path}
                            node={child}
                            depth={depth + 1}
                            onDelete={onDelete}
                            onRename={onRename}
                            onMove={onMove}
                            selected={selected}
                            onSelect={onSelect}
                            openDirs={openDirs}
                            toggleDir={toggleDir}
                        />
                    ))}
                    {node.children.length === 0 && (
                        <div className="tree-empty" style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}>
                            <span className="empty-label">Empty folder</span>
                        </div>
                    )}
                </div>
            )}
            {isContextMenu && (
                <>
                    <div className="context-backdrop" onClick={closeContextMenu} />
                    <div className="context-menu" style={{ top: contextPos.y, left: contextPos.x }}>
                        {selected.size > 1 && isSelected ? (
                            <button className="context-delete" onClick={() => { onDelete([...selected]); closeContextMenu(); }}>
                                🗑️ Delete {selected.size} items
                            </button>
                        ) : (
                            <>
                                <button onClick={() => { onRename(node.path); closeContextMenu(); }}>
                                    ✏️ Rename
                                </button>
                                <button className="context-delete" onClick={() => { onDelete([node.path]); closeContextMenu(); }}>
                                    🗑️ Delete
                                </button>
                            </>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

const FileTree = ({ sendMessage }) => {
    const [tree, setTree] = useState([]);
    const [selected, setSelected] = useState(new Set());
    const [openDirs, setOpenDirs] = useState(new Set());
    const lastSelectedRef = useRef(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        const handleTreeUpdate = (e) => setTree(e.detail || []);
        window.addEventListener('fs_tree_update', handleTreeUpdate);
        return () => window.removeEventListener('fs_tree_update', handleTreeUpdate);
    }, []);

    const refreshTree = useCallback(() => {
        sendMessage({ action: "fs_list" });
    }, [sendMessage]);

    useEffect(() => { refreshTree(); }, [refreshTree]);

    const toggleDir = useCallback((path) => {
        setOpenDirs((prev) => {
            const next = new Set(prev);
            if (next.has(path)) next.delete(path);
            else next.add(path);
            return next;
        });
    }, []);

    const handleSelect = useCallback((path, e) => {
        if (e.ctrlKey || e.metaKey) {
            setSelected((prev) => {
                const next = new Set(prev);
                if (next.has(path)) next.delete(path);
                else next.add(path);
                return next;
            });
            lastSelectedRef.current = path;
        } else if (e.shiftKey && lastSelectedRef.current) {
            const flat = flattenVisible(tree, openDirs);
            const startIdx = flat.indexOf(lastSelectedRef.current);
            const endIdx = flat.indexOf(path);
            if (startIdx !== -1 && endIdx !== -1) {
                const from = Math.min(startIdx, endIdx);
                const to = Math.max(startIdx, endIdx);
                const range = flat.slice(from, to + 1);
                setSelected((prev) => {
                    const next = new Set(prev);
                    range.forEach((p) => next.add(p));
                    return next;
                });
            }
        } else {
            setSelected(new Set([path]));
            lastSelectedRef.current = path;
        }
    }, [tree, openDirs]);

    const handleDelete = useCallback((paths) => {
        const label = paths.length === 1 ? `"${paths[0]}"` : `${paths.length} items`;
        if (window.confirm(`Delete ${label}?`)) {
            paths.forEach((path) => sendMessage({ action: "fs_delete", path }));
            setSelected(new Set());
        }
    }, [sendMessage]);

    const handleRename = useCallback((path) => {
        const oldName = path.split('/').pop();
        const newName = window.prompt("New name:", oldName);
        if (newName && newName !== oldName) {
            const parts = path.split('/');
            parts[parts.length - 1] = newName;
            sendMessage({ action: "fs_rename", old_path: path, new_path: parts.join('/') });
        }
    }, [sendMessage]);

    const handleMove = useCallback((oldPath, newPath) => {
        sendMessage({ action: "fs_rename", old_path: oldPath, new_path: newPath });
    }, [sendMessage]);

    const handleNewFolder = useCallback(() => {
        const name = window.prompt("Folder name:");
        if (name) sendMessage({ action: "fs_mkdir", path: name });
    }, [sendMessage]);

    const handleUploadClick = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const handleFileUpload = useCallback((e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        Array.from(files).forEach((file) => {
            const reader = new FileReader();
            reader.onload = () => {
                sendMessage({
                    action: "fs_write",
                    path: file.name,
                    content: reader.result.split(',')[1],
                    encoding: "base64"
                });
            };
            reader.readAsDataURL(file);
        });
        e.target.value = '';
    }, [sendMessage]);

    const [rootDragOver, setRootDragOver] = useState(false);

    const handleRootDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setRootDragOver(true);
    };

    const handleRootDragLeave = () => {
        setRootDragOver(false);
    };

    const handleRootDrop = (e) => {
        e.preventDefault();
        setRootDragOver(false);
        const raw = e.dataTransfer.getData('application/filetree-paths');
        if (!raw) return;
        const paths = JSON.parse(raw);
        paths.forEach((srcPath) => {
            const fileName = srcPath.split('/').pop();
            if (srcPath !== fileName) {
                handleMove(srcPath, fileName);
            }
        });
    };

    const handleBackgroundClick = (e) => {
        if (e.target === e.currentTarget) {
            setSelected(new Set());
        }
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Delete' && selected.size > 0) {
                handleDelete([...selected]);
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
                e.preventDefault();
                const flat = flattenVisible(tree, openDirs);
                setSelected(new Set(flat));
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selected, handleDelete, tree, openDirs]);

    return (
        <div className="file-tree-container">
            <input
                ref={fileInputRef}
                type="file"
                multiple
                style={{ display: 'none' }}
                onChange={handleFileUpload}
            />
            <div className="file-tree-toolbar">
                <button onClick={refreshTree} title="Refresh">🔄</button>
                <button onClick={handleUploadClick} title="Upload Files">📤</button>
                <button onClick={handleNewFolder} title="New Folder">📁+</button>
                {selected.size > 0 && (
                    <button
                        className="toolbar-delete"
                        onClick={() => handleDelete([...selected])}
                        title={`Delete ${selected.size} selected`}
                    >
                        🗑️ {selected.size}
                    </button>
                )}
            </div>
            <div
                className="file-tree-list"
                onClick={handleBackgroundClick}
                onDragOver={handleRootDragOver}
                onDrop={handleRootDrop}
            >
                {tree.length === 0 ? (
                    <div className="tree-empty-root">
                        <span>No files yet</span>
                        <small>Upload files or run a node that writes output</small>
                    </div>
                ) : (
                    tree.map((node) => (
                        <TreeNode
                            key={node.path}
                            node={node}
                            depth={0}
                            onDelete={handleDelete}
                            onRename={handleRename}
                            onMove={handleMove}
                            selected={selected}
                            onSelect={handleSelect}
                            openDirs={openDirs}
                            toggleDir={toggleDir}
                        />
                    ))
                )}
                <div
                    className={`root-drop-zone${rootDragOver ? ' drag-over' : ''}`}
                    onDragOver={handleRootDragOver}
                    onDragLeave={handleRootDragLeave}
                    onDrop={handleRootDrop}
                >
                    ↑ Drop here to move to root
                </div>
            </div>
        </div>
    );
};

uiRegistry.registerSidebarTab({
    id: 'files',
    label: '📂 Files',
    component: FileTree
});

export default FileTree;
