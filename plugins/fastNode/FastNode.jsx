import React, { memo, useState, useEffect, useCallback, useRef } from 'react';
import BaseCodeNode from '../../front-editor/src/components/Nodes/BaseCodeNode.jsx';
import { useCodeNode } from '../../front-editor/src/components/Nodes/useCodeNode.js';
import { useFlowContext } from '../../front-editor/src/components/FlowContext.jsx';
import './FastNode.css';

const FastNode = memo(({ id, data, selected }) => {
    const nodeState = useCodeNode({ ...data, id }, { autoTrigger: true });
    const { runCode, updateNode, inputs } = nodeState;

    const { edges, isConnected, serverConfig } = useFlowContext();

    const timeoutRef = useRef(null);
    const prevInputsRef = useRef([]);
    const hasFiredRef = useRef(false);

    // Debounced re-run on code change
    const handleCodeChange = useCallback((value) => {
        updateNode(id, { code: value });
        const debounceTime = serverConfig?.core?.debounce ?? 50;
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => runCode({ code: value }), debounceTime);
    }, [id, updateNode, runCode, serverConfig]);

    // Re-run when connections change
    useEffect(() => {
        const incomingEdges = edges.filter(e => e.target === id);
        const incomingIds = incomingEdges.map(e => `${e.source}->${e.targetHandle}`).sort();
        const prevIds = prevInputsRef.current;
        const isDifferent = incomingIds.length !== prevIds.length ||
            !incomingIds.every((v, i) => v === prevIds[i]);

        if (isDifferent) {
            prevInputsRef.current = incomingIds;
            if (data.fromLoad) { updateNode(id, { fromLoad: false }); return; }
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => runCode(), 300);
        }
    }, [edges, id, runCode, data.fromLoad, updateNode]);

    // Re-run when master code changes (Link Node sync)
    useEffect(() => {
        if (data.code && !data.fromLoad) {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => runCode(), 100);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data.code]);

    // First run on connect (no incoming edges)
    useEffect(() => {
        if (!isConnected) { hasFiredRef.current = false; return; }
        if (!hasFiredRef.current) {
            const incomingEdges = edges.filter(e => e.target === id);
            if (incomingEdges.length === 0) {
                hasFiredRef.current = true;
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
                timeoutRef.current = setTimeout(() => runCode(), 200);
            }
        }
    }, [isConnected, id, edges, runCode]);

    useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);

    return (
        <div className={`fast-node-wrapper ${selected ? 'selected' : ''}`}>
            <div className="lightning-bolt">⚡</div>
            <BaseCodeNode
                id={id}
                data={data}
                nodeTypeClass="fast-node"
                hideRunButton={true}
                handleCodeChange={handleCodeChange}
                {...nodeState}
            />
        </div>
    );
}, (prev, next) => {
    if (prev.data === next.data && prev.selected === next.selected) return true;
    const p = prev.data, n = next.data;
    return p.code === n.code && p.title === n.title && p.state === n.state &&
        p.isCodeOpen === n.isCodeOpen && p.isLogsOpen === n.isLogsOpen &&
        p.output === n.output && p.logs === n.logs && p.error === n.error &&
        JSON.stringify(p.inputs) === JSON.stringify(n.inputs) &&
        JSON.stringify(p.outputs) === JSON.stringify(n.outputs) &&
        prev.selected === next.selected;
});

FastNode.displayName = 'FastNode';
export default FastNode;
