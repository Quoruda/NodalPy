
import React, { memo, useEffect, useRef } from 'react';
import BaseNode from '../BaseNode.jsx';
import { useCodeNode } from '../useCodeNode.js';

const FastNode = memo(({ data }) => {
    // FastNode uses 1s timeout
    const nodeState = useCodeNode(data, 1.0);
    const { runCode } = nodeState;

    // Auto-run effect with debounce
    const timeoutRef = useRef(null);
    const codeRef = useRef(data.code);

    // Run on mount if not already executed/running (optional, maybe dangerous on load)
    // For now, let's only run on change.

    useEffect(() => {
        if (codeRef.current !== data.code) {
            codeRef.current = data.code;

            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }

            timeoutRef.current = setTimeout(() => {
                console.log("⚡ FastNode Auto-Run Triggered");
                runCode();
            }, 500); // 500ms debounce
        }
    }, [data.code, runCode]);

    // Cleanup
    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    // Chain Reaction Logic: Watch for state change to "finished" (2)
    const { triggerDownstreamNodes } = nodeState;

    useEffect(() => {
        if (data.state === 2 && !data.error) {
            // console.log(`✅ FastNode ${data.id} finished, checking downstream`);
            triggerDownstreamNodes(data.id);
        }
    }, [data.state, data.error, data.id, triggerDownstreamNodes]);

    return (
        <BaseNode
            data={data}
            nodeTypeClass="fast-node"
            {...nodeState}
        />
    );
}, (prevProps, nextProps) => {
    // Optimization comparison (same as CustomNode)
    if (prevProps.data === nextProps.data) return true;
    const prev = prevProps.data;
    const next = nextProps.data;

    if (prev.id !== next.id) return false;
    if (prev.code !== next.code) return false;
    if (prev.title !== next.title) return false;
    if (prev.state !== next.state) return false;

    if (JSON.stringify(prev.inputs) !== JSON.stringify(next.inputs)) return false;
    if (JSON.stringify(prev.outputs) !== JSON.stringify(next.outputs)) return false;

    if (prev.onChange !== next.onChange) return false;
    if (prev.output !== next.output) return false;
    if (prev.error !== next.error) return false;

    return true;
});

FastNode.displayName = 'FastNode';

export default FastNode;
