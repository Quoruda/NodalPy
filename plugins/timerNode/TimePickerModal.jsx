import React, { useState, useEffect, useRef } from 'react';
import './TimePickerModal.css';

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES_SECONDS = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

const PRESETS = [
    { label: '08:00', value: '08:00:00' },
    { label: '12:00', value: '12:00:00' },
    { label: '18:00', value: '18:00:00' },
    { label: '00:00', value: '00:00:00' }
];

export const TimePickerModal = ({ value, onChange, onClose }) => {
    const modalRef = useRef(null);

    const parseValue = (val) => {
        const parts = (val || '12:00:00').split(':');
        return {
            h: (parts[0] || '12').padStart(2, '0'),
            m: (parts[1] || '00').padStart(2, '0'),
            s: ((parts[2] || '00').split('.')[0] || '00').padStart(2, '0')
        };
    };

    const [{ h, m, s }, setTimeState] = useState(() => parseValue(value));

    useEffect(() => {
        setTimeState(parseValue(value));
    }, [value]);

    useEffect(() => {
        const handleOutsideClick = (e) => {
            if (modalRef.current && !modalRef.current.contains(e.target)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, [onClose]);

    const updateTime = (newH, newM, newS) => {
        setTimeState({ h: newH, m: newM, s: newS });
        onChange(`${newH}:${newM}:${newS}`);
    };

    return (
        <div className="time-picker-popover nodrag" ref={modalRef}>
            <div className="time-picker-header">
                <div className="digital-display">
                    <span className="time-digit">{h}</span>
                    <span className="time-colon">:</span>
                    <span className="time-digit">{m}</span>
                    <span className="time-colon">:</span>
                    <span className="time-digit">{s}</span>
                </div>
            </div>

            <div className="time-presets-row">
                {PRESETS.map((p) => (
                    <button
                        key={p.value}
                        type="button"
                        className="preset-chip"
                        onClick={() => {
                            const parsed = parseValue(p.value);
                            updateTime(parsed.h, parsed.m, parsed.s);
                        }}
                    >
                        {p.label}
                    </button>
                ))}
            </div>

            <div className="time-columns-container">
                <div className="time-column">
                    <div className="column-label">Hour</div>
                    <div className="column-scroll">
                        {HOURS.map((val) => (
                            <button
                                key={`h-${val}`}
                                type="button"
                                className={`column-item ${val === h ? 'selected' : ''}`}
                                onClick={() => updateTime(val, m, s)}
                            >
                                {val}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="time-column">
                    <div className="column-label">Min</div>
                    <div className="column-scroll">
                        {MINUTES_SECONDS.map((val) => (
                            <button
                                key={`m-${val}`}
                                type="button"
                                className={`column-item ${val === m ? 'selected' : ''}`}
                                onClick={() => updateTime(h, val, s)}
                            >
                                {val}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="time-column">
                    <div className="column-label">Sec</div>
                    <div className="column-scroll">
                        {MINUTES_SECONDS.map((val) => (
                            <button
                                key={`s-${val}`}
                                type="button"
                                className={`column-item ${val === s ? 'selected' : ''}`}
                                onClick={() => updateTime(h, m, val)}
                            >
                                {val}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="time-picker-footer">
                <button type="button" className="done-btn" onClick={onClose}>
                    Done
                </button>
            </div>
        </div>
    );
};

export default TimePickerModal;
