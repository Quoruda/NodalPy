import React, { memo, useState, useEffect, useCallback, useRef } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useCodeNode } from '../useCodeNode.js';
import './ValueNode.css';

const FloatNode = memo(({ data }) => {
    // Reuse useCodeNode for backend communication logic
    const nodeState = useCodeNode(data, 0.5);
    const { runCode, updateNode } = nodeState;

    // Local state for the displayed value
    const [localValue, setLocalValue] = useState(data.value !== undefined ? data.value : 0.0);

    // Slider state (linear representation for non-linear float)
    // Range -50 to 50
    const [sliderValue, setSliderValue] = useState(0.0);

    // Helper: Convert Slider (-50 to 50) to Real Value (cubic scaling)
    // formula: val = (s^3) / 1000
    // s=50 -> 125.0
    // s=10 -> 1.0
    // s=1  -> 0.001
    const sliderToReal = (s) => {
        const val = Math.sign(s) * Math.pow(Math.abs(s), 3) / 1000;
        // Limit decimals to avoid floating point artifacts (e.g. 0.300000004)
        return parseFloat(val.toPrecision(6));
    };

    // Helper: Convert Real Value to Slider (inverse)
    // s = cbrt(1000 * val) = 10 * cbrt(val)
    const realToSlider = (v) => {
        return Math.sign(v) * 10 * Math.cbrt(Math.abs(v));
    };

    // Sync slider value from data on load
    useEffect(() => {
        if (data.value !== undefined && data.value !== localValue) {
            setLocalValue(data.value);
            setSliderValue(realToSlider(data.value));
        }
    }, [data.value]);

    // Handle Slider Change
    const handleSliderChange = (e) => {
        const s = parseFloat(e.target.value);
        setSliderValue(s);
        const newVal = sliderToReal(s);
        setLocalValue(newVal);
        syncToBackend(newVal);
    };

    // Handle Input Change
    const handleInputChange = (e) => {
        const valStr = e.target.value;

        // Allowed: numbers, minus sign at start, decimal point
        if (/^-?\d*\.?\d*$/.test(valStr)) {
            setLocalValue(valStr); // Update UI immediately

            const val = parseFloat(valStr);
            if (!isNaN(val)) {
                setSliderValue(realToSlider(val));
                syncToBackend(val);
            }
        }
    };

    // Sync to Node Data & Backend
    const debounceRef = useRef(null);

    const syncToBackend = useCallback((val) => {
        // Construct code
        // Python: output = 1.5
        const code = `output = ${val}`;

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
        <div className="value-node-container">
            <div className="value-node-header">
                <span className="value-node-title">{data.title || 'Float'}</span>
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

export default FloatNode;
