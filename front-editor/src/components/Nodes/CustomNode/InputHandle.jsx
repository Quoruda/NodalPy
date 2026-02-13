import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import AutosizeInput from 'react-input-autosize';

const InputHandle = memo(({ input, id, index, isEditing, updateInput, isConnectable, removeInput }) => {
    const [localEditing, setLocalEditing] = React.useState(false);
    const [hovered, setHovered] = React.useState(false);
    const [tempValue, setTempValue] = React.useState(input);

    // Combine parent editing state with local
    const isEditMode = isEditing || localEditing;

    React.useEffect(() => {
        if (localEditing) {
            setTempValue(input);
        }
    }, [localEditing, input]);

    const handleDoubleClick = (e) => {
        e.stopPropagation();
        setLocalEditing(true);
    };

    const handleBlur = () => {
        if (!tempValue || tempValue.trim() === '') {
            removeInput(index);
        } else {
            updateInput(index, tempValue);
            setLocalEditing(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            if (!tempValue || tempValue.trim() === '') {
                removeInput(index);
            } else {
                updateInput(index, tempValue);
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
            <Handle
                type="target"
                position={Position.Left}
                id={id}
                style={{ background: 'blue' }}
                isConnectable={isConnectable}
            />
            {isEditMode ? (
                <span>
                    <AutosizeInput
                        value={tempValue}
                        onChange={(e) => setTempValue(e.target.value)}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        className="var-input"
                        inputClassName="nodrag"
                        placeholder="input"
                        autoFocus
                    />
                    <btn onClick={() => removeInput(index)} style={{ cursor: 'pointer', marginLeft: 4 }}>❌</btn>
                </span>
            ) : (
                <span
                    style={{ marginLeft: 8, whiteSpace: 'nowrap', cursor: 'text', opacity: 0.9 }}
                    onDoubleClick={handleDoubleClick}
                    title="Double-click to rename"
                >
                    {input || <span style={{ color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>(empty)</span>}
                    {hovered && (
                        <span
                            onClick={(e) => { e.stopPropagation(); removeInput(index); }}
                            style={{ marginLeft: 6, cursor: 'pointer', fontSize: '10px', color: '#ff6b6b' }}
                            title="Remove"
                        >
                            ✕
                        </span>
                    )}
                </span>
            )}
        </div>
    );
}, (prevProps, nextProps) => {
    return prevProps.input === nextProps.input &&
        prevProps.index === nextProps.index &&
        prevProps.isEditing === nextProps.isEditing &&
        prevProps.isConnectable === nextProps.isConnectable &&
        prevProps.updateInput === nextProps.updateInput;
});

InputHandle.displayName = 'InputHandle';

export default InputHandle;