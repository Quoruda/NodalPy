import React, { memo, useState, useEffect, useCallback, useRef } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useCodeNode } from '../useCodeNode.js';
import './ValueNode.css';

const BooleanNode = memo(({ data }) => {
    // Reuse useCodeNode for backend communication logic
    const nodeState = useCodeNode(data, 0.5);
    const { runCode, updateNode } = nodeState;

    // Local state
    const [localValue, setLocalValue] = useState(data.value === true);

    // Sync value from data on load
    useEffect(() => {
        if (data.value !== undefined && data.value !== localValue) {
            setLocalValue(data.value === true);
        }
    }, [data.value]);

    // Handle Change
    const handleChange = (e) => {
        const newVal = e.target.checked;
        setLocalValue(newVal);
        syncToBackend(newVal);
    };

    // Sync to Node Data & Backend
    const debounceRef = useRef(null);

    const syncToBackend = useCallback((val) => {
        // Construct code
        // Python: output = True / False
        const code = `output = ${val ? 'True' : 'False'}`;

        if (debounceRef.current) clearTimeout(debounceRef.current);

        debounceRef.current = setTimeout(() => {
            updateNode(data.id, {
                value: val,
                code: code
            });
            runCode(); // Explicit manual trigger
        }, 50);
    }, [data.id, updateNode, runCode]);


    // React to state change to trigger downstream nodes
    const { triggerDownstreamNodes } = nodeState;
    const prevStateRef = useRef(data.state);

    useEffect(() => {
        if (data.state === 2 && !data.error && prevStateRef.current !== 2) {
            triggerDownstreamNodes(data.id);
        }
        prevStateRef.current = data.state;
    }, [data.state, data.error, data.id, triggerDownstreamNodes]);

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
