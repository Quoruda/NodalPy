import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import AutosizeInput from 'react-input-autosize';

const InputHandle = memo(({ input, index, isEditing, updateInput, isConnectable }) => (
    <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
        <Handle
            type="target"
            position={Position.Left}
            id={`in${index + 1}`}
            style={{ background: 'blue' }}
            isConnectable={isConnectable}
        />
        {isEditing ? (
            <AutosizeInput
                value={input}
                onChange={(e) => updateInput(index, e.target.value)}
                className="var-input"
                placeholder="input"
            />
        ) : (
            <span style={{ marginLeft: 8, whiteSpace: 'nowrap' }}>{input}</span>
        )}
    </div>
), (prevProps, nextProps) => {
    // ✅ Comparaison optimisée pour éviter les re-renders inutiles
    return prevProps.input === nextProps.input &&
           prevProps.index === nextProps.index &&
           prevProps.isEditing === nextProps.isEditing &&
           prevProps.isConnectable === nextProps.isConnectable &&
           prevProps.updateInput === nextProps.updateInput;
});

InputHandle.displayName = 'InputHandle';

export default InputHandle;