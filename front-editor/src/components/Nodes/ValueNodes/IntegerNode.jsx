import React, { memo, useState, useEffect, useCallback, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useCodeNode } from '../useCodeNode.js';
import './IntegerNode.css';

const IntegerNode = memo(({ id, data, selected }) => {
    // Reuse useCodeNode for backend communication logic
    const nodeState = useCodeNode({ ...data, id }, { timeout: 0.5, autoTrigger: true });
    const { runCode, updateNode } = nodeState;

    // Local state for immediate UI feedback
    const [localValue, setLocalValue] = useState(0);
    const [localTitle, setLocalTitle] = useState(data.title || 'Integer');

    // Parse code to get initial value (e.g. "output = 10")
    useEffect(() => {
        if (data.code) {
            const match = data.code.match(/output\s*=\s*(-?\d+)/);
            if (match) {
                setLocalValue(parseInt(match[1], 10));
            }
        }
    }, [data.code]);

    // Handle Title Change (Removed from UI)
    // const handleTitleChange = useCallback(...)

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

    // Non-linear slider logic
    // Slider range: 0 to 100
    // 50 = 0
    // 0 = -MAX
    // 100 = +MAX
    // Formula: value = sign * Math.floor(Math.pow(normalized_dist, 3)) or similar

    const SLIDER_MIN = 0;
    const SLIDER_MAX = 100;
    const SLIDER_MID = 50;

    // Convert real value -> slider position (approximate)
    const valueToSlider = useCallback((val) => {
        if (val === 0) return SLIDER_MID;
        const sign = val > 0 ? 1 : -1;
        // Inverse of cubic: cbrt(val)
        // Adjust scale factor as needed for "feel"
        // Let's say max range is +/- 1,000,000 for sliding
        // val = (dist/50)^4 * 1000 * sign ? 
        // Let's use a simpler approach used previously or standard Exp

        // Inverse: abs(val) = Math.pow(dist, 3) => dist = Math.cbrt(abs(val))
        // Map 0-50 slider dist to 0-10000 value
        // 50^3 = 125,000. 
        // val = Math.pow(dist, 3) 

        const dist = Math.cbrt(Math.abs(val));
        return SLIDER_MID + (dist * sign);
    }, []);

    // Convert slider position -> real value
    const sliderToValue = useCallback((sliderVal) => {
        const dist = sliderVal - SLIDER_MID; // -50 to 50
        // Cubic function for exponential growth
        // val = dist^3 
        // 50^3 = 125,000
        // 10^3 = 1,000 (around center it's slow: 1^3=1, 2^3=8)
        return Math.round(Math.pow(dist, 3));
    }, []);

    // Local state for Slider Position (to keep it smooth)
    const [sliderPos, setSliderPos] = useState(SLIDER_MID);

    // Sync Slider Pos when Code changes (external update or initial)
    useEffect(() => {
        setSliderPos(valueToSlider(localValue));
    }, [localValue, valueToSlider]);

    // Handle Slider Change
    const handleSliderChange = useCallback((e) => {
        const newPos = parseInt(e.target.value, 10);
        setSliderPos(newPos);
        const newVal = sliderToValue(newPos);
        updateValue(newVal);
    }, [sliderToValue, updateValue]);

    return (
        <div className={`constant-node ${selected ? 'selected' : ''}`}>
            {/* Start Decoration: Static 123 - Smaller */}
            <div className="big-number">123</div>

            {/* Minimal Header removed entirely as requested */}
            {/* <div className="constant-header"></div> */}

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

                {/* Restored Exponential Slider */}
                <div className="value-slider-container nodrag">
                    <input
                        type="range"
                        min={SLIDER_MIN}
                        max={SLIDER_MAX}
                        step="1"
                        value={sliderPos}
                        onChange={handleSliderChange}
                        className="value-node-slider"
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
