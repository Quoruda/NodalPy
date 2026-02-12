import React, { memo, useState, useEffect, useCallback, useRef } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useCodeNode } from '../useCodeNode.js';
import './ValueNode.css';

const BooleanNode = memo(({ id, data }) => {
    // Reuse useCodeNode for backend communication logic
    const nodeState = useCodeNode({ ...data, id }, { timeout: 0.5, autoTrigger: true });
    const { runCode, updateNode } = nodeState;

    // ... (lines 11-47 unchanged)

    // React to state change to trigger downstream nodes - HANDLED BY useCodeNode NOW
    // const { triggerDownstreamNodes } = nodeState;
    // const prevStateRef = useRef(data.state);
    // useEffect(() => { ... }

    // Auto-run effect on mount ONLY (Initialize)
    useEffect(() => {
        // Execute immediately on mount to register value if code exists
        if (data.code && data.code.startsWith('output =')) {
            runCode();
        }
    }, []); // Run once on mount


    return (
        <div className="value-node-container" style={{ minWidth: '100px' }}>
            <div className="value-node-header">
                <span className="value-node-title">{data.title || 'Boolean'}</span>
            </div>

            <div className="value-node-slider-container" style={{ justifyContent: 'center', padding: '10px' }}>
                <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: '#fff',
                    fontSize: '12px',
                    cursor: 'pointer'
                }}>
                    <input
                        type="checkbox"
                        checked={localValue}
                        onChange={handleChange}
                        className="nodrag"
                        style={{ transform: 'scale(1.2)', cursor: 'pointer' }}
                    />
                    {localValue ? 'True' : 'False'}
                </label>
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

export default BooleanNode;
