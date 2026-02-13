import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import AutosizeInput from 'react-input-autosize';

const OutputHandle = memo(({ output, id, index, isEditing, updateOutput, removeOutput }) => {
    const [localEditing, setLocalEditing] = React.useState(false);
    const [hovered, setHovered] = React.useState(false);
    const [tempValue, setTempValue] = React.useState(output);

    // Combine parent editing state with local
    const isEditMode = isEditing || localEditing;

    React.useEffect(() => {
        if (localEditing) {
            setTempValue(output);
        }
    }, [localEditing, output]);

    const handleDoubleClick = (e) => {
        e.stopPropagation();
        setLocalEditing(true);
    };

    const handleBlur = () => {
        if (!tempValue || tempValue.trim() === '') {
            removeOutput(index);
        } else {
            updateOutput(index, tempValue);
            setLocalEditing(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            if (!tempValue || tempValue.trim() === '') {
                removeOutput(index);
            } else {
                updateOutput(index, tempValue);
                setLocalEditing(false);
            }
        }
    };

    return (
        <div
            style={{ display: 'flex', alignItems: 'center', position: 'relative' }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
        >
            {isEditMode ? (
                <span>
                    <btn onClick={() => removeOutput(index)} style={{ cursor: 'pointer', marginRight: 4 }}>❌</btn>
                    <AutosizeInput
                        value={tempValue}
                        onChange={(e) => setTempValue(e.target.value)}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        className="var-input"
                        inputClassName="nodrag"
                        placeholder="output"
                        autoFocus
                    />
                </span>
            ) : (
                <span
                    style={{ marginRight: 8, whiteSpace: 'nowrap', cursor: 'text', opacity: 0.9 }}
                    onDoubleClick={handleDoubleClick}
                    title="Double-click to rename"
                >
                    {hovered && (
                        <span
                            onClick={(e) => { e.stopPropagation(); removeOutput(index); }}
                            style={{ marginRight: 6, cursor: 'pointer', fontSize: '10px', color: '#ff6b6b' }}
                            title="Remove"
                        >
                            ✕
                        </span>
                    )}
                    {output || <span style={{ color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>(empty)</span>}
                </span>
            )}
            <Handle
                type="source"
                position={Position.Right}
                id={id}
                style={{ background: 'red' }}
                isConnectable={true}
            />
        </div>
    );
}, (prevProps, nextProps) => {
    return prevProps.output === nextProps.output &&
        prevProps.index === nextProps.index &&
        prevProps.isEditing === nextProps.isEditing &&
        prevProps.updateOutput === nextProps.updateOutput;
});

OutputHandle.displayName = 'OutputHandle';

export default OutputHandle;