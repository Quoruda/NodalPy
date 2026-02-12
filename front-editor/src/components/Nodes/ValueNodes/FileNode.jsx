import React, { memo, useState, useEffect, useCallback, useRef } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useCodeNode } from '../useCodeNode.js';
import './ValueNode.css';

const FileNode = memo(({ data }) => {
    const nodeState = useCodeNode(data, 0.5);
    const { runCode, updateNode, triggerDownstreamNodes } = nodeState;

    // Use a reference to track if the node is mounted to avoid state updates on unmounted component
    const isMounted = useRef(true);
    useEffect(() => {
        return () => { isMounted.current = false; };
    }, []);

    const [fileName, setFileName] = useState(data.fileName || "No file selected");
    const [uploading, setUploading] = useState(false);

    // Sync if data changes from outside (e.g. undo/redo)
    useEffect(() => {
        if (data.fileName && data.fileName !== fileName) {
            setFileName(data.fileName);
        }
    }, [data.fileName]);

    const handleFileChange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setUploading(true);
        setFileName(file.name); // Optimistic UI update

        const userId = localStorage.getItem("nodal_user_id");
        if (!userId) {
            alert("User ID not found. Please reload the page.");
            setUploading(false);
            return;
        }

        const formData = new FormData();
        formData.append("file", file);
        formData.append("user_id", userId);
        formData.append("node_id", data.id);

        try {
            // Determine backend URL (assuming relative path proxy or same origin)
            // In dev, Vite proxies /api to port 8000. Here we might need direct port if not proxied.
            // But usually we use relative "/upload" if served together, or http://localhost:8000/upload
            // Ideally should be configurable. For now, assuming standard setup.
            const uploadUrl = "http://127.0.0.1:8000/upload";

            const response = await fetch(uploadUrl, {
                method: "POST",
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Upload failed: ${response.statusText}`);
            }

            const result = await response.json();

            if (result.error) {
                throw new Error(result.error);
            }

            if (isMounted.current) {
                // Update Node Data
                const newCode = `output = r"${result.path}"`; // Raw string for paths

                updateNode(data.id, {
                    fileName: result.filename,
                    filePath: result.path, // Store path in data provided useful
                    value: result.path,
                    code: newCode
                });

                // Run immediately
                // Small delay to ensure state update propagates?
                // The fix in "CustomNodeOperations" ensures runCode sees updated data.
                setTimeout(() => runCode(), 50);
            }

        } catch (error) {
            console.error("Upload error:", error);
            if (isMounted.current) setFileName("Upload failed ❌");
        } finally {
            if (isMounted.current) setUploading(false);
        }
    };

    // Trigger downstream
    const prevStateRef = useRef(data.state);
    useEffect(() => {
        if (data.state === 2 && !data.error && prevStateRef.current !== 2) {
            triggerDownstreamNodes(data.id);
        }
        prevStateRef.current = data.state;
    }, [data.state, data.error, data.id, triggerDownstreamNodes]);

    // Auto-run on mount if code exists
    useEffect(() => {
        if (data.code && data.code.startsWith('output =')) {
            runCode();
        }
    }, []);

    return (
        <div className="value-node-container" style={{ minWidth: '200px' }}>
            <div className="value-node-header" style={{ background: '#5f27cd' }}>
                <span className="value-node-title">{data.title || 'File'}</span>
            </div>

            <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label className="custom-file-upload" style={{
                    cursor: 'pointer',
                    background: '#ecf0f1',
                    padding: '6px 12px',
                    borderRadius: '4px',
                    textAlign: 'center',
                    color: '#2c3e50',
                    fontWeight: 'bold',
                    fontSize: '0.9em'
                }}>
                    <input type="file" onChange={handleFileChange} style={{ display: 'none' }} />
                    {uploading ? "Uploading..." : "📁 Choose File"}
                </label>

                <div style={{
                    fontSize: '0.8em',
                    color: '#bdc3c7',
                    wordBreak: 'break-all',
                    textAlign: 'center'
                }}>
                    {fileName}
                </div>
            </div>

            <Handle
                type="source"
                position={Position.Right}
                id="output"
                className="value-node-handle"
            />
        </div>
    );
});

export default FileNode;
