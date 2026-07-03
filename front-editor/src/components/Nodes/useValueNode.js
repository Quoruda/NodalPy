import { useState, useEffect, useCallback, useRef } from 'react';
import { useCodeNode } from './useCodeNode.js';
import { useFlowContext } from '../FlowContext.jsx';

export const useValueNode = (id, data, config = {}) => {
    const {
        regex,
        defaultValue,
        formatValue = (v) => v,
        parseValue = (v) => v,
        serialize = (v) => `output = ${v}`,
        matchGroupIndex = 1
    } = config;

    // Reuse useCodeNode for backend communication logic
    const nodeState = useCodeNode({ ...data, id }, { timeout: 0.5, autoTrigger: true });
    const { runCode, updateNode } = nodeState;
    const { isConnected } = useFlowContext();

    // Ref to track the latest data prop to avoid stale closures
    const dataRef = useRef(data);
    useEffect(() => {
        dataRef.current = data;
    }, [data]);

    // Local state
    const [localValue, setLocalValue] = useState(data.value !== undefined ? data.value : defaultValue);
    const [localTitle, setLocalTitle] = useState(data.title || config.defaultTitle || 'Node');

    // Parse code on change
    useEffect(() => {
        if (data.code && regex) {
            const match = data.code.match(regex);
            if (match && match[matchGroupIndex]) {
                try {
                    const parsed = parseValue(match[matchGroupIndex]);
                    setLocalValue(parsed);
                } catch (e) {
                    console.error("Error parsing value:", e);
                }
            }
        }
    }, [data.code, regex]);

    // Auto-run once when the WebSocket connects
    const hasFiredRef = useRef(false);
    const runCodeRef = useRef(runCode);
    useEffect(() => { runCodeRef.current = runCode; }, [runCode]);

    useEffect(() => {
        if (isConnected && !hasFiredRef.current) {
            hasFiredRef.current = true;
            let codeToRun = dataRef.current.code;
            if (!codeToRun) {
                const formatted = formatValue(localValue);
                codeToRun = serialize(formatted);
                updateNode(id, { code: codeToRun });
            }
            const timer = setTimeout(() => runCodeRef.current({ code: codeToRun }), 100);
            return () => clearTimeout(timer);
        }
        if (!isConnected) {
            hasFiredRef.current = false; // Reset for the next connection
        }
    }, [isConnected]); // Minimal dependencies to avoid re-triggering

    // Handlers
    const handleTitleChange = useCallback((e) => {
        const newTitle = e.target.value;
        setLocalTitle(newTitle);
        updateNode(id, { title: newTitle });
    }, [id, updateNode]);

    const updateValue = useCallback((newValue) => {
        setLocalValue(newValue);
        const formatted = formatValue(newValue);
        const newCode = serialize(formatted);
        updateNode(id, { code: newCode });
        runCode({ code: newCode });
    }, [id, updateNode, runCode, formatValue, serialize]);

    return {
        ...nodeState,
        localValue,
        setLocalValue, // In case we need raw set
        updateValue,
        localTitle,
        handleTitleChange,
        setLocalTitle
    };
};
