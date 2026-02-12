import React, { memo, useState, useEffect, useCallback, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useCodeNode } from '../useCodeNode.js';
import './IntegerNode.css';

const IntegerNode = memo(({ id, data, selected }) => {
    // Reuse useCodeNode for backend communication logic
    const nodeState = useCodeNode({ ...data, id }, { timeout: 0.5, autoTrigger: true });
    const { runCode, updateNode } = nodeState;

    // Local state
    const [localValue, setLocalValue] = useState(0);
    const [localTitle, setLocalTitle] = useState(data.title || 'Integer');

    // Configurable Range State
    const [minRange, setMinRange] = useState(-50);
    const [maxRange, setMaxRange] = useState(50);

    // Parse code to get initial value (e.g. "output = 10")
    useEffect(() => {
        if (data.code) {
            const match = data.code.match(/output\s*=\s*(-?\d+)/);
            if (match) {
                setLocalValue(parseInt(match[1], 10));
            }
        }
    }, [data.code]);

    // Handle Title Change
    const handleTitleChange = useCallback((e) => {
        const newTitle = e.target.value;
        setLocalTitle(newTitle);
        updateNode(id, { title: newTitle });
    }, [id, updateNode]);

    // Handle Value Update (Common logic)
    const updateValue = useCallback((newValue) => {
        setLocalValue(newValue);
        updateNode(id, { code: `output = ${newValue}` });
    }, [id, updateNode]);

    const handleInputChange = useCallback((e) => {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val)) {
            updateValue(val);
        }
    }, [updateValue]);

    // Stop propagation to prevent panning when dragging slider/input
    const stopPropagation = useCallback((e) => e.stopPropagation(), []);

    // Slider Handler (Linear)
    const handleSliderChange = useCallback((e) => {
        const val = parseInt(e.target.value, 10);
        updateValue(val);
    }, [updateValue]);

    // Min/Max Handlers
    const handleMinChange = useCallback((e) => setMinRange(parseInt(e.target.value, 10) || -100), []);
    const handleMaxChange = useCallback((e) => setMaxRange(parseInt(e.target.value, 10) || 100), []);

    return (
        <div className={`constant-node ${selected ? 'selected' : ''}`}>
            {/* Decoration */}
            <div className="big-number">123</div>

            {/* Restored Header with Title */}
            <div className="constant-header">
                <input
                    type="text"
                    className="title-input nodrag"
                    placeholder="Title"
                    value={localTitle}
                    onChange={handleTitleChange}
                    onKeyDown={stopPropagation}
                />
            </div>

            <div className="constant-content">
                <div className="value-input-container nodrag">
                    <input
                        type="number"
                        className="value-input"
                        value={localValue}
                        onChange={handleInputChange}
                        onKeyDown={stopPropagation}
                    />
                </div>

                {/* Linear Slider with Configurable Range */}
                <div className="value-slider-container nodrag">
                    <input
                        type="range"
                        min={minRange}
                        max={maxRange}
                        step="1"
                        value={localValue}
                        onChange={handleSliderChange}
                        className="value-node-slider"
                    />
                </div>

                {/* Range configuration (Min / Max) */}
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
                </div>
            </div>

            <Handle
                type="source"
                position={Position.Right}
                id="output"
                className="constant-handle"
            />
        </div>
    );
});

export default IntegerNode;
