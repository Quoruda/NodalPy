import React, { memo, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { useCodeNode } from '../../front-editor/src/components/Nodes/useCodeNode.js';
import { useFlowContext } from '../../front-editor/src/components/FlowContext.jsx';
import InputHandle from '../../front-editor/src/components/Nodes/InputHandle.jsx';
import OutputHandle from '../../front-editor/src/components/Nodes/OutputHandle.jsx';
import '../../front-editor/src/components/Nodes/NodeShell.css';
import './FastNode.css';
import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';

const FastNode = memo(({ id, data, selected }) => {
    const nodeState = useCodeNode({ ...data, id }, { autoTrigger: true });

    const {
        runCode, updateNode,
        inputs, outputs,
        addInput, removeInput, updateInput,
        addOutput, removeOutput, updateOutput
    } = nodeState;

    const [localTitle, setLocalTitle] = useState(data.title || 'Fast Node');
    const [code, setCode] = useState(data.code || "output = input1 * 2");

    const timeoutRef = useRef(null);
    const codeRef = useRef(data.code);
    const hasFiredRef = useRef(false);

    const { edges, isConnected, serverConfig } = useFlowContext();
    const prevInputsRef = useRef([]);

    const connectionStatus = useMemo(() => {
        const nodeEdges = edges.filter(e => e.target === id);
        return inputs.map((_, index) => {
            const handleId = inputs[index].id;
            return nodeEdges.filter(e => e.targetHandle === handleId).length < 1;
        });
    }, [edges, inputs, id]);

    const inputHandles = useMemo(() =>
        inputs.map((input, index) => (
            <InputHandle
                key={input.id}
                id={input.id}
                input={input.name}
                index={index}
                updateInput={updateInput}
                removeInput={removeInput}
                isConnectable={connectionStatus[index]}
            />
        )),
        [inputs, updateInput, removeInput, connectionStatus]
    );

    const outputHandles = useMemo(() =>
        outputs.map((output, index) => (
            <OutputHandle
                key={output.id}
                id={output.id}
                output={output.name}
                index={index}
                updateOutput={updateOutput}
                removeOutput={removeOutput}
            />
        )),
        [outputs, updateOutput, removeOutput]
    );

    const handleCodeChange = useCallback((value) => {
        const newCode = value;
        setCode(newCode);
        codeRef.current = newCode;

        updateNode(id, { code: newCode });

        const debounceTime = serverConfig?.debounce ?? 50;

        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            runCode({ code: newCode });
        }, debounceTime);
    }, [id, updateNode, runCode, serverConfig]);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    useEffect(() => {
        const incomingEdges = edges.filter(e => e.target === id);
        const incomingIds = incomingEdges.map(e => e.source + '->' + e.targetHandle).sort();
        const prevIds = prevInputsRef.current;

        const isDifferent = incomingIds.length !== prevIds.length ||
            !incomingIds.every((val, index) => val === prevIds[index]);

        if (isDifferent) {
            prevInputsRef.current = incomingIds;

            if (data.fromLoad) {
                prevInputsRef.current = incomingIds;
                updateNode(id, { fromLoad: false });
                return;
            }

            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => {
                runCode();
            }, 300);
        }
    }, [edges, id, runCode, data.fromLoad]);

    useEffect(() => {
        if (data.code && data.code !== code) {
            setCode(data.code);
            codeRef.current = data.code;
            if (!data.fromLoad) {
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
                timeoutRef.current = setTimeout(() => runCode(), 100);
            }
        }
    }, [data.code]);

    useEffect(() => {
        if (!isConnected) {
            hasFiredRef.current = false;
            return;
        }
        if (!hasFiredRef.current) {
            const incomingEdges = edges.filter(e => e.target === id);
            if (incomingEdges.length === 0) {
                hasFiredRef.current = true;
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
                timeoutRef.current = setTimeout(() => runCode(), 200);
            }
        }
    }, [isConnected, id, edges, runCode]);

    const isCodeOpen = data.isCodeOpen !== false;
    const isLogsOpen = data.isLogsOpen !== false;
    
    const toggleCode = useCallback((e) => {
        e.stopPropagation();
        updateNode(id, { isCodeOpen: !isCodeOpen });
    }, [updateNode, id, isCodeOpen]);

    const toggleLogs = useCallback((e) => {
        e.stopPropagation();
        updateNode(id, { isLogsOpen: !isLogsOpen });
    }, [updateNode, id, isLogsOpen]);

    const handleTitleChange = useCallback((e) => {
        const newTitle = e.target.value;
        setLocalTitle(newTitle);
        updateNode(id, { title: newTitle });
    }, [id, updateNode]);

    const stopPropagation = useCallback((e) => e.stopPropagation(), []);

    return (
        <div className={`node-shell fast-node ${selected ? 'selected' : ''}`}>
            <div className="lightning-bolt">⚡</div>

            <div className="node-shell-header fast-header">
                <div className="title-section">
                    <input
                        type="text"
                        className="node-shell-title title-input nodrag"
                        placeholder="Node Name"
                        value={localTitle}
                        onChange={handleTitleChange}
                        onKeyDown={stopPropagation}
                    />
                </div>
            </div>

            <div className="fast-content">
                <div className="fast-inputs">
                    {inputHandles}
                    <button className="add-io-btn" onClick={addInput} title="Add Input" style={{ opacity: 0.5 }}>+</button>
                </div>

                <div className="fast-center" onMouseDown={stopPropagation} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    
                    {/* --- CODE SECTION --- */}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div 
                            className="section-toggle nodrag" 
                            onClick={toggleCode}
                            style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 8px', cursor: 'pointer', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '4px', fontSize: '11px', userSelect: 'none' }}
                        >
                            <span style={{ opacity: 0.7 }}>Code</span>
                            <span style={{ opacity: 0.5 }}>{isCodeOpen ? '▼' : '▶'}</span>
                        </div>
                        
                        {isCodeOpen && (
                            <div className="code-mirror-wrapper nodrag" style={{ marginTop: '4px' }}>
                                <CodeMirror
                                    value={code}
                                    height="100%"
                                    extensions={[python()]}
                                    onChange={handleCodeChange}
                                    theme={vscodeDark}
                                    basicSetup={{
                                        lineNumbers: true,
                                        foldGutter: true,
                                        dropCursor: true,
                                        allowMultipleSelections: true,
                                        indentOnInput: true,
                                        bracketMatching: true,
                                        closeBrackets: true,
                                        autocompletion: true,
                                        highlightActiveLine: true,
                                        highlightSelectionMatches: true,
                                    }}
                                />
                            </div>
                        )}
                    </div>

                    {/* --- LOGS / ERROR SECTION --- */}
                    {(data.logs || data.error) && (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <div 
                                className="section-toggle nodrag" 
                                onClick={toggleLogs}
                                style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 8px', cursor: 'pointer', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '4px', fontSize: '11px', userSelect: 'none', color: data.error ? '#ff6b6b' : 'inherit' }}
                            >
                                <span style={{ opacity: 0.7 }}>{data.error ? 'Error' : 'Output Logs'}</span>
                                <span style={{ opacity: 0.5 }}>{isLogsOpen ? '▼' : '▶'}</span>
                            </div>
                            
                            {isLogsOpen && (
                                <>
                                    {data.logs && !data.error && (
                                        <div className="node-output nodrag" style={{ padding: '4px 0', cursor: 'text' }}>
                                            <div className="node-content-container" style={{ maxHeight: '150px', resize: 'vertical', overflow: 'auto' }}>
                                                <pre style={{ margin: 0, fontSize: '11px', whiteSpace: 'pre-wrap', color: '#a8c7fa' }}>{data.logs}</pre>
                                            </div>
                                        </div>
                                    )}

                                    {data.error && (
                                        <div className="node-error nodrag" style={{ padding: '4px 0', cursor: 'text' }}>
                                            <div className="node-content-container" style={{ maxHeight: '150px', resize: 'vertical', overflow: 'auto', borderColor: '#ff4444' }}>
                                                <pre style={{ margin: 0, fontSize: '11px', whiteSpace: 'pre-wrap', color: '#ff6b6b' }}>{data.error}</pre>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>

                <div className="fast-outputs">
                    {outputHandles}
                    <button className="add-io-btn" onClick={addOutput} title="Add Output" style={{ opacity: 0.5 }}>+</button>
                </div>
            </div>
        </div>
    );
});

export default FastNode;
