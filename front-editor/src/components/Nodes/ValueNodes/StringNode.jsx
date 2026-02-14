import React, { memo, useState, useEffect, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useValueNode } from '../useValueNode.js';
import '../NodeShell.css'; // Shared styles
import './StringNode.css';

const StringNode = memo(({ id, data, selected }) => {
    const {
        localValue,
        updateValue,
        localTitle,
        handleTitleChange
    } = useValueNode(id, data, {
        regex: /output\s*=\s*(["'])(.*)\1/,
        matchGroupIndex: 2,
        defaultValue: '',
        defaultTitle: 'String',
        formatValue: (v) => `"${v.replace(/"/g, '\\"')}"`,
        // serialze default is output = {v} which works because formatValue returns quoted string
    });

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
