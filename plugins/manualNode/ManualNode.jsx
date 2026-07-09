import React, { memo } from 'react';
import BaseNode from './BaseNode.jsx';
import { useCodeNode } from '../../front-editor/src/components/Nodes/useCodeNode.js';

const ManualNode = memo(({ id, data }) => {
    const nodeState = useCodeNode({ ...data, id }, { timeout: null, autoTrigger: false });

    return (
        <BaseNode
            data={data}
            nodeTypeClass="manual-node"
            {...nodeState}
        />
    );
}, (prevProps, nextProps) => {
    if (prevProps.data === nextProps.data) return true;
    const prev = prevProps.data;
    const next = nextProps.data;

    if (prev.id !== next.id) return false;
    if (prev.code !== next.code) return false;
    if (prev.title !== next.title) return false;
    if (prev.state !== next.state) return false;

    if (prev.inputs !== next.inputs) {
        if (JSON.stringify(prev.inputs) !== JSON.stringify(next.inputs)) return false;
    }
    if (prev.outputs !== next.outputs) {
        if (JSON.stringify(prev.outputs) !== JSON.stringify(next.outputs)) return false;
    }

    if (prev.onChange !== next.onChange) return false;

    if (prev.output !== next.output) return false;
    if (prev.error !== next.error) return false;

    return true;
});

ManualNode.displayName = 'ManualNode';

export default ManualNode;
