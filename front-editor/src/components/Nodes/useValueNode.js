import { useState, useEffect, useCallback } from 'react';
import { useCodeNode } from './useCodeNode.js';

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

    // Local state
    const [localValue, setLocalValue] = useState(defaultValue);
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

    // Auto-run on mount
    useEffect(() => {
        if (data.fromLoad) return;
        const timer = setTimeout(() => runCode(), 100);
        return () => clearTimeout(timer);
    }, []);

    // Handlers
    const handleTitleChange = useCallback((e) => {
        const newTitle = e.target.value;
        setLocalValue((prev) => {
            // Hack: we don't need access to prev state here, just setting title
            return prev;
        });
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
