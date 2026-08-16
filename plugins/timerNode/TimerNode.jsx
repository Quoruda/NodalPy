import React, { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { NodeShell, NodeShellHeader, useNodeShell } from '../../front-editor/src/components/Nodes/NodeShell.jsx';
import { useTimerNode } from './useTimerNode.js';
import { TimePickerModal } from './TimePickerModal.jsx';
import './TimerNode.css';

const TIMEZONES = [
    'UTC',
    'Europe/Paris',
    'Europe/London',
    'Europe/Berlin',
    'America/New_York',
    'America/Chicago',
    'America/Los_Angeles',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Asia/Dubai',
    'Australia/Sydney'
];

const TimerNode = memo(({ id, data, selected }) => {
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const { updateNode } = useNodeShell(id);
    const { countdown, toggleActive, updateConfig } = useTimerNode(id, data);

    const isActive = !!data.isActive;
    const mode = data.mode || 'interval';
    const rawInterval = data.interval !== undefined ? parseInt(data.interval, 10) : 5;
    const interval = isNaN(rawInterval) || rawInterval < 1 ? 1 : rawInterval;
    const unit = data.unit || 'minutes';
    const targetTime = data.targetTime || '12:00:00';
    const repeatDaily = data.repeatDaily !== undefined ? data.repeatDaily : true;
    const userTz = data.timezone || (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC');

    const availableTimezones = TIMEZONES.includes(userTz) ? TIMEZONES : [userTz, ...TIMEZONES];

    return (
        <NodeShell id={id} selected={selected} nodeClass="timer-node">
            <NodeShellHeader
                nodeClass="timer"
                title={data.title || 'Timer Trigger'}
                onTitleChange={(e) => updateNode(id, { title: e.target.value })}
                rightChildren={
                    <button
                        className={`timer-toggle-btn nodrag ${isActive ? 'active' : 'paused'}`}
                        onClick={toggleActive}
                        title={isActive ? 'Pause Timer' : 'Activate Timer'}
                    >
                        {isActive ? '⏸️' : '▶️'}
                    </button>
                }
            />
            <div className="timer-node-body nodrag">
                <div className="timer-mode-selector">
                    <label>Mode:</label>
                    <select value={mode} onChange={(e) => updateConfig({ mode: e.target.value })}>
                        <option value="interval">Repetition / Frequency</option>
                        <option value="exact">Exact Target Time</option>
                    </select>
                </div>

                {mode === 'interval' ? (
                    <div className="timer-field-group">
                        <label>Repeat Every:</label>
                        <div className="timer-input-row">
                            <input
                                type="number"
                                min="1"
                                step="1"
                                className="timer-num-input"
                                value={interval}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value, 10);
                                    updateConfig({ interval: isNaN(val) || val < 1 ? 1 : val });
                                }}
                            />
                            <select value={unit} onChange={(e) => updateConfig({ unit: e.target.value })}>
                                <option value="minutes">minutes</option>
                                <option value="hours">hours</option>
                                <option value="days">days</option>
                            </select>
                        </div>
                    </div>
                ) : (
                    <div className="timer-field-group">
                        <label>Target Time:</label>
                        <div className="time-input-container">
                            <button
                                type="button"
                                className="time-trigger-display-btn nodrag"
                                onClick={() => setIsPickerOpen(!isPickerOpen)}
                            >
                                <span className="clock-icon">⏰</span>
                                <span className="time-val">{targetTime}</span>
                            </button>

                            {isPickerOpen && (
                                <TimePickerModal
                                    value={targetTime}
                                    onChange={(newTime) => updateConfig({ targetTime: newTime })}
                                    onClose={() => setIsPickerOpen(false)}
                                />
                            )}
                        </div>

                        <label>Timezone:</label>
                        <select value={userTz} onChange={(e) => updateConfig({ timezone: e.target.value })}>
                            {availableTimezones.map((tz) => (
                                <option key={tz} value={tz}>
                                    {tz}
                                </option>
                            ))}
                        </select>
                        <label className="timer-checkbox-label">
                            <input
                                type="checkbox"
                                checked={repeatDaily}
                                onChange={(e) => updateConfig({ repeatDaily: e.target.checked })}
                            />
                            Repeat Daily
                        </label>
                    </div>
                )}

                {isActive && (
                    <div className="timer-status">
                        <span className="status-badge running">ACTIVE</span>
                        {countdown && <span className="countdown-display">Next: {countdown}</span>}
                    </div>
                )}
                {!isActive && (
                    <div className="timer-status">
                        <span className="status-badge paused">PAUSED</span>
                    </div>
                )}
            </div>

            <Handle
                type="source"
                position={Position.Right}
                id="out1"
                className="timer-handle"
            />
        </NodeShell>
    );
});

TimerNode.displayName = 'TimerNode';
export default TimerNode;
