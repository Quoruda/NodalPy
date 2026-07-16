import React, { memo, useCallback } from 'react';
import NodeShell, { NodeShellHeader, useNodeShell } from '../../front-editor/src/components/Nodes/NodeShell.jsx';
import { useValueNode } from './useValueNode.js';
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
        formatValue: (v) => `"${v.replace(/"/g, '\\"')}"`
    });

    const handleInputChange = useCallback((e) => updateValue(e.target.value), [updateValue]);
    const { stopPropagation } = useNodeShell(id);

    return (
        <NodeShell 
            id={id} 
            selected={selected} 
            nodeClass="string-node"
            outputs={['output']}
            renderBasicHandles={true}
        >
            <NodeShellHeader 
                nodeClass="string" 
                title={localTitle} 
                onTitleChange={handleTitleChange}
                onTitleKeyDown={stopPropagation}
            >
                <div className="string-decoration">@#?!</div>
            </NodeShellHeader>

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
        </NodeShell>
    );
});

export default StringNode;
