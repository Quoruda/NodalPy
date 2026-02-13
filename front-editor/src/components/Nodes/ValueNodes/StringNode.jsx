import React, { memo, useState, useEffect, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useCodeNode } from '../useCodeNode.js';
import './StringNode.css';

const StringNode = memo(({ id, data, selected }) => {
    // Reuse useCodeNode for backend communication logic
    const nodeState = useCodeNode({ ...data, id }, { timeout: 0.5, autoTrigger: true });
    const { runCode, updateNode } = nodeState;

    // Local state
    const [localValue, setLocalValue] = useState('');
    const [localTitle, setLocalTitle] = useState(data.title || 'String');

    // Parse code to get initial value (e.g. "output = 'hello'")
    useEffect(() => {
        if (data.code) {
            // Match simple string assignment: output = "..." or '...'
            const match = data.code.match(/output\s*=\s*(["'])(.*)\1/);
            if (match) {
                setLocalValue(match[2]);
            }
        }
    }, [data.code]);

    // Auto-run on mount
    useEffect(() => {
        if (data.fromLoad) return;

        const timer = setTimeout(() => {
            runCode();
        }, 100);
        return () => clearTimeout(timer);
    }, []);

    // Handle Title Change
    const handleTitleChange = useCallback((e) => {
        const newTitle = e.target.value;
        setLocalTitle(newTitle);
        updateNode(id, { title: newTitle });
    }, [id, updateNode]);

    // Handle Value Update
    const updateValue = useCallback((newValue) => {
        setLocalValue(newValue);
        // Escape quotes? For simplicity assuming simple text.
        // Python string: output = "value"
        const escaped = newValue.replace(/"/g, '\\"');
        const newCode = `output = "${escaped}"`;
        updateNode(id, { code: newCode });
        runCode({ code: newCode });
    }, [id, updateNode, runCode]);

    const handleInputChange = useCallback((e) => {
        updateValue(e.target.value);
    }, [updateValue]);

    // Stop propagation
    const stopPropagation = useCallback((e) => e.stopPropagation(), []);

    return (
        <div className={`string-node ${selected ? 'selected' : ''}`}>
            {/* Decoration - Green Theme Symbol */}
            <div className="string-decoration">@#?!</div>

            {/* Header with Title */}
            <div className="string-header">
                <input
                    type="text"
                    className="title-input nodrag"
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
                        rows={3}
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
