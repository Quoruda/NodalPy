import React, { memo } from 'react';
import BaseNode from '../BaseNode.jsx';
import { useCodeNode } from '../useCodeNode.js';

const CustomNode = memo(({ id, data }) => {
    // CustomNode runs only on manual trigger and DOES NOT trigger downstream automatically
    const nodeState = useCodeNode({ ...data, id }, { timeout: null, autoTrigger: false });

    return (
        <BaseNode
            data={data}
            nodeTypeClass="custom-node"
            {...nodeState}
        />
    );
}, (prevProps, nextProps) => {
    // Optimization comparison
    if (prevProps.data === nextProps.data) return true;
    const prev = prevProps.data;
    const next = nextProps.data;

    // Comparisons
    if (prev.id !== next.id) return false;
    if (prev.code !== next.code) return false;
    if (prev.title !== next.title) return false;
    if (prev.state !== next.state) return false;

    // Arrays
    if (prev.inputs !== next.inputs) {
        if (JSON.stringify(prev.inputs) !== JSON.stringify(next.inputs)) return false;
    }
    if (prev.outputs !== next.outputs) {
        if (JSON.stringify(prev.outputs) !== JSON.stringify(next.outputs)) return false;
    }

    // Callbacks
    if (prev.onChange !== next.onChange) return false;

    // Output/Error changes
    if (prev.output !== next.output) return false;
    if (prev.error !== next.error) return false;

    return true;
});

CustomNode.displayName = 'CustomNode';

export default CustomNode;