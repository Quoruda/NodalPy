import React, { memo, useState, useEffect, useCallback, useRef } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useCodeNode } from '../useCodeNode.js';
import './FileNode.css';

const FileNode = memo(({ id, data, selected }) => {
    // Reuse useCodeNode for backend communication logic
    const nodeState = useCodeNode({ ...data, id }, { timeout: 0.5, autoTrigger: true });
    const { runCode, updateNode } = nodeState;

    // Local state
    const [localTitle, setLocalTitle] = useState(data.title || 'Import File');
    const [fileName, setFileName] = useState(data.fileName || null);
    const [fileSize, setFileSize] = useState(data.fileSize || null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    const fileInputRef = useRef(null);

    // Initial sync
    useEffect(() => {
        if (data.fileName) setFileName(data.fileName);
        if (data.fileSize) setFileSize(data.fileSize);
    }, [data.fileName, data.fileSize]);

    // Handle Title Change
    const handleTitleChange = useCallback((e) => {
        const newTitle = e.target.value;
        setLocalTitle(newTitle);
        updateNode(id, { title: newTitle });
    }, [id, updateNode]);

    const formatFileSize = (bytes) => {
        if (!bytes) return '';
        if (bytes < 1024) return bytes + ' B';
        else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        else return (bytes / 1048576).toFixed(1) + ' MB';
    };

    const handleFileUpload = useCallback(async (file) => {
        if (!file) return;

        setIsUploading(true);
        const userId = localStorage.getItem("nodal_user_id") || "guest";

        const formData = new FormData();
        formData.append('file', file);
        formData.append('user_id', userId);
        formData.append('node_id', id);

        try {
            const response = await fetch('http://127.0.0.1:8000/upload', {
                method: 'POST',
                body: formData,
            });

            if (response.ok) {
                const result = await response.json();
                console.log("Upload success:", result);

                // Update Node Data
                const newPath = result.path.replace(/\\/g, '/'); // Normalize path
                // Python string for path
                const newCode = `output = r"${newPath}"`;

                setFileName(file.name);
                setFileSize(file.size);

                updateNode(id, {
                    code: newCode,
                    fileName: file.name,
                    fileSize: file.size,
                    value: newPath
                });

                // Trigger execution
                runCode({ code: newCode });
            } else {
                console.error("Upload failed");
            }
        } catch (error) {
            console.error("Error uploading file:", error);
        } finally {
            setIsUploading(false);
        }
    }, [id, updateNode, runCode]);

    // Drag & Drop Handlers
    const onDragOver = useCallback((e) => {
        e.preventDefault();
        setIsDragOver(true);
    }, []);

    const onDragLeave = useCallback((e) => {
        e.preventDefault();
        setIsDragOver(false);
    }, []);

    const onDrop = useCallback((e) => {
        e.preventDefault();
        setIsDragOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileUpload(e.dataTransfer.files[0]);
        }
    }, [handleFileUpload]);

    const handleFileSelect = useCallback((e) => {
        if (e.target.files && e.target.files[0]) {
            handleFileUpload(e.target.files[0]);
        }
    }, [handleFileUpload]);

    const removeFile = useCallback((e) => {
        e.stopPropagation();
        setFileName(null);
        setFileSize(null);
        updateNode(id, {
            code: `output = None`,
            fileName: null,
            fileSize: null,
            value: null
        });
        runCode({ code: `output = None` });
    }, [id, updateNode, runCode]);

    // Stop propagation
    const stopPropagation = useCallback((e) => e.stopPropagation(), []);

    if (isUploading) {
        return (
            <div className={`file-node ${selected ? 'selected' : ''}`}>
                <div className="file-header">
                    <span className="file-title">Uploading...</span>
                </div>
                <div className="file-content">
                    <div className="loader">Loading...</div>
                </div>
            </div>
        )
    }

    return (
        <div
            className={`file-node ${selected ? 'selected' : ''} ${isDragOver ? 'drag-over' : ''}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
        >
            {/* Header with Icon and Title */}
            <div className="file-header">
                <div className="title-section">
                    <div className="file-icon">
                        <div className="folder">
                            <div className="folder-tab"></div>
                            <div className="folder-back"></div>
                            <div className="folder-arrow">↑</div>
                        </div>
                    </div>
                    <input
                        type="text"
                        className="title-input nodrag"
                        placeholder="Title"
                        value={localTitle}
                        onChange={handleTitleChange}
                        onKeyDown={stopPropagation}
                    />
                </div>
            </div>

            <div className="file-content">
                {!fileName ? (
                    <div
                        className="drop-zone nodrag"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <div className="drop-icon">📁</div>
                        <div className="drop-text">
                            <strong>Drop file here</strong> or click
                        </div>
                        <button className="browse-button">Browse Files</button>
                    </div>
                ) : (
                    <div className="file-info active nodrag">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ overflow: 'hidden' }}>
                                <div className="file-name" title={fileName}>{fileName}</div>
                                <div className="file-details">
                                    <span className="file-type">{fileName.split('.').pop().toUpperCase()}</span>
                                    <span>{formatFileSize(fileSize)}</span>
                                </div>
                            </div>
                            <button className="remove-file" onClick={removeFile}>✕</button>
                        </div>
                    </div>
                )}

                <input
                    type="file"
                    ref={fileInputRef}
                    className="file-input"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                />
            </div>

            <Handle
                type="source"
                position={Position.Right}
                id="output"
                className="file-handle"
            />
        </div>
    );
});

export default FileNode;
