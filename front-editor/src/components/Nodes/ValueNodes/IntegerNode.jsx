import React, { memo, useState, useEffect, useCallback, useRef } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useCodeNode } from '../useCodeNode.js';
import './ValueNode.css';

const IntegerNode = memo(({ data }) => {
    // Reuse useCodeNode for backend communication logic (runCode, updateNode)
    const nodeState = useCodeNode(data, 0.5); // Short timeout for interactivity
    const { runCode, updateNode } = nodeState;

    // Local state for the displayed value
    // Initialize from data.value if present, default to 0
    const [localValue, setLocalValue] = useState(data.value !== undefined ? data.value : 0);

    // Slider state (linear representation)
    const [sliderValue, setSliderValue] = useState(0);

    // Helper: Convert Slider (-50 to 50) to Real Value (cubic scaling)
    const sliderToReal = (s) => {
        // y = sign(s) * (abs(s)^3)
        // With s in [-50, 50], max is 125,000 via s^3.
        return Math.round(Math.sign(s) * Math.pow(Math.abs(s), 3));
    };

    // Helper: Convert Real Value to Slider (inverse)
    const realToSlider = (v) => {
        // s = sign(v) * cbrt(abs(v))
        return Math.sign(v) * Math.cbrt(Math.abs(v));
    };

    // Update slider when external value changes (first load or undo/redo)
    useEffect(() => {
        if (data.value !== undefined && data.value !== localValue) {
            setLocalValue(data.value);
            setSliderValue(realToSlider(data.value));
        }
    }, [data.value]);

    // Handle Slider Change
    const handleSliderChange = (e) => {
        const s = parseFloat(e.target.value);
        const newVal = sliderToReal(s);
        setSliderValue(s);
        setLocalValue(newVal);
        syncToBackend(newVal);
    };

    // Handle Input Change
    const handleInputChange = (e) => {
        const valStr = e.target.value;
        const val = parseInt(valStr, 10);
        if (!isNaN(val)) {
            setLocalValue(val);
            setSliderValue(realToSlider(val));
            syncToBackend(val);
        } else if (valStr === '-' || valStr === '') {
            // Allow temporary invalid state for typing negative
            setLocalValue(valStr);
        }
    };

    // Sync to Node Data & Backend
    const debounceRef = useRef(null);

    const syncToBackend = useCallback((val) => {
        // Construct code
        // Python: output = 123
        const code = `output = ${val}`;

        if (debounceRef.current) clearTimeout(debounceRef.current);

        debounceRef.current = setTimeout(() => {
            updateNode(data.id, {
                value: val,
                code: code
            });
            runCode(); // Explicit manual trigger
        }, 50); // Reduced from 300ms to 50ms for snappier UI
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

    // Debug Mount - REMOVED

    // Auto-run effect on mount ONLY (Initialize)
    useEffect(() => {
        // Execute immediately on mount to register value if code exists
        if (data.code && data.code.startsWith('output =')) {
            runCode();
        }
    }, []); // Empty dependency array = Run once on mount


    return (
        <div className="value-node-container">
            <div className="value-node-header">
                <span className="value-node-title">{data.title || 'Integer'}</span>
                <input
                    type="text"
                    className="value-node-input nodrag"
                    value={localValue}
                    onChange={handleInputChange}
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

export default IntegerNode;
