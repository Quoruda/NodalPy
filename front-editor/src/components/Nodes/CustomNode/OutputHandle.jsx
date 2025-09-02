import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import AutosizeInput from 'react-input-autosize';

const OutputHandle = memo(({ output, index, isEditing, updateOutput }) => (
    <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
        {isEditing ? (
            <AutosizeInput
                value={output}
                onChange={(e) => updateOutput(index, e.target.value)}
                className="var-input"
                placeholder="output"
            />
        ) : (
            <span style={{ marginRight: 8, whiteSpace: 'nowrap' }}>{output}</span>
        )}
        <Handle
            type="source"
            position={Position.Right}
            id={`ou${index + 1}`}
            style={{ background: 'red' }}
            isConnectable={true}
        />
    </div>
), (prevProps, nextProps) => {
    // ✅ Comparaison optimisée
    return prevProps.output === nextProps.output &&
           prevProps.index === nextProps.index &&
           prevProps.isEditing === nextProps.isEditing &&
           prevProps.updateOutput === nextProps.updateOutput;
});

OutputHandle.displayName = 'OutputHandle';

export default OutputHandle;