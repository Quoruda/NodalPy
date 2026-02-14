import React, { memo, useState, useEffect, useCallback, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useValueNode } from '../useValueNode.js';
import '../NodeShell.css';
import './NumberNode.css'; // Make sure this CSS imports the styles from IntegerNode adaptation

const NumberNode = memo(({ id, data, selected }) => {
    const {
        localValue,
        updateValue,
        localTitle,
        handleTitleChange
    } = useValueNode(id, data, {
        regex: /output\s*=\s*(-?[\d.]+)/,
        defaultValue: 0,
        defaultTitle: 'Number',
        parseValue: parseFloat
    });

    // Configurable Range State (Local only)
    const [minRange, setMinRange] = useState(-50);
    const [maxRange, setMaxRange] = useState(50);
    const [step, setStep] = useState(1);

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
        <div className={`node-shell number-node ${selected ? 'selected' : ''}`}>
            {/* Decoration - Static 123 as requested */}
            <div className="big-number">123</div>

            {/* Header with Title */}
            <div className="node-shell-header number-header">
                <input
                    type="text"
                    className="node-shell-title title-input nodrag"
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
