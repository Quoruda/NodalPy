
import React, { memo, useEffect, useRef } from 'react';
import BaseNode from '../BaseNode.jsx';
import { useCodeNode } from '../useCodeNode.js';
import { useFlowContext } from '../../FlowContext.jsx';

const FastNode = memo(({ id, data }) => {
    // FastNode uses 1s timeout and auto-triggers downstream
    const nodeState = useCodeNode({ ...data, id }, { timeout: 1.0, autoTrigger: true });
    const { runCode } = nodeState;

    // Auto-run effect with debounce
    const timeoutRef = useRef(null);
    const codeRef = useRef(null);

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

    // Chain Reaction Logic: HANDLED BY useCodeNode NOW
    // const { triggerDownstreamNodes } = nodeState;
    // const prevStateRef = useRef(data.state);
    // useEffect(() => { ... }

    // React to newly added/removed incoming connections
    const { edges } = useFlowContext();
    const prevInputsRef = useRef([]);

    useEffect(() => {
        // Find current incoming edges
        const incomingEdges = edges.filter(e => e.target === data.id);
        const incomingIds = incomingEdges.map(e => e.source + '->' + e.targetHandle).sort();
        const prevIds = prevInputsRef.current;

        // Compare with previous check
        const isDifferent = incomingIds.length !== prevIds.length ||
            !incomingIds.every((val, index) => val === prevIds[index]);

        if (isDifferent) {
            console.log(`⚡ FastNode ${data.id} detected connection change, auto-running.`);
            prevInputsRef.current = incomingIds;
            // Debounce run
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => {
                runCode();
            }, 300);
        }
    }, [edges, data.id, runCode]);

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
