import React, { useEffect, useState, useCallback, memo, useMemo, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { useFlowContext } from '../../FlowContext.jsx';
import InputHandle from './InputHandle.jsx';
import OutputHandle from './OutputHandle.jsx';
import NodeHeader from './NodeHeader.jsx';
import {

    CODE_EXTENSIONS,
    OUTPUT_EXTENSIONS,
    CODE_BASIC_SETUP,
    OUTPUT_BASIC_SETUP
} from './constants.js';
import './CustomNode.css';

// ✅ Fonction utilitaire pour générer un ID unique
const generateUniqueId = () => {
    return `var_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// ✅ Fonction pour comparer les tableaux d'objets inputs/outputs
const arraysEqualObjects = (a, b) => {
    if (a === b) return true;
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i].id !== b[i].id || a[i].name !== b[i].name) return false;
    }
    return true;
};

const CustomNode = memo(({ data }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [tempTitle, setTempTitle] = useState(data.title || 'Code Node');
    const [inputs, setInputs] = useState(data.inputs || []);
    const [outputs, setOutputs] = useState(data.outputs || []);

    const prevDataRef = useRef();
    const throttleRef = useRef(null);
    const nodeId = data.id;

    const { edges } = useFlowContext();

    // ✅ Synchronisation optimisée avec les props (adaptée pour les objets)
    useEffect(() => {
        const prevData = prevDataRef.current;
        let hasChanged = false;

        if (!prevData || prevData.title !== data.title) {
            if (!isEditing) {
                setTempTitle(data.title || 'Code Node');
            }
            hasChanged = true;
        }

        if (!prevData || !arraysEqualObjects(prevData.inputs, data.inputs)) {
            if (!isEditing) {
                setInputs(data.inputs || []);
            }
            hasChanged = true;
        }

        if (!prevData || !arraysEqualObjects(prevData.outputs, data.outputs)) {
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

    // ✅ Callbacks stables
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

    const validVarRegex = useMemo(() => /^[A-Za-z_][A-Za-z0-9_]*$/, []);


    // ✅ Mise à jour d'un input par son index
    const updateInput = useCallback((index, newName) => {
        setInputs(prev => {
            const updated = [...prev];
            if (newName === '' || validVarRegex.test(newName)) {
                updated[index] = {
                    ...updated[index],
                    name: newName
                };
            }
            return updated;
        });
    }, [validVarRegex]);

    // ✅ Mise à jour d'un output par son index
    const updateOutput = useCallback((index, newName) => {
        setOutputs(prev => {
            const updated = [...prev];
            if (newName === '' || validVarRegex.test(newName)) {
                updated[index] = {
                    ...updated[index],
                    name: newName
                };
            }
            return updated;
        });
    }, [validVarRegex]);


    // ✅ Ajout d'un nouvel input avec ID unique
    const addInput = useCallback(() => {
        const newInput = {
            id: generateUniqueId(),
            name: ''
        };
        setInputs(prev => [...prev, newInput]);
    }, []);

    // ✅ Ajout d'un nouvel output avec ID unique
    const addOutput = useCallback(() => {
        const newOutput = {
            id: generateUniqueId(),
            name: ''
        };
        setOutputs(prev => [...prev, newOutput]);
    }, []);

    // ✅ Suppression d'un input par son index
    const removeInput = useCallback((index) => {
        setInputs(prev => prev.filter((_, i) => i !== index));
    }, []);

    // ✅ Suppression d'un output par son index
    const removeOutput = useCallback((index) => {
        setOutputs(prev => prev.filter((_, i) => i !== index));
    }, []);

    // ✅ Handler avec throttling pour CodeMirror
    const handleCodeChange = useCallback((value) => {
        if (throttleRef.current) {
            clearTimeout(throttleRef.current);
        }

        throttleRef.current = setTimeout(() => {
            data.onChange?.(data.id, value);
        }, 100);
    }, [data]);

    // ✅ Calcul des connexions memoized (adapté pour les objets)
    const connectionStatus = useMemo(() => {
        const nodeEdges = edges.filter(e => e.target === nodeId);
        return inputs.map((_, index) => {
            const handleId = inputs[index].id;
            return nodeEdges.filter(e => e.targetHandle === handleId).length < 1;
        });
    }, [edges, inputs, nodeId]);



    // ✅ Handles memoized (adapté pour les objets inputs/outputs)
    const inputHandles = useMemo(() =>
        inputs.map((input, index) => (
            <InputHandle
                key={input.id} // ✅ Utilisation de l'ID unique comme clé
                id={input.id}
                input={input.name}
                index={index}
                isEditing={isEditing}
                updateInput={updateInput}
                removeInput={removeInput}
                isConnectable={connectionStatus[index]}
            />
        )),
        [inputs, isEditing, updateInput, removeInput, connectionStatus]
    );

    const outputHandles = useMemo(() =>
        outputs.map((output, index) => (
            <OutputHandle
                key={output.id} // ✅ Utilisation de l'ID unique comme clé
                id={output.id}
                output={output.name}
                index={index}
                isEditing={isEditing}
                updateOutput={updateOutput}
                removeOutput={removeOutput}
            />
        )),
        [outputs, isEditing, updateOutput, removeOutput]
    );

    // ✅ Cleanup du throttle
    useEffect(() => {
        return () => {
            if (throttleRef.current) {
                clearTimeout(throttleRef.current);
            }
        };
    }, []);

    console.log(outputs);

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

                {/* ✅ CodeMirror optimisé */}
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
}, (prevProps, nextProps) => {
    // ✅ Comparaison optimisée pour le composant principal (adaptée pour les objets)
    if (prevProps.data === nextProps.data) return true;

    const prev = prevProps.data;
    const next = nextProps.data;

    // Comparaisons rapides d'abord
    if (prev.id !== next.id) return false;
    if (prev.code !== next.code) return false;
    if (prev.title !== next.title) return false;
    if (prev.state !== next.state) return false;
    if (prev.output !== next.output) return false;

    // Comparaisons d'arrays d'objets
    if (!arraysEqualObjects(prev.inputs, next.inputs)) return false;
    if (!arraysEqualObjects(prev.outputs, next.outputs)) return false;

    // Comparaisons des callbacks
    if (prev.onChange !== next.onChange) return false;
    if (prev.onUpdate !== next.onUpdate) return false;
    if (prev.runCode !== next.runCode) return false;

    return true;
});

CustomNode.displayName = 'CustomNode';

export default CustomNode;