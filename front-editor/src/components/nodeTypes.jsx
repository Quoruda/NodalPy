import React, { useEffect, useState, useCallback, memo, useMemo, useRef } from 'react';
import { Handle, Position } from '@xyflow/react';
import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import AutosizeInput from 'react-input-autosize';
import { EditorView } from '@codemirror/view';
import { useFlowContext } from './FlowContext.jsx';
import './nodes.css';

// ✅ Utilitaire pour comparer les arrays sans JSON.stringify
const arraysEqual = (a, b) => {
    if (a === b) return true;
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
};

// ✅ Extensions CodeMirror memoized globalement pour éviter les re-créations
const CODE_EXTENSIONS = [python()];
const OUTPUT_EXTENSIONS = [python(), EditorView.lineWrapping];

// ✅ Configuration CodeMirror stable
const CODE_BASIC_SETUP = {
    lineNumbers: true,
    foldGutter: false,
    dropCursor: false,
    allowMultipleSelections: false
};

const OUTPUT_BASIC_SETUP = {
    ...CODE_BASIC_SETUP,
    searchKeymap: false,
    closeBrackets: false,
    autocompletion: false
};

// ✅ Composant InputHandle optimisé avec comparaison shallow
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
), (prevProps, nextProps) => {
    return prevProps.input === nextProps.input &&
           prevProps.index === nextProps.index &&
           prevProps.isEditing === nextProps.isEditing &&
           prevProps.isConnectable === nextProps.isConnectable &&
           prevProps.updateInput === nextProps.updateInput;
});

// ✅ Composant OutputHandle optimisé
const OutputHandle = memo(({ output, index, isEditing, updateOutput }) => (
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
            isConnectable={true}
        />
    </div>
), (prevProps, nextProps) => {
    return prevProps.output === nextProps.output &&
           prevProps.index === nextProps.index &&
           prevProps.isEditing === nextProps.isEditing &&
           prevProps.updateOutput === nextProps.updateOutput;
});

// ✅ Composant Header optimisé
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

    // ✅ Refs pour éviter les re-créations et optimiser les comparaisons
    const prevDataRef = useRef();
    const nodeId = data.id;

    const { edges } = useFlowContext();

    // ✅ Optimisation: synchronisation plus efficace avec les props
    useEffect(() => {
        const prevData = prevDataRef.current;
        let hasChanged = false;

        if (!prevData || prevData.title !== data.title) {
            if (!isEditing) {
                setTempTitle(data.title || 'Code Node');
            }
            hasChanged = true;
        }

        if (!prevData || !arraysEqual(prevData.inputs, data.inputs)) {
            if (!isEditing) {
                setInputs(data.inputs || []);
            }
            hasChanged = true;
        }

        if (!prevData || !arraysEqual(prevData.outputs, data.outputs)) {
            if (!isEditing) {
                setOutputs(data.outputs || []);
            }
            hasChanged = true;
        }

        if (hasChanged) {
            prevDataRef.current = {
                title: data.title,
                inputs: data.inputs,
                outputs: data.outputs
            };
        }
    }, [data.title, data.inputs, data.outputs, isEditing]);

    // ✅ Callbacks stables avec useCallback et dépendances optimisées
    const runCode = useCallback(() => {
        data.runCode?.(data);
    }, [data.runCode, data.id, data.code]); // Seulement les props nécessaires

    const handleSave = useCallback(() => {
        data.onUpdate?.(data.id, {
            title: tempTitle,
            inputs: inputs,
            outputs: outputs,
        });
        setIsEditing(false);
    }, [data.onUpdate, data.id, tempTitle, inputs, outputs]);

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

    // ✅ Handler de changement de code avec throttling pour éviter trop d'appels
    const throttleRef = useRef(null);
    const handleCodeChange = useCallback((value) => {
        // Throttle les changements pour éviter trop de re-renders
        if (throttleRef.current) {
            clearTimeout(throttleRef.current);
        }

        throttleRef.current = setTimeout(() => {
            data.onChange?.(data.id, value);
        }, 100); // 100ms de throttle
    }, [data.onChange, data.id]);

    // ✅ Optimisation majeure: isConnectable memoized avec une dépendance précise
    const connectionStatus = useMemo(() => {
        const nodeEdges = edges.filter(e => e.target === nodeId);
        return inputs.map((_, index) => {
            const handleId = `in${index + 1}`;
            return nodeEdges.filter(e => e.targetHandle === handleId).length < 1;
        });
    }, [edges, nodeId, inputs.length]);

    // ✅ Memoization des listes avec dépendances optimisées
    const inputHandles = useMemo(() =>
        inputs.map((input, index) => (
            <InputHandle
                key={`input-${index}`} // Clé stable
                input={input}
                index={index}
                isEditing={isEditing}
                updateInput={updateInput}
                isConnectable={connectionStatus[index]}
            />
        )),
        [inputs, isEditing, updateInput, connectionStatus]
    );

    const outputHandles = useMemo(() =>
        outputs.map((output, index) => (
            <OutputHandle
                key={`output-${index}`} // Clé stable
                output={output}
                index={index}
                isEditing={isEditing}
                updateOutput={updateOutput}
            />
        )),
        [outputs, isEditing, updateOutput]
    );

    // ✅ Cleanup du throttle
    useEffect(() => {
        return () => {
            if (throttleRef.current) {
                clearTimeout(throttleRef.current);
            }
        };
    }, []);

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

                {/* ✅ CodeMirror optimisé avec key stable et props memoized */}
                <div style={{ width: '100%' }}>
                    <CodeMirror
                        value={data.code || ''}
                        height="auto"
                        extensions={CODE_EXTENSIONS}
                        onChange={handleCodeChange}
                        theme="dark"
                        basicSetup={CODE_BASIC_SETUP}
                    />
                </div>

                {/* ✅ Output avec rendu conditionnel optimisé */}
                {data.output && data.output.trim() && (
                    <div style={{
                        marginTop: 8,
                        width: '100%',
                        maxWidth: '100%',
                        overflowX: 'auto',
                    }}>
                        <CodeMirror
                            value={data.output}
                            height="auto"
                            extensions={OUTPUT_EXTENSIONS}
                            theme="dark"
                            basicSetup={OUTPUT_BASIC_SETUP}
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

// ✅ Export avec memo et comparaison optimisée
export const nodeTypes = {
    functionNode: memo(CodeNode, (prevProps, nextProps) => {
        // ✅ Comparaisons rapides en premier
        if (prevProps.data === nextProps.data) return true;

        const prev = prevProps.data;
        const next = nextProps.data;

        // ✅ Comparaisons primitives d'abord (plus rapides)
        if (prev.id !== next.id) return false;
        if (prev.code !== next.code) return false;
        if (prev.title !== next.title) return false;
        if (prev.state !== next.state) return false;
        if (prev.output !== next.output) return false;

        // ✅ Comparaisons d'arrays en dernier (plus coûteuses)
        if (!arraysEqual(prev.inputs, next.inputs)) return false;
        if (!arraysEqual(prev.outputs, next.outputs)) return false;

        // ✅ Comparaison des fonctions callback (importantes pour éviter les re-renders)
        if (prev.onChange !== next.onChange) return false;
        if (prev.onUpdate !== next.onUpdate) return false;
        if (prev.runCode !== next.runCode) return false;

        return true;
    }),
};