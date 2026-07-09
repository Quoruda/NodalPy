import { useCallback } from 'react';
import { uiRegistry } from '../core/uiRegistry';

export const useNodeFactory = (nodes, setNodes, nodeCount, setNodeCount) => {

    const addNode = useCallback((type, position = null) => {
        const id = `${nodeCount}`;

        const defaultPos = { x: 250, y: 5 + (nodes.length * 100) };
        const finalPos = position || defaultPos;

        let newNode = {
            id,
            type,
            position: finalPos,
            data: {
                label: `${type} Node`,
                title: type,
                state: 0,
                error: null,
                inputs: [],
                outputs: []
            },
        };

        const registeredNode = uiRegistry.slots.nodeTypes.find(n => n.type === type);
        if (registeredNode && registeredNode.defaultData) {
            newNode.data = {
                ...newNode.data,
                ...registeredNode.defaultData,
                title: `${registeredNode.defaultData.title} ${id}`
            };
        }

        setNodes((nds) => nds.concat(newNode));
        setNodeCount((count) => count + 1);
    }, [nodes, nodeCount, setNodes, setNodeCount]);

    return { addNode };
};
