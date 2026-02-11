
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
import { useCodeNode } from './useCodeNode';

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
                isEditing={isEditing}
                tempTitle={tempTitle}
                setTempTitle={setTempTitle}
                handleSave={handleSave}
                setIsEditing={setIsEditing}
                title={data.title}
                state={data.state}
                runCode={runCode}
                hideState={nodeTypeClass === 'fast-node'}
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
                    {isEditing && (
                        <button onClick={addInput} style={{ fontSize: '0.8rem' }}>
                            + entrée
                        </button>
                    )}
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
                    {isEditing && (
                        <button onClick={addOutput} style={{ fontSize: '0.8rem' }}>
                            + sortie
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BaseNode;
