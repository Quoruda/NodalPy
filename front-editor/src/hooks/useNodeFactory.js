import { useCallback } from 'react';

export const useNodeFactory = (nodes, setNodes, nodeCount, setNodeCount) => {

    const addNode = useCallback((type, position = null) => {
        const id = `${nodeCount}`;

        // Default position if not provided (e.g. from context menu)
        // Ideally center of screen, but here we just offset from last node or fixed
        const defaultPos = { x: 250, y: 5 + (nodes.length * 100) };
        const finalPos = position || defaultPos;

        let newNode = {
            id,
            type,
            position: finalPos,
            data: {
                label: `${type} Node`,
                title: type, // Default title
                state: 0, // 0: Idle, 1: Running, 2: Done, 3: Error
                error: null,
                inputs: [],
                outputs: []
            },
        };

        // Specific configurations based on type
        if (type === 'CustomNode') {
            newNode.data.title = 'Manual Node ' + id;
            newNode.data.code = "# Write your Python code here\noutput = 'Hello World'";
            newNode.data.inputs = [{ id: 'in1', name: 'input1' }];
            newNode.data.outputs = [{ id: 'out1', name: 'output' }];
        } else if (type === 'FastNode') {
            newNode.data.title = 'Fast Node ' + id;
            newNode.data.code = "# Safe default: check if input exists\noutput = (input1 * 2) if 'input1' in locals() else 0";
            newNode.data.inputs = [{ id: 'in1', name: 'input1' }];
            newNode.data.outputs = [{ id: 'out1', name: 'output' }];
        } else if (type === 'NumberNode') {
            newNode.data.title = 'Number ' + id;
            newNode.data.value = 0;
            newNode.data.code = "output = 0";
            newNode.data.outputs = [{ id: 'out1', name: 'output' }];
        } else if (type === 'BooleanNode') {
            newNode.data.title = 'Boolean ' + id;
            newNode.data.value = false;
            newNode.data.code = "output = False";
            newNode.data.outputs = [{ id: 'out1', name: 'output' }];
        } else if (type === 'StringNode') {
            newNode.data.title = 'String ' + id;
            newNode.data.value = "";
            newNode.data.code = 'output = ""';
            newNode.data.outputs = [{ id: 'out1', name: 'output' }];
        } else if (type === 'FileNode') {
            newNode.data.title = 'File ' + id;
            newNode.data.fileName = null;
            newNode.data.value = null; // Path
            newNode.data.code = "# Upload a file to set path";
            newNode.data.outputs = [{ id: 'out1', name: 'output' }];
        } else if (type === 'ObserverNode') {
            newNode.data.title = 'Observer ' + id;
            newNode.data.inputs = [{ id: 'in1', name: 'input' }];
        }

        setNodes((nds) => nds.concat(newNode));
        setNodeCount((count) => count + 1);
    }, [nodes, nodeCount, setNodes, setNodeCount]);

    return { addNode };
};
