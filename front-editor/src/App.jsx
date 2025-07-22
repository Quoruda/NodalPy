import React, { useCallback, useState } from 'react';
import {
    ReactFlow,
    useNodesState,
    useEdgesState,
    addEdge,
    Handle,
    Position,
    Controls,
    MiniMap,
    Background
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './App.css'; // Ajoute tes styles ici

// Définition du node personnalisé avec un éditeur de texte
function FunctionNode({ id, data, isConnectable }) {
    return (
        <div className="custom-node">
            <div className="custom-node-header">Node {id}</div>
            <textarea
                value={data.code || ''}
                onChange={(e) => data.onChange(id, e.target.value)}
                className="code-editor"
                placeholder="Écris ton code ici..."
            />
            <Handle type="target" position={Position.Left} className="handle input-handle" isConnectable={isConnectable} />
            <Handle type="source" position={Position.Right} className="handle output-handle" isConnectable={isConnectable} />
        </div>
    );
}

const nodeTypes = {
    functionNode: FunctionNode,
};

const initialNodes = [
    {
        id: 'fn1',
        type: 'functionNode',
        data: { code: 'load_image("path")' },
        position: { x: 200, y: 100 },
    },
    {
        id: 'fn2',
        type: 'functionNode',
        data: { code: 'resize(width, height)' },
        position: { x: 500, y: 100 },
    },
];

const initialEdges = [
    { id: 'e1-2', source: 'fn1', target: 'fn2' },
];

export default function App() {
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [nodeCount, setNodeCount] = useState(3);

    const onConnect = useCallback(
        (params) => setEdges((eds) => addEdge(params, eds)),
        [setEdges]
    );

    // Callback pour modifier le code d'un noeud
    const updateNodeCode = (nodeId, newCode) => {
        setNodes((nds) =>
            nds.map((node) =>
                node.id === nodeId
                    ? {
                        ...node,
                        data: {
                            ...node.data,
                            code: newCode,
                            onChange: updateNodeCode,
                        },
                    }
                    : node
            )
        );
    };

    // Ajout d’un nouveau noeud avec une textarea vide
    const addNode = () => {
        const newNode = {
            id: `fn${nodeCount}`,
            type: 'functionNode',
            data: {
                code: '',
                onChange: updateNodeCode,
            },
            position: { x: 100 + nodeCount * 50, y: 100 + nodeCount * 50 },
        };
        setNodes((nds) => [...nds, newNode]);
        setNodeCount((count) => count + 1);
    };

    // Injecte updateNodeCode dans chaque noeud existant au démarrage
    const preparedNodes = nodes.map((node) => ({
        ...node,
        data: {
            ...node.data,
            onChange: updateNodeCode,
        },
    }));

    return (
        <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
            <button className="add-node-button" onClick={addNode}>
                Ajouter un nœud
            </button>

            <ReactFlow
                nodes={preparedNodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                fitView
            >
                <Background variant="dots" gap={16} size={1} />
                <MiniMap nodeColor={(n) => (n.type === 'functionNode' ? '#ffcc00' : '#aaa')} />
                <Controls />
            </ReactFlow>
        </div>
    );
}
