import React, { memo } from 'react';
import AutosizeInput from 'react-input-autosize';

const NodeHeader = memo(({
    isEditing,
    tempTitle,
    setTempTitle,
    handleSave,
    setIsEditing,
    title,
    state,
    runCode,
    hideState = false
}) => (
    <div className="custom-node-header">
        {isEditing ? (
            <div >
                <AutosizeInput
                    value={tempTitle}
                    onChange={(e) => setTempTitle(e.target.value)}
                    className="title-input"
                    autoFocus
                />
                <button onClick={handleSave}>✅</button>
            </div>
        ) : (
            <>
                <span>{title || 'Code Node'}</span>
                <div >
                    <button
                        onClick={() => setIsEditing(true)}
                        title="Modifier le titre"
                    >
                        ✏️
                    </button>
                    {!hideState && state === 0 && (
                        <button
                            onClick={runCode}
                            className="execute-button"
                            title="Exécuter"
                        >
                            ▶
                        </button>
                    )}
                    {!hideState && state === 1 && (
                        <div className="running-button" title="Attendre">
                            ⏱
                        </div>
                    )}
                    {!hideState && state === 2 && (
                        <button
                            onClick={runCode}
                            className="execute-button"
                            title="Ré-exécuter"
                        >
                            🔄
                        </button>
                    )}
                </div>
            </>
        )}
    </div>
), (prevProps, nextProps) => {
    // ✅ Comparaison fine pour éviter les re-renders inutiles
    return prevProps.isEditing === nextProps.isEditing &&
        prevProps.tempTitle === nextProps.tempTitle &&
        prevProps.title === nextProps.title &&
        prevProps.state === nextProps.state &&
        prevProps.handleSave === nextProps.handleSave &&
        prevProps.setTempTitle === nextProps.setTempTitle &&
        prevProps.setIsEditing === nextProps.setIsEditing &&
        prevProps.runCode === nextProps.runCode &&
        prevProps.hideState === nextProps.hideState;
});

NodeHeader.displayName = 'NodeHeader';

export default NodeHeader;