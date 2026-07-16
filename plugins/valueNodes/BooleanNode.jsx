import React, { memo, useState, useCallback } from 'react';
import NodeShell, { NodeShellHeader, useNodeShell } from '../../front-editor/src/components/Nodes/NodeShell.jsx';
import { useValueNode } from './useValueNode.js';
import './BooleanNode.css';

const BooleanNode = memo(({ id, data, selected }) => {
    const {
        localValue,
        updateValue,
        localTitle,
        handleTitleChange
    } = useValueNode(id, data, {
        regex: /output\s*=\s*(True|False)/,
        defaultValue: false,
        defaultTitle: 'Boolean',
        parseValue: (v) => v === 'True',
        formatValue: (v) => v ? 'True' : 'False'
    });

    const [isHovered, setIsHovered] = useState(false);

    const toggleValue = useCallback((e) => {
        e.stopPropagation();
        updateValue(!localValue);
    }, [localValue, updateValue]);

    const { stopPropagation } = useNodeShell(id);

    return (
        <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={`boolean-wrapper ${localValue ? 'is-true' : 'is-false'}`}
            style={{ position: 'relative', width: '100%', height: '100%' }}
        >
            <NodeShell 
                id={id} 
                selected={selected} 
                nodeClass="boolean-node"
                outputs={['output']}
                renderBasicHandles={true}
            >
                <NodeShellHeader 
                    nodeClass="boolean" 
                    title={localTitle} 
                    onTitleChange={handleTitleChange}
                    onTitleKeyDown={stopPropagation}
                >
                    <div className="boolean-decoration">BOOL</div>
                </NodeShellHeader>

                <div className="boolean-content">
                    <div className="switch-container nodrag" onClick={toggleValue}>
                        <div className={`switch-track ${localValue ? 'checked' : ''}`}>
                            <div className="switch-thumb"></div>
                            <div className="switch-icons">
                                <span className="icon-on">Day</span>
                                <span className="icon-off">Night</span>
                            </div>
                        </div>
                    </div>
                    <div className="state-label">
                        {localValue ? 'True' : 'False'}
                    </div>
                </div>
            </NodeShell>
        </div>
    );
});

export default BooleanNode;
