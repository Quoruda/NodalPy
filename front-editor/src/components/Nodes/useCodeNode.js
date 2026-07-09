import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useFlowContext } from '../FlowContext.jsx';
import { uiRegistry } from '../../core/uiRegistry';

const arraysEqualObjects = (a, b) => {
    if (a === b) return true;
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i].id !== b[i].id || a[i].name !== b[i].name) return false;
    }
    return true;
};

const generateUniqueId = () =>
    `var_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

export const useCodeNode = (data, config = null) => {
    const { timeout = null } = (config && typeof config === 'object') ? config : {};

    const [isEditing, setIsEditing] = useState(false);
    const [tempTitle, setTempTitle] = useState(data.title || 'Code Node');
    const [inputs, setInputs] = useState(data.inputs || []);
    const [outputs, setOutputs] = useState(data.outputs || []);

    const prevDataRef = useRef({});
    const throttleRef = useRef(null);
    const { addNodeToQueue, updateNode, nodes, sendMessage } = useFlowContext();

    // Sync title/inputs/outputs from props (e.g. on project load)
    useEffect(() => {
        const prevData = prevDataRef.current;
        let hasChanged = false;

        if (!prevData || prevData.title !== data.title) {
            if (!isEditing) setTempTitle(data.title || 'Code Node');
            hasChanged = true;
        }
        if (!prevData || !arraysEqualObjects(prevData.inputs, data.inputs)) {
            if (!isEditing) setInputs(data.inputs || []);
            hasChanged = true;
        }
        if (!prevData || !arraysEqualObjects(prevData.outputs, data.outputs)) {
            if (!isEditing) setOutputs(data.outputs || []);
            hasChanged = true;
        }

        if (hasChanged) {
            prevDataRef.current = {
                title: data.title,
                inputs: data.inputs,
                outputs: data.outputs,
            };
        }
    }, [data.title, data.inputs, data.outputs, isEditing]);

    // Stable ref to latest data — avoids stale closures without adding deps
    const dataRef = useRef(data);
    dataRef.current = data;

    const runCode = useCallback((overrideData = null) => {
        // Guard against React SyntheticEvent being passed via onClick={runCode}
        const isPlainObject =
            overrideData &&
            typeof overrideData === 'object' &&
            !overrideData.target &&
            !overrideData.nativeEvent &&
            !overrideData.preventDefault;

        const dataToRun = isPlainObject
            ? { ...dataRef.current, ...overrideData }
            : dataRef.current;

        addNodeToQueue?.(dataToRun, timeout);
    }, [addNodeToQueue, timeout]);

    // Called by NodeHeader on title blur / Enter
    const handleSave = useCallback(() => {
        setIsEditing(false);
    }, []);

    const validVarRegex = useMemo(() => /^[A-Za-z_][A-Za-z0-9_]*$/, []);

    const makeUnique = (prev, index, name) => {
        let finalName = name;
        if (prev.some((p, i) => i !== index && p.name === finalName)) {
            let j = 2;
            while (prev.some((p, i) => i !== index && p.name === `${finalName}_${j}`)) j++;
            finalName = `${finalName}_${j}`;
        }
        return finalName;
    };

    const updateInput = useCallback((index, newName) => {
        setInputs(prev => {
            const finalName = makeUnique(prev, index, newName);
            const updated = [...prev];
            if (finalName === '' || validVarRegex.test(finalName)) {
                updated[index] = { ...updated[index], name: finalName };
            }
            return updated;
        });
    }, [validVarRegex]);

    const updateOutput = useCallback((index, newName) => {
        setOutputs(prev => {
            const finalName = makeUnique(prev, index, newName);
            const updated = [...prev];
            if (finalName === '' || validVarRegex.test(finalName)) {
                updated[index] = { ...updated[index], name: finalName };
            }
            return updated;
        });
    }, [validVarRegex]);

    const addInput = useCallback(() => {
        setInputs(prev => {
            let i = 1;
            while (prev.some(p => p.name === `input${i}`)) i++;
            return [...prev, { id: generateUniqueId(), name: `input${i}` }];
        });
    }, []);

    const addOutput = useCallback(() => {
        setOutputs(prev => {
            let i = 1;
            while (prev.some(p => p.name === `output${i}`)) i++;
            return [...prev, { id: generateUniqueId(), name: `output${i}` }];
        });
    }, []);

    const removeInput = useCallback((index) => {
        setInputs(prev => prev.filter((_, i) => i !== index));
    }, []);

    const removeOutput = useCallback((index) => {
        setOutputs(prev => prev.filter((_, i) => i !== index));
    }, []);

    const handleCodeChange = useCallback((value) => {
        if (throttleRef.current) clearTimeout(throttleRef.current);
        updateNode(data.id, { code: value });
        throttleRef.current = setTimeout(() => {
            data.onChange?.(data.id, value);
        }, 100);
    }, [data, updateNode]);

    // Cleanup debounce on unmount
    useEffect(() => () => { if (throttleRef.current) clearTimeout(throttleRef.current); }, []);

    // Auto-sync local inputs/outputs to global node state
    useEffect(() => {
        if (!arraysEqualObjects(data.inputs, inputs) || !arraysEqualObjects(data.outputs, outputs)) {
            updateNode(data.id, { inputs, outputs });
        }
    }, [inputs, outputs, updateNode, data.id, data.inputs, data.outputs]);

    const isInitializedRef = useRef(false);

    useEffect(() => {
        if (isInitializedRef.current || !sendMessage) return;

        const fullNode = nodes.find(n => n.id === data.id);
        if (!fullNode) return;

        isInitializedRef.current = true;

        const registeredNode = uiRegistry.slots.nodeTypes.find(n => n.type === fullNode.type);
        const isAutoTrigger = registeredNode?.config?.autoTrigger;
        const forceRunOnLoad = registeredNode?.config?.forceRunOnLoad;

        if (forceRunOnLoad) {
            setTimeout(() => runCode(), 300);
        } else {
            if (outputs && outputs.length > 0) {
                outputs.forEach(out => {
                    sendMessage({
                        action: "get_variable",
                        node: fullNode.id,
                        name: out.name
                    });
                });
            } else if (isAutoTrigger) {
                setTimeout(() => runCode(), 300);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return {
        isEditing, setIsEditing,
        tempTitle, setTempTitle,
        inputs, setInputs,
        outputs, setOutputs,
        handleSave,
        runCode,
        updateInput, removeInput, addInput,
        updateOutput, removeOutput, addOutput,
        handleCodeChange,
        updateNode,
    };
};
