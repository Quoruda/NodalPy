import React, { useEffect, useState, useCallback, memo, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import AutosizeInput from 'react-input-autosize';
import { EditorView } from '@codemirror/view';
import { useFlowContext } from './FlowContext.jsx';
import './nodes.css';

// ✅ Composant InputHandle optimisé et memoized
const InputHandle = memo(({ input, index, isEditing, updateInput, isConnectable }) => (
    <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
        <Handle
            type="target"
            position={Position.Left}
            id={`in${index + 1}`}
            style={{ background: 'blue' }}
            isConnectable={isConnectable}
        />
        {isEditing ? (
            <AutosizeInput
                value={input}
                onChange={(e) => updateInput(index, e.target.value)}
                className="var-input"
                placeholder="input"
            />
        ) : (
            <span style={{ marginLeft: 8, whiteSpace: 'nowrap' }}>{input}</span>
        )}
    </div>
));

// ✅ Composant OutputHandle optimisé et memoized
const OutputHandle = memo(({ output, index, isEditing, updateOutput, isConnectable }) => (
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
            isConnectable={isConnectable}
        />
    </div>
));

// ✅ Composant Header optimisé et memoized
const NodeHeader = memo(({
    isEditing,
    tempTitle,
    setTempTitle,
    handleSave,
    setIsEditing,
    title,
    state,
    runCode
}) => (
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
                <span>{title || 'Code Node'}</span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
                    <button
                        onClick={() => setIsEditing(true)}
                        title="Modifier le titre"
                    >
                        ✏️
                    </button>
                    {state === 0 && (
                        <button
                            onClick={runCode}
                            className="execute-button"
                            title="Exécuter"
                        >
                            ▶
                        </button>
                    )}
                    {state === 1 && (
                        <div
                            className="running-button"
                            title="Attendre"
                        >
                            ⏱
                        </div>
                    )}
                    {state === 2 && (
                        <button
                            onClick={runCode}
                            className="execute-button"
                            title="Ré-exécuter"
                        >
                            🔄
                        </button>
                    )}
                </div>
            </>
        )}
    </div>
));

function CodeNode({ data }) {
    const [isEditing, setIsEditing] = useState(false);
    const [tempTitle, setTempTitle] = useState(data.title || 'Code Node');
    const [inputs, setInputs] = useState(data.inputs || []);
    const [outputs, setOutputs] = useState(data.outputs || []);
    const { edges, nodes } = useFlowContext();

    // ✅ Synchroniser avec les props seulement quand nécessaire
    useEffect(() => {
        if (data.title !== tempTitle && !isEditing) {
            setTempTitle(data.title || 'Code Node');
        }
    }, [data.title, tempTitle, isEditing]);

    useEffect(() => {
        if (JSON.stringify(data.inputs) !== JSON.stringify(inputs) && !isEditing) {
            setInputs(data.inputs || []);
        }
    }, [data.inputs, inputs, isEditing]);

    useEffect(() => {
        if (JSON.stringify(data.outputs) !== JSON.stringify(outputs) && !isEditing) {
            setOutputs(data.outputs || []);
        }
    }, [data.outputs, outputs, isEditing]);

    // ✅ Callbacks stables avec useCallback
    const runCode = useCallback(() => {
        data.runCode?.(data);
    }, [data]);

    const handleSave = useCallback(() => {
        data.onUpdate?.(data.id, {
            title: tempTitle,
            inputs: inputs,
            outputs: outputs,
        });
        setIsEditing(false);
    }, [data, tempTitle, inputs, outputs]);

    const updateInput = useCallback((index, value) => {
        setInputs(prev => {
            const updated = [...prev];
            updated[index] = value;
            return updated;
        });
    }, []);

    const updateOutput = useCallback((index, value) => {
        setOutputs(prev => {
            const updated = [...prev];
            updated[index] = value;
            return updated;
        });
    }, []);

    const addInput = useCallback(() => {
        setInputs(prev => [...prev, '']);
    }, []);

    const addOutput = useCallback(() => {
        setOutputs(prev => [...prev, '']);
    }, []);

    // ✅ Extensions CodeMirror memoized pour éviter les re-créations
    const codeMirrorExtensions = useMemo(() => [python()], []);
    const outputExtensions = useMemo(() => [python(), EditorView.lineWrapping], []);

    // ✅ Handler de changement de code optimisé
    const handleCodeChange = useCallback((value) => {
        data.onChange?.(data.id, value);
    }, [data]);


    const nodeId = data.id;
    const isConnectable = useCallback((index) => {
        const incoming = edges.filter(e => e.target === nodeId && e.targetHandle===`in${index + 1}`).length;
        return incoming < 1;
    }, [edges, nodeId]);

    // ✅ Memoization des listes pour éviter les re-renders
    const inputHandles = useMemo(() =>
            inputs.map((input, index) => (
                <InputHandle
                    key={index}
                    input={input}
                    index={index}
                    isEditing={isEditing}
                    updateInput={updateInput}
                    isConnectable={isConnectable(index)}
                />
            )),
            [inputs, isEditing, updateInput,isConnectable]
    );

    const outputHandles = useMemo(() =>
        outputs.map((output, index) => (
            <OutputHandle
                key={index}
                output={output}
                index={index}
                isEditing={isEditing}
                updateOutput={updateOutput}
                isConnectable={true}
            />
        )),
        [outputs, isEditing, updateOutput]
    );

    console.log(edges)

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
                {inputHandles}
                {isEditing && (
                    <button onClick={addInput} style={{ fontSize: '0.8rem' }}>
                        + entrée
                    </button>
                )}
            </div>

            {/* Zone centrale */}
            <div style={{ flexGrow: 1 }}>
                <NodeHeader
                    isEditing={isEditing}
                    tempTitle={tempTitle}
                    setTempTitle={setTempTitle}
                    handleSave={handleSave}
                    setIsEditing={setIsEditing}
                    title={data.title}
                    state={data.state}
                    runCode={runCode}
                />

                {/* ✅ CodeMirror avec key pour éviter les re-montages */}
                <div style={{ width: '100%' }}>
                    <CodeMirror
                        key={`code-${data.id}`}
                        value={data.code || ''}
                        height="auto"
                        extensions={codeMirrorExtensions}
                        onChange={handleCodeChange}
                        theme="dark"
                        basicSetup={{
                            lineNumbers: true,
                            foldGutter: false, // ✅ Désactiver pour les performances
                            dropCursor: false,
                            allowMultipleSelections: false
                        }}
                    />
                </div>

                {/* ✅ Output avec affichage conditionnel optimisé */}
                {data.output && (
                    <div style={{
                        marginTop: 8,
                        width: '100%',
                        maxWidth: '100%',
                        overflowX: 'auto',
                    }}>
                        <CodeMirror
                            key={`output-${data.id}`}
                            value={data.output}
                            height="auto"
                            extensions={outputExtensions}
                            theme="dark"
                            basicSetup={{
                                lineNumbers: true,
                                foldGutter: false,
                                dropCursor: false,
                                allowMultipleSelections: false
                            }}
                            editable={false}
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
                {outputHandles}
                {isEditing && (
                    <button onClick={addOutput} style={{ fontSize: '0.8rem' }}>
                        + sortie
                    </button>
                )}
            </div>
        </div>
    );
}

// ✅ Export avec memo pour éviter les re-renders inutiles
export const nodeTypes = {
    functionNode: memo(CodeNode, (prevProps, nextProps) => {
        // ✅ Comparaison personnalisée pour optimiser les re-renders
        return (
            prevProps.data.code === nextProps.data.code &&
            prevProps.data.title === nextProps.data.title &&
            prevProps.data.state === nextProps.data.state &&
            prevProps.data.output === nextProps.data.output &&
            JSON.stringify(prevProps.data.inputs) === JSON.stringify(nextProps.data.inputs) &&
            JSON.stringify(prevProps.data.outputs) === JSON.stringify(nextProps.data.outputs) &&
            prevProps.isConnectable === nextProps.isConnectable
        );
    }),
};