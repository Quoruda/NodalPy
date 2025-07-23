import React, {useCallback, useEffect, useState} from 'react';
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
import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';


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

function CodeNode({ data, isConnectable }) {
    return (
        <div className="custom-node">
            <div className="custom-node-header">
                <span>Code Node</span>
                <button
                    onClick={() => data.onExecute?.(data.code)}
                    className="execute-button"
                    title="Exécuter"
                >
                    ▶
                </button>
            </div>

            <div style={{ width: 'auto' }}>
                <CodeMirror
                    value={data.code}
                    height="auto"
                    extensions={[python()]}
                    onChange={(value) => data.onChange(value)}
                    theme="dark"
                    basicSetup={{ lineNumbers: true }}
                />
            </div>

            <Handle type="target" position={Position.Left} className="handle input-handle" isConnectable={isConnectable} />
            <Handle type="source" position={Position.Right} className="handle output-handle" isConnectable={isConnectable} />
        </div>
    );
}



const nodeTypes = {
    functionNode: CodeNode,
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

    const [selectedEdge, setSelectedEdge] = useState(null);

    // Supprimer avec "Delete"
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'Delete' && selectedEdge) {
                setEdges((eds) => eds.filter((e) => e.id !== selectedEdge.id));
                setSelectedEdge(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedEdge, setEdges]);

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

    const styledEdges = edges.map((edge) => ({
        ...edge,
        style: {
            stroke: edge.id === selectedEdge?.id ? '#ff0072' : '#999',
            strokeWidth: edge.id === selectedEdge?.id ? 3 : 1.5,
        },
    }));


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
                edges={styledEdges}
                onEdgeClick={(_, edge) => setSelectedEdge(edge)}
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
