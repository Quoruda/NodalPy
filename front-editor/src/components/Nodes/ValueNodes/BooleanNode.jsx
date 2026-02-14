import React, { memo, useState, useEffect, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useValueNode } from '../useValueNode.js';
import '../NodeShell.css';
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

    // Toggle Handler
    const toggleValue = useCallback((e) => {
        e.stopPropagation(); // Prevent drag
        updateValue(!localValue);
    }, [localValue, updateValue]);

    // Stop propagation
    const stopPropagation = useCallback((e) => e.stopPropagation(), []);

    return (
        <div
            className={`node-shell boolean-node ${selected ? 'selected' : ''} ${localValue ? 'is-true' : 'is-false'}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Decoration - Static BOOL */}
            <div className={`boolean-decoration`}>
                BOOL
            </div>

            {/* Header with Title */}
            <div className="node-shell-header boolean-header">
                <input
                    type="text"
                    className="node-shell-title title-input nodrag"
                    placeholder="Title"
                    value={localTitle}
                    onChange={handleTitleChange}
                    onKeyDown={stopPropagation}
                />
            </div>

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

            <Handle
                type="source"
                position={Position.Right}
                id="output"
                className="boolean-handle"
            />
        </div>
    );
});

export default BooleanNode;
