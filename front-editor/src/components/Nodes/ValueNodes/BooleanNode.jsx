import React, { memo, useState, useEffect, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useCodeNode } from '../useCodeNode.js';
import './BooleanNode.css';

const BooleanNode = memo(({ id, data, selected }) => {
    // Reuse useCodeNode for backend communication logic
    const nodeState = useCodeNode({ ...data, id }, { timeout: 0.5, autoTrigger: true });
    const { runCode, updateNode } = nodeState;

    // Local state
    const [localValue, setLocalValue] = useState(false);
    const [localTitle, setLocalTitle] = useState(data.title || 'Boolean');
    const [isHovered, setIsHovered] = useState(false);

    // Initial value from code
    useEffect(() => {
        if (data.code) {
            // output = True or output = False
            const match = data.code.match(/output\s*=\s*(True|False)/);
            if (match) {
                setLocalValue(match[1] === 'True');
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

    // Toggle Handler
    const toggleValue = useCallback((e) => {
        e.stopPropagation(); // Prevent drag
        const newValue = !localValue;
        setLocalValue(newValue);

        // Python boolean
        const pyValue = newValue ? 'True' : 'False';
        const newCode = `output = ${pyValue}`;

        updateNode(id, { code: newCode });
        runCode({ code: newCode });
    }, [localValue, id, updateNode, runCode]);

    // Stop propagation
    const stopPropagation = useCallback((e) => e.stopPropagation(), []);

    return (
        <div
            className={`boolean-node ${selected ? 'selected' : ''} ${localValue ? 'is-true' : 'is-false'}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Decoration - Static BOOL */}
            <div className={`boolean-decoration`}>
                BOOL
            </div>

            {/* Header with Title */}
            <div className="boolean-header">
                <input
                    type="text"
                    className="title-input nodrag"
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
