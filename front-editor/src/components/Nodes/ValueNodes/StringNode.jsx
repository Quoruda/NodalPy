import React, { memo, useState, useEffect, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useCodeNode } from '../useCodeNode.js';
import '../NodeShell.css'; // Shared styles
import './StringNode.css';

const StringNode = memo(({ id, data, selected }) => {
    // Reuse useCodeNode for backend communication logic
    const nodeState = useCodeNode({ ...data, id }, { timeout: 0.5, autoTrigger: true });
    const { runCode, updateNode } = nodeState;

    // Local state
    const [localValue, setLocalValue] = useState('');
    const [localTitle, setLocalTitle] = useState(data.title || 'String');

    // Parse code
    useEffect(() => {
        if (data.code) {
            const match = data.code.match(/output\s*=\s*(["'])(.*)\1/);
            if (match) setLocalValue(match[2]);
        }
    }, [data.code]);

    // Auto-run
    useEffect(() => {
        if (data.fromLoad) return;
        const timer = setTimeout(() => runCode(), 100);
        return () => clearTimeout(timer);
    }, []);

    // Handlers
    const handleTitleChange = useCallback((e) => {
        const newTitle = e.target.value;
        setLocalTitle(newTitle);
        updateNode(id, { title: newTitle });
    }, [id, updateNode]);

    const updateValue = useCallback((newValue) => {
        setLocalValue(newValue);
        const escaped = newValue.replace(/"/g, '\\"');
        const newCode = `output = "${escaped}"`;
        updateNode(id, { code: newCode });
        runCode({ code: newCode });
    }, [id, updateNode, runCode]);

    const handleInputChange = useCallback((e) => updateValue(e.target.value), [updateValue]);
    const stopPropagation = useCallback((e) => e.stopPropagation(), []);

    return (
        <div className={`node-shell string-node ${selected ? 'selected' : ''}`}>
            {/* Decoration - Green Theme Symbol */}
            <div className="string-decoration">@#?!</div>

            {/* Header with Title */}
            <div className="node-shell-header string-header">
                <input
                    type="text"
                    className="node-shell-title title-input nodrag"
                    placeholder="Title"
                    value={localTitle}
                    onChange={handleTitleChange}
                    onKeyDown={stopPropagation}
                />
            </div>

            <div className="string-content">
                <div className="string-input-container nodrag">
                    <textarea
                        className="string-input"
                        value={localValue}
                        onChange={handleInputChange}
                        onKeyDown={stopPropagation}
                        placeholder="Type text here..."
                    />
                </div>
            </div>

            <Handle
                type="source"
                position={Position.Right}
                id="output"
                className="string-handle"
            />
        </div>
    );
});

export default StringNode;
