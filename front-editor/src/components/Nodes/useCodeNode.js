import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useFlowContext } from '../FlowContext.jsx';
import { CustomNodeOperations } from './CustomNode/CustomNodeOperations.js';

const arraysEqualObjects = (a, b) => {
    if (a === b) return true;
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i].id !== b[i].id || a[i].name !== b[i].name) return false;
    }
    return true;
};

const generateUniqueId = () => {
    return `var_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// config can be a number (timeout) for backward compatibility, or an object
export const useCodeNode = (data, config = null) => {
    // Parse config
    let timeout = null;
    let autoTrigger = false;

    if (typeof config === 'number') {
        timeout = config;
        autoTrigger = true; // Legacy assumption: if timeout set, it's auto-node? 
        // Wait, CustomNode passes null. FileNode passes 0.5.
        // Let's force explicit config.
    } else if (typeof config === 'object' && config !== null) {
        timeout = config.timeout;
        autoTrigger = config.autoTrigger;
    } else {
        // Fallback if null passed (CustomNode)
        timeout = null;
        autoTrigger = false;
    }

    const [isEditing, setIsEditing] = useState(false);
    const [tempTitle, setTempTitle] = useState(data.title || 'Code Node');
    const [inputs, setInputs] = useState(data.inputs || []);
    const [outputs, setOutputs] = useState(data.outputs || []);

    const prevDataRef = useRef({});
    const throttleRef = useRef(null);
    const { edges, nodes, setNodes, wsRef } = useFlowContext();
    const { addNodeToQueue, updateNode, runCode: runCodeOp, triggerDownstreamNodes } = CustomNodeOperations(setNodes, wsRef, nodes, edges);

    // Sync with props
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
                outputs: data.outputs
            };
        }
    }, [data.title, data.inputs, data.outputs, isEditing]);

    // Use ref to access current data in callbacks without adding dependencies
    const dataRef = useRef(data);
    dataRef.current = data;

    const runCode = useCallback((overrideData = null) => {
        // We pass the validation/queuing logic to runCodeOp
        // Note: runCodeOp in CustomNodeOperations needs to handle timeout if we pass it
        // Since CustomNodeOperations doesn't support timeout argument yet, we will update it later.
        // For now, assume it uses node properties or we patch it.
        // ACTUALLY, runCodeOp calls ws.send. We should probably update runCodeOp signature.

        // However, addNodeToQueue is mostly for prerequisites.
        const dataToRun = overrideData ? { ...dataRef.current, ...overrideData } : dataRef.current;
        addNodeToQueue?.(dataToRun, timeout);
    }, [addNodeToQueue, timeout]);

    const handleSave = useCallback(() => {
        data.onUpdate?.(data.id, {
            title: tempTitle,
            inputs: inputs,
            outputs: outputs,
        });
        setIsEditing(false);
    }, [data, tempTitle, inputs, outputs]);

    const validVarRegex = useMemo(() => /^[A-Za-z_][A-Za-z0-9_]*$/, []);

    const updateInput = useCallback((index, newName) => {
        setInputs(prev => {
            const updated = [...prev];
            if (newName === '' || validVarRegex.test(newName)) {
                updated[index] = { ...updated[index], name: newName };
            }
            return updated;
        });
    }, [validVarRegex]);

    const updateOutput = useCallback((index, newName) => {
        setOutputs(prev => {
            const updated = [...prev];
            if (newName === '' || validVarRegex.test(newName)) {
                updated[index] = { ...updated[index], name: newName };
            }
            return updated;
        });
    }, [validVarRegex]);

    const addInput = useCallback(() => {
        setInputs(prev => [...prev, { id: generateUniqueId(), name: '' }]);
    }, []);

    const addOutput = useCallback(() => {
        setOutputs(prev => [...prev, { id: generateUniqueId(), name: '' }]);
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

    useEffect(() => {
        return () => {
            if (throttleRef.current) clearTimeout(throttleRef.current);
        };
    }, []);

    // Auto-sync inputs/outputs to global state
    useEffect(() => {
        // Prevent infinite loops: only update if data actually changed
        if (!arraysEqualObjects(data.inputs, inputs) || !arraysEqualObjects(data.outputs, outputs)) {
            updateNode(data.id, { inputs, outputs });
        }
    }, [inputs, outputs, updateNode, data.id, data.inputs, data.outputs]);

    // Centralized Downstream Trigger Logic
    const prevStateRef = useRef(data.state);
    useEffect(() => {
        if (autoTrigger) {
            if (data.state === 2 && !data.error && prevStateRef.current !== 2) {
                triggerDownstreamNodes(data.id);
            }
            prevStateRef.current = data.state;
        }
    }, [data.state, data.error, data.id, triggerDownstreamNodes, autoTrigger]);



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
        triggerDownstreamNodes,
        updateNode
    };
};
