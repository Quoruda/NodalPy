import { useState, useEffect, useCallback, useRef } from 'react';
import { useCodeNode } from '../../front-editor/src/components/Nodes/useCodeNode.js';
import { useFlowContext } from '../../front-editor/src/components/FlowContext.jsx';

export const useValueNode = (id, data, config = {}) => {
    const {
        regex,
        defaultValue,
        formatValue = (v) => v,
        parseValue = (v) => v,
        serialize = (v) => `output = ${v}`,
        matchGroupIndex = 1
    } = config;

    const nodeState = useCodeNode({ ...data, id }, { autoTrigger: true });
    const { runCode, updateNode } = nodeState;
    const { isConnected } = useFlowContext();

    const dataRef = useRef(data);
    useEffect(() => {
        dataRef.current = data;
    }, [data]);

    const [localValue, setLocalValue] = useState(data.value !== undefined ? data.value : defaultValue);
    const [localTitle, setLocalTitle] = useState(data.title || config.defaultTitle || 'Node');

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
    }, [data.code, regex, parseValue, matchGroupIndex]);

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
            hasFiredRef.current = false;
        }
    }, [isConnected, id, localValue, updateNode, formatValue, serialize]);

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
        setLocalValue,
        updateValue,
        localTitle,
        handleTitleChange,
        setLocalTitle
    };
};
