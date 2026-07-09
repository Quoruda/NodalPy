import React, { useMemo, useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import { useFlowContext } from '../../front-editor/src/components/FlowContext.jsx';
import InputHandle from '../../front-editor/src/components/Nodes/InputHandle.jsx';
import OutputHandle from '../../front-editor/src/components/Nodes/OutputHandle.jsx';
import NodeHeader from './NodeHeader.jsx';
import '../../front-editor/src/components/Nodes/nodes.css';
import './ManualNode.css';
import '../../front-editor/src/components/Nodes/node_content.css';

const BaseNode = ({
    data,
    tempTitle,
    setTempTitle,
    handleSave,
    runCode,
    inputs,
    updateInput,
    removeInput,
    addInput,
    outputs,
    updateOutput,
    removeOutput,
    addOutput,
    handleCodeChange,
    nodeTypeClass
}) => {
    const { edges } = useFlowContext();
    const nodeId = data.id;

    const handleEditorMouseDown = useCallback((e) => {
        e.stopPropagation();
    }, []);

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
                state={data.state}
                runCode={runCode}
                hideState={nodeTypeClass === 'fast-node'}
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
                                height="auto"
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

                    {data.output && (
                        <div className="node-output" style={{ padding: '8px', borderTop: '1px solid #444' }}>
                            <strong>Output:</strong>
                            <div className="node-content-container" style={{ marginTop: '5px', maxHeight: '100px' }}>
                                <pre style={{ margin: 0, fontSize: '11px', whiteSpace: 'pre-wrap' }}>{data.output}</pre>
                            </div>
                        </div>
                    )}

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
