
import React, { memo, useMemo, useEffect, useRef, useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import { useFlowContext } from '../FlowContext.jsx';
import InputHandle from './CustomNode/InputHandle.jsx';
import OutputHandle from './CustomNode/OutputHandle.jsx';
import NodeHeader from './CustomNode/NodeHeader.jsx';
import './nodes.css';
import './CustomNode/CustomNode.css';
import './BaseNode.css';
import './node_content.css';
import './node_content.css';

const BaseNode = ({
    data,
    isEditing,
    setIsEditing,
    tempTitle,
    setTempTitle,
    handleSave,
    runCode,
    inputs,
    setInputs,
    outputs,
    setOutputs,
    updateInput,
    removeInput,
    addInput,
    updateOutput,
    removeOutput,
    addOutput,
    handleCodeChange,
    nodeTypeClass
}) => {
    const { edges } = useFlowContext();
    const nodeId = data.id;

    // Stop drag propagation when interacting with editor
    const handleEditorMouseDown = useCallback((e) => {
        e.stopPropagation();
    }, []);

    // Connection status calculation
    const connectionStatus = useMemo(() => {
        const nodeEdges = edges.filter(e => e.target === nodeId);
        return inputs.map((_, index) => {
            const handleId = inputs[index].id;
            return nodeEdges.filter(e => e.targetHandle === handleId).length < 1;
        });
    }, [edges, inputs, nodeId]);

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

    return (
        <div
            className={`node ${nodeTypeClass}`}
            style={{
                display: 'flex',
                flexDirection: "column",
                maxWidth: '100%',
                width: 'auto',
                paddingBottom: "8px",
            }}
        >
            <NodeHeader
                title={data.title}
                state={data.state}
                runCode={runCode}
                hideState={nodeTypeClass === 'fast-node'}
                // Pass update logic if needed, or rely on internal implementation
                // For now, NodeHeader handles its own Autosize, but we need to pass the update function
                // Actually, BaseNode doesn't have `updateNode` in props... 
                // Wait, BaseNode relies on parent to pass `data`. 
                // We need `updateNode` or equivalent to change title.
                // Let's assume `setTempTitle` was local to BaseNode/CustomNode logic.
                // We need to pass a callback to update title eventually.
                // For now, let's keep it simple and assume NodeHeader will take `handleSave` equivalent 
                // or we pass a `onTitleChange` prop if we refactor BaseNode props.
                // Re-reading BaseNode props: it has `setTempTitle`.
                tempTitle={tempTitle}
                setTempTitle={setTempTitle}
                handleSave={handleSave}
            />
            <div style={{
                display: 'flex',
                flexDirection: 'row',
                width: '100%',
                gap: '8px',
            }}>

                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '4px',
                    width: 'auto',
                }}>
                    {inputHandles}
                    <button className="add-io-btn" onClick={addInput} title="Add Input" style={{ opacity: 0.5 }}>+</button>
                </div>

                <div style={{ flexGrow: 1 }}>
                    <div className="nodrag" style={{ padding: '8px', cursor: 'text' }} onMouseDown={handleEditorMouseDown}>
                        <div className="node-content-container" style={{ resize: 'both', overflow: 'auto' }}>
                            <CodeMirror
                                value={data.code || ''}
                                height="auto" // Let container control scroll
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
                    </div>

                    {/* Output Display */}
                    {data.output && (
                        <div className="node-output" style={{ padding: '8px', borderTop: '1px solid #444' }}>
                            <strong>Output:</strong>
                            <div className="node-content-container" style={{ marginTop: '5px', maxHeight: '100px' }}>
                                <pre style={{ margin: 0, fontSize: '11px', whiteSpace: 'pre-wrap' }}>{data.output}</pre>
                            </div>
                        </div>
                    )}

                    {/* Error Display */}
                    {data.error && (
                        <div className="node-error" style={{ padding: '8px', borderTop: '1px solid #ff4444', color: '#ff4444' }}>
                            <strong>Error:</strong>
                            <div className="node-content-container" style={{ marginTop: '5px', maxHeight: '100px', borderColor: '#ff4444' }}>
                                <pre style={{ margin: 0, fontSize: '11px', whiteSpace: 'pre-wrap' }}>{data.error}</pre>
                            </div>
                        </div>
                    )}
                </div>

                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '4px',
                    width: 'auto',
                }}>
                    {outputHandles}
                    <button className="add-io-btn" onClick={addOutput} title="Add Output" style={{ opacity: 0.5 }}>+</button>
                </div>
            </div>
        </div>
    );
};

export default BaseNode;
