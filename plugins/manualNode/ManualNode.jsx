import React, { memo } from 'react';
import BaseCodeNode from '../../front-editor/src/components/Nodes/BaseCodeNode.jsx';
import { useCodeNode } from '../../front-editor/src/components/Nodes/useCodeNode.js';
import './ManualNode.css';
const ManualNode = memo(({ id, data, selected }) => {
    const nodeState = useCodeNode({ ...data, id }, { timeout: null, autoTrigger: false });

    return (
        <div className={selected ? 'selected' : ''}>
            <BaseCodeNode
                id={id}
                data={data}
                nodeTypeClass="manual-node"
                {...nodeState}
            />
        </div>
    );
}, (prev, next) => {
    if (prev.data === next.data && prev.selected === next.selected) return true;
    const p = prev.data, n = next.data;
    return p.code === n.code && p.title === n.title && p.state === n.state &&
        p.isCodeOpen === n.isCodeOpen && p.isLogsOpen === n.isLogsOpen &&
        p.output === n.output && p.logs === n.logs && p.error === n.error &&
        JSON.stringify(p.inputs) === JSON.stringify(n.inputs) &&
        JSON.stringify(p.outputs) === JSON.stringify(n.outputs) &&
        prev.selected === next.selected;
});

ManualNode.displayName = 'ManualNode';
export default ManualNode;
