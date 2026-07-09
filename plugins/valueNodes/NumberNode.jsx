import React, { memo, useState, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useValueNode } from './useValueNode.js';
import '../../front-editor/src/components/Nodes/NodeShell.css';
import './NumberNode.css';

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

    const [minRange, setMinRange] = useState(-50);
    const [maxRange, setMaxRange] = useState(50);
    const [step, setStep] = useState(1);

    const handleInputChange = useCallback((e) => {
        const val = parseFloat(e.target.value);
        if (!isNaN(val)) {
            updateValue(val);
        }
    }, [updateValue]);

    const handleSliderChange = useCallback((e) => {
        const val = parseFloat(e.target.value);
        updateValue(val);
    }, [updateValue]);

    const handleMinChange = useCallback((e) => setMinRange(parseFloat(e.target.value) || -100), []);
    const handleMaxChange = useCallback((e) => setMaxRange(parseFloat(e.target.value) || 100), []);
    const handleStepChange = useCallback((e) => setStep(parseFloat(e.target.value) || 1), []);

    const stopPropagation = useCallback((e) => e.stopPropagation(), []);

    return (
        <div className={`node-shell number-node ${selected ? 'selected' : ''}`}>
            <div className="big-number">123</div>

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
