import React, {useState} from 'react';
import { Handle, Position } from '@xyflow/react';
import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import AutosizeInput from 'react-input-autosize';

import { EditorView } from '@codemirror/view';

import './nodes.css';

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
    const [isEditing, setIsEditing] = useState(false);
    const [tempTitle, setTempTitle] = useState(data.title || 'Code Node');
    const [inputs, setInputs] = useState(data.inputs || []);
    const [outputs, setOutputs] = useState(data.outputs || []);


    const runCode = async () => {
        data.runCode?.(data);
    };

    const handleSave = () => {
        console.log(data)
        data.onUpdate?.(data.id, {
            title: tempTitle,
            code: data.code,
            inputs: inputs,
            outputs: outputs,
            output: data.output,
        });
        setIsEditing(false);
    };

    const updateInput = (index, value) => {
        const updated = [...inputs];
        updated[index] = value;
        setInputs(updated);
    };

    const updateOutput = (index, value) => {
        const updated = [...outputs];
        updated[index] = value;
        setOutputs(updated);
    };

    const addInput = () => {
        setInputs([...inputs, '']);
    };

    const addOutput = () => {
        setOutputs([...outputs, '']);
    };

    return (
        <div
            className="custom-node"
            style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                padding: '8px',
                maxWidth: '100%',
                width: 'auto',
            }}
        >
            {/* Colonne entrées */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: '4px',
                width: 'auto',
            }}>
                {inputs.map((input, index) => (
                    <div key={index}   style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                        <Handle
                            key={`input-${index}`}
                            type="target"
                            position={Position.Left}
                            id={`in${index + 1}`}
                            style={{ background: 'blue' }}
                            isConnectable={isConnectable}
                        />

                        {isEditing ? (
                            <AutosizeInput
                                key={index}
                                value={input}
                                onChange={(e) => updateInput(index, e.target.value)}
                                className="var-input"
                                placeholder="input"
                            />
                        ) : (

                                <span style={{ marginLeft: 8, whiteSpace: 'nowrap' }}>{input}</span>
                        )}

                    </div>


                ))}
                {isEditing && (
                    <button onClick={addInput} style={{ fontSize: '0.8rem' }}>+ entrée</button>
                )}
            </div>

            {/* Zone centrale */}
            <div style={{ flexGrow: 1}}>
                <div className="custom-node-header">
                    {isEditing ? (
                        <div style={{ display: 'flex', gap: '4px' }}>
                            <AutosizeInput
                                value={tempTitle}
                                onChange={(e) => setTempTitle(e.target.value)}
                                className="title-input"
                                autoFocus
                            />
                            <button onClick={handleSave}>✅</button>
                        </div>
                    ) : (
                        <>
                            <span>{data.title || 'Code Node'}</span>
                            <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
                                <button
                                    onClick={() => setIsEditing(true)}
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

                <div style={{ width: '100%' }}>
                    <CodeMirror
                        value={data.code}
                        height="auto"
                        extensions={[python()]}
                        onChange={(value) => data.onChange(data.id, value)}
                        theme="dark"
                        basicSetup={{ lineNumbers: true }}
                    />
                </div>

                {data.output && (
                    <div style={{
                      marginTop: 8,
                      width: '100%',
                      maxWidth: '100%',
                      overflowX: 'auto',            // scroll horizontal si besoin
                    }}>
                      <CodeMirror
                        value={data.output}
                        height="auto"
                        extensions={[ python(), EditorView.lineWrapping ]}
                        theme="dark"
                        basicSetup={{ lineNumbers: true }}
                        editable={false}
                        style={{ width: '100%' }}
                      />
                    </div>
                )}
            </div>

            {/* Colonne sorties */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: '4px',
                width: 'auto',
            }}>
                {outputs.map((output, index) => (
                    <div key={index} style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                        {isEditing ? (
                            <div >
                                <AutosizeInput

                                    value={output}
                                    disabled={!isEditing}
                                    onChange={(e) => updateOutput(index, e.target.value)}
                                    className="var-input"
                                    placeholder="output"
                                />

                            </div>

                        ) : (
                                <span style={{ marginRight: 8, whiteSpace: 'nowrap' }}>{output}</span>

                        )}
                        <Handle
                            key={`output-${index}`}
                            type="source"
                            position={Position.Right}
                            id={`ou${index + 1}`}
                            style={{ background: 'red' }}
                            isConnectable={isConnectable}
                        />

                    </div>
                ))}

                {isEditing && (
                    <button onClick={addOutput} style={{ fontSize: '0.8rem' }}>+ sortie</button>
                )}
            </div>

        </div>
    );
}





export const nodeTypes = {
    functionNode: CodeNode,
};