import React, { memo, useState, useEffect, useCallback, useRef } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useCodeNode } from '../useCodeNode.js';
import './ValueNode.css';

const StringNode = memo(({ data }) => {
    // Reuse useCodeNode for backend communication logic
    const nodeState = useCodeNode(data, 0.5);
    const { runCode, updateNode } = nodeState;

    // Local state
    const [localValue, setLocalValue] = useState(data.value || "");
    const isFocusedRef = useRef(false);

    // Sync value from data on load (only if not focused to avoid typing interruption)
    useEffect(() => {
        if (!isFocusedRef.current && data.value !== undefined && data.value !== localValue) {
            setLocalValue(data.value);
        }
    }, [data.value]);

    // Handle Change
    const handleChange = (e) => {
        const newVal = e.target.value;
        setLocalValue(newVal);
        syncToBackend(newVal);
    };

    const handleFocus = () => { isFocusedRef.current = true; };
    const handleBlur = () => { isFocusedRef.current = false; };

    // Sync to Node Data & Backend
    const debounceRef = useRef(null);

    const syncToBackend = useCallback((val) => {
        // Construct code
        // Python: output = "val"
        // Handle escaping quotes
        const escapedVal = val.replace(/"/g, '\\"');
        const code = `output = "${escapedVal}"`;

        if (debounceRef.current) clearTimeout(debounceRef.current);

        debounceRef.current = setTimeout(() => {
            updateNode(data.id, {
                value: val,
                code: code
            });
            runCode(); // Explicit manual trigger
        }, 50); // Reduced to 50ms for snappier UI
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
        <div className="value-node-container" style={{ minWidth: '160px' }}>
            <div className="value-node-header">
                <span className="value-node-title">{data.title || 'String'}</span>
            </div>

            <div style={{ padding: '8px' }}>
                <input
                    type="text"
                    className="value-node-input nodrag"
                    style={{ width: '100%', textAlign: 'left' }}
                    value={localValue}
                    onChange={handleChange}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    placeholder="Enter text..."
                />
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

export default StringNode;
