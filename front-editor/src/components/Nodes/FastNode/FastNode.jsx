import React, { memo, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useCodeNode } from '../useCodeNode.js';
import { useFlowContext } from '../../FlowContext.jsx';
import InputHandle from '../CustomNode/InputHandle.jsx';
import OutputHandle from '../CustomNode/OutputHandle.jsx';
import './FastNode.css';

const FastNode = memo(({ id, data, selected }) => {
    // FastNode uses 1s timeout and auto-triggers downstream
    // Reuse useCodeNode for backend communication logic
    // We pass autoTrigger: true so useCodeNode knows it should trigger downstream
    // We pass data.inputs/outputs to useCodeNode so it manages them
    const nodeState = useCodeNode({ ...data, id }, { timeout: 1.0, autoTrigger: true });

    // Destructure all needed props from nodeState
    const {
        runCode, updateNode,
        inputs, outputs,
        isEditing, setIsEditing,
        // Helper functions from useCodeNode
        addInput, removeInput, updateInput,
        addOutput, removeOutput, updateOutput
    } = nodeState;

    // Local State
    const [localTitle, setLocalTitle] = useState(data.title || 'Fast Node');
    const [code, setCode] = useState(data.code || "output = input1 * 2");

    // Refs for debouncing and logic
    const timeoutRef = useRef(null);
    const codeRef = useRef(data.code);

    // Context for edge detection
    const { edges } = useFlowContext();
    const prevInputsRef = useRef([]);

    // --- CONNECTION STATUS LOGIC (From BaseNode) ---
    const connectionStatus = useMemo(() => {
        const nodeEdges = edges.filter(e => e.target === id);
        return inputs.map((_, index) => {
            const handleId = inputs[index].id;
            return nodeEdges.filter(e => e.targetHandle === handleId).length < 1;
        });
    }, [edges, inputs, id]);

    // --- RENDER HANDLES ---
    const inputHandles = useMemo(() =>
        inputs.map((input, index) => (
            <InputHandle
                key={input.id}
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
                key={output.id}
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


    // 1. Handle Code Change with Debounce
    const handleCodeChange = useCallback((e) => {
        const newCode = e.target.value;
        setCode(newCode);
        codeRef.current = newCode;

        updateNode(id, { code: newCode });

        // Debounce Execution
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            console.log("⚡ FastNode Code Change Trigger");
            runCode({ code: newCode });
        }, 500);
    }, [id, updateNode, runCode]);

    // 2. Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    // 3. React to Input Connection Changes (Auto-Run)
    useEffect(() => {
        // Find current incoming edges
        const incomingEdges = edges.filter(e => e.target === id);
        const incomingIds = incomingEdges.map(e => e.source + '->' + e.targetHandle).sort();
        const prevIds = prevInputsRef.current;

        // Compare with previous check
        const isDifferent = incomingIds.length !== prevIds.length ||
            !incomingIds.every((val, index) => val === prevIds[index]);

        if (isDifferent) {
            console.log(`⚡ FastNode ${id} detected connection change.`);
            prevInputsRef.current = incomingIds;

            // CRITICAL: fromLoad check
            if (data.fromLoad) {
                console.log(`⚡ FastNode ${id} skipping auto-run (fromLoad).`);
                // Consume the flag so future changes ARE detected
                // We use a small timeout to ensure we don't trigger immediate re-run issues, 
                // but mostly just to clear the state for the user's next interaction.
                updateNode(id, { fromLoad: false });
                return;
            }

            console.log(`⚡ FastNode ${id} auto-running due to connection change.`);

            // Debounce run
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => {
                runCode();
            }, 300);
        }
    }, [edges, id, runCode, data.fromLoad]);

    // 4. Initial Load Logic
    useEffect(() => {
        if (data.code && data.code !== code) {
            setCode(data.code);
            codeRef.current = data.code;
            if (!data.fromLoad) {
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
                timeoutRef.current = setTimeout(() => runCode(), 500);
            }
        }
    }, [data.code]);

    // Title Handler
    const handleTitleChange = useCallback((e) => {
        const newTitle = e.target.value;
        setLocalTitle(newTitle);
        updateNode(id, { title: newTitle });
    }, [id, updateNode]);

    const toggleEdit = useCallback((e) => {
        e.stopPropagation();
        setIsEditing(!isEditing);
    }, [isEditing, setIsEditing]);

    const stopPropagation = useCallback((e) => e.stopPropagation(), []);

    return (
        <div className={`fast-node ${selected ? 'selected' : ''}`}>
            {/* Decoration: Lightning Bolt */}
            <div className="lightning-bolt">⚡</div>

            {/* Header */}
            <div className="fast-header">
                <div className="title-section">
                    <input
                        type="text"
                        className="title-input nodrag"
                        placeholder="Node Name"
                        value={localTitle}
                        onChange={handleTitleChange}
                        onKeyDown={stopPropagation}
                    />
                </div>
            </div>


            {/* Content (3 columns) */}
            <div className="fast-content">
                {/* Inputs Column */}
                <div className="fast-inputs">
                    {inputHandles}
                    <button className="add-io-btn" onClick={addInput} title="Add Input" style={{ opacity: 0.5 }}>+</button>
                </div>

                {/* Code Column (Center) */}
                <div className="fast-center">
                    <textarea
                        className="code-input nodrag"
                        value={code}
                        onChange={handleCodeChange}
                        onKeyDown={stopPropagation}
                        placeholder="e.g. output = input1 * 2"
                        spellCheck={false}
                    />
                </div>

                {/* Outputs Column */}
                <div className="fast-outputs">
                    {outputHandles}
                    <button className="add-io-btn" onClick={addOutput} title="Add Output" style={{ opacity: 0.5 }}>+</button>
                </div>
            </div>
        </div >
    );
});

export default FastNode;
