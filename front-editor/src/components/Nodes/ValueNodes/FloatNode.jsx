import React, { memo, useState, useEffect, useCallback, useRef } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useCodeNode } from '../useCodeNode.js';
import './ValueNode.css';

const FloatNode = memo(({ id, data }) => {
    // Reuse useCodeNode for backend communication logic
    const nodeState = useCodeNode({ ...data, id }, { timeout: 0.5, autoTrigger: true });
    const { runCode, updateNode } = nodeState;

    // ... (lines 11-87 unchanged)

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
        <div className="value-node-container">
            <div className="value-node-header">
                <span className="value-node-title">{data.title || 'Float'}</span>
                <input
                    type="text"
                    className="value-node-input nodrag"
                    value={localValue}
                    onChange={handleInputChange}
                    onKeyDown={(e) => e.stopPropagation()}
                />
            </div>

            <div className="value-node-slider-container">
                <span className="value-node-label">-∞</span>
                <input
                    type="range"
                    min="-50"
                    max="50"
                    step="0.1"
                    value={sliderValue}
                    onChange={handleSliderChange}
                    className="value-node-slider nodrag"
                />
                <span className="value-node-label">+∞</span>
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

export default FloatNode;
