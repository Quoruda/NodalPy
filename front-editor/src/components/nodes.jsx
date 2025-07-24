import React, {useState} from 'react';
import { Handle, Position } from '@xyflow/react';
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

export default function CodeNode({ data, isConnectable }) {
    const [output, setOutput] = useState('');
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [tempTitle, setTempTitle] = useState(data.title || 'Code Node');

    const runCode = async () => {
        try {
            const res = await fetch('http://localhost:8000/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: data.code }),
            });

            const result = await res.json();
            setOutput(result.output || result.error || 'Aucune sortie');
        } catch (err) {
            setOutput("Erreur lors de l'appel API");
        }
    };

    const handleTitleSave = () => {
        data.onTitleChange?.(data.id, tempTitle); // appelle le callback du parent
        setIsEditingTitle(false);
    };

    return (
        <div className="custom-node">
            <div className="custom-node-header">
                {isEditingTitle ? (
                    <div style={{ display: 'flex', gap: '4px' }}>
                        <input
                            value={tempTitle}
                            onChange={(e) => setTempTitle(e.target.value)}
                            className="title-input"
                            autoFocus
                        />
                        <button onClick={handleTitleSave}>✅</button>
                    </div>
                ) : (
                    <>
                        <span>{data.title || 'Code Node'}</span>
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
                            <button
                                onClick={() => setIsEditingTitle(true)}
                                title="Modifier le titre"
                            >
                                ✏️
                            </button>
                            <button
                                onClick={runCode}
                                className="execute-button"
                                title="Exécuter"
                            >
                                ▶
                            </button>
                        </div>
                    </>
                )}
            </div>

            <div style={{ width: 'auto' }}>
                <CodeMirror
                    value={data.code}
                    height="auto"
                    extensions={[python()]}
                    onChange={(value) => data.onChange(data.id, value)}
                    theme="dark"
                    basicSetup={{ lineNumbers: true }}
                />
            </div>

            {output && (
                <pre className="output">
                    {output}
                </pre>
            )}

            <Handle type="target" position={Position.Left} isConnectable={isConnectable} />
            <Handle type="source" position={Position.Right} isConnectable={isConnectable} />
        </div>
    );
}





export const nodeTypes = {
    functionNode: CodeNode,
};