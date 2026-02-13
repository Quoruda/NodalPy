import React, { memo, useState, useEffect, useCallback, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useCodeNode } from '../useCodeNode.js';
import './NumberNode.css'; // Make sure this CSS imports the styles from IntegerNode adaptation

const NumberNode = memo(({ id, data, selected }) => {
    // Reuse useCodeNode for backend communication logic
    const nodeState = useCodeNode({ ...data, id }, { timeout: 0.5, autoTrigger: true });
    const { runCode, updateNode } = nodeState;

    // Local state
    const [localValue, setLocalValue] = useState(0);
    const [localTitle, setLocalTitle] = useState(data.title || 'Number');

    // Configurable Range State
    const [minRange, setMinRange] = useState(-50);
    const [maxRange, setMaxRange] = useState(50);
    const [step, setStep] = useState(1);

    // Auto-run on mount to ensure value is available immediately
    useEffect(() => {
        // If loaded from save, do NOT auto-run
        if (data.fromLoad) {
            // Remove the flag so future updates work normally
            // We do this by updating the node data silently or just letting it be overwritten on next change
            // Ideally we should clean it up, but for now just skipping runCode is enough.
            // Actually, if we leave it, it won't affect anything else unless we re-mount.
            return;
        }

        // Short timeout to ensure node is registered in backend references if needed
        const timer = setTimeout(() => {
            runCode();
        }, 100);
        return () => clearTimeout(timer);
    }, []); // Run once on mount

    // Parse code to get initial value (e.g. "output = 10" or "output = 10.5")
    useEffect(() => {
        if (data.code) {
            const match = data.code.match(/output\s*=\s*(-?[\d.]+)/);
            if (match) {
                const parsed = parseFloat(match[1]);
                if (!isNaN(parsed)) {
                    setLocalValue(parsed);
                }
            }
        }
    }, [data.code]);

    // Handle Title Change
    const handleTitleChange = useCallback((e) => {
        const newTitle = e.target.value;
        setLocalTitle(newTitle);
        updateNode(id, { title: newTitle });
    }, [id, updateNode]);

    // Handle Value Update
    const updateValue = useCallback((newValue) => {
        setLocalValue(newValue);
        const newCode = `output = ${newValue}`;
        // Javascript handles 1.0 as 1 automatically in template strings unless forced
        updateNode(id, { code: newCode });
        // Force execution immediately with updated data
        runCode({ code: newCode });
    }, [id, updateNode, runCode]);


    const handleInputChange = useCallback((e) => {
        const val = parseFloat(e.target.value);
        if (!isNaN(val)) {
            updateValue(val);
        }
    }, [updateValue]);

    // Slider Handler (Linear)
    const handleSliderChange = useCallback((e) => {
        const val = parseFloat(e.target.value);
        updateValue(val);
    }, [updateValue]);

    // Config Handlers
    const handleMinChange = useCallback((e) => setMinRange(parseFloat(e.target.value) || -100), []);
    const handleMaxChange = useCallback((e) => setMaxRange(parseFloat(e.target.value) || 100), []);
    const handleStepChange = useCallback((e) => setStep(parseFloat(e.target.value) || 1), []);

    // Stop propagation
    const stopPropagation = useCallback((e) => e.stopPropagation(), []);

    return (
        <div className={`number-node ${selected ? 'selected' : ''}`}>
            {/* Decoration - Static 123 as requested */}
            <div className="big-number">123</div>

            {/* Header with Title */}
            <div className="number-header">
                <input
                    type="text"
                    className="title-input nodrag"
                    placeholder="Title"
                    value={localTitle}
                    onChange={handleTitleChange}
                    onKeyDown={stopPropagation}
                />
            </div>

            <div className="number-content">
                <div className="value-input-container nodrag">
                    <input
                        type="number"
                        className="value-input"
                        value={localValue}
                        onChange={handleInputChange}
                        onKeyDown={stopPropagation}
                        step={step}
                    />
                </div>

                {/* Linear Slider with Configurable Range */}
                <div className="value-slider-container nodrag">
                    <input
                        type="range"
                        min={minRange}
                        max={maxRange}
                        step={step}
                        value={localValue}
                        onChange={handleSliderChange}
                        className="value-node-slider"
                    />
                </div>

                {/* Range & Step Config */}
                <div className="range-config nodrag">
                    <input
                        type="number"
                        className="range-input"
                        value={minRange}
                        onChange={handleMinChange}
                        onKeyDown={stopPropagation}
                        title="Min Range"
                    />
                    <span className="range-separator">↔</span>
                    <input
                        type="number"
                        className="range-input"
                        value={maxRange}
                        onChange={handleMaxChange}
                        onKeyDown={stopPropagation}
                        title="Max Range"
                    />
                    <span className="range-separator">|</span>
                    <input
                        type="number"
                        className="range-input step-input"
                        value={step}
                        onChange={handleStepChange}
                        onKeyDown={stopPropagation}
                        title="Step (Precision)"
                    />
                </div>
            </div>

            <Handle
                type="source"
                position={Position.Right}
                id="output"
                className="number-handle"
            />
        </div>
    );
});

export default NumberNode;
