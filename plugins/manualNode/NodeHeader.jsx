import React, { memo } from 'react';

const NodeHeader = memo(({
    tempTitle,
    setTempTitle,
    handleSave,
    state,
    runCode,
    hideState = false
}) => (
    <div className="manual-node-header">
        <div className="title-section" style={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
            <input
                type="text"
                value={tempTitle}
                onChange={(e) => setTempTitle(e.target.value)}
                onBlur={handleSave}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
                className="title-input nodrag"
                placeholder="Node Name"
            />
        </div>

        <div className="controls-section" style={{ display: 'flex', alignItems: 'center' }}>
            {!hideState && state === 0 && (
                <button
                    onClick={runCode}
                    className="execute-button nodrag"
                    title="Execute"
                >
                    ▶
                </button>
            )}
            {!hideState && state === 1 && (
                <div className="running-button nodrag" title="Running">
                    ⏱
                </div>
            )}
            {!hideState && state === 2 && (
                <button
                    onClick={runCode}
                    className="execute-button nodrag"
                    title="Re-execute"
                >
                    🔄
                </button>
            )}
        </div>
    </div>
), (prevProps, nextProps) => {
    return prevProps.tempTitle === nextProps.tempTitle &&
        prevProps.state === nextProps.state &&
        prevProps.handleSave === nextProps.handleSave &&
        prevProps.setTempTitle === nextProps.setTempTitle &&
        prevProps.runCode === nextProps.runCode &&
        prevProps.hideState === nextProps.hideState;
});

NodeHeader.displayName = 'NodeHeader';

export default NodeHeader;
