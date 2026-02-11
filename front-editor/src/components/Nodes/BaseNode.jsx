
import React, { memo, useMemo, useEffect, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { useFlowContext } from '../FlowContext.jsx';
import InputHandle from './CustomNode/InputHandle.jsx';
import OutputHandle from './CustomNode/OutputHandle.jsx';
import NodeHeader from './CustomNode/NodeHeader.jsx';
import {
    CODE_EXTENSIONS,
    CODE_BASIC_SETUP
} from './CustomNode/constants.js';
import './nodes.css';
import './CustomNode/CustomNode.css';

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
                    <div style={{ width: '100%' }}>
                        <CodeMirror
                            value={data.code || ''}
                            height="auto"
                            extensions={CODE_EXTENSIONS}
                            onChange={handleCodeChange}
                            theme="dark"
                            basicSetup={CODE_BASIC_SETUP}
                        />

                        {/* Error display if present */}
                        {data.error && (
                            <div className="node-error" style={{
                                color: '#ff4d4d',
                                fontSize: '0.8em',
                                marginTop: '4px',
                                maxWidth: '300px',
                                wordBreak: 'break-word'
                            }}>
                                {data.error}
                            </div>
                        )}
                        {/* Output display if present (optional) */}
                        {data.output && (
                            <div className="node-output" style={{
                                color: '#00d2d3',
                                fontSize: '0.8em',
                                marginTop: '4px',
                                whiteSpace: 'pre-wrap',
                                maxHeight: '100px',
                                overflowY: 'auto'
                            }}>
                                {data.output.substring(0, 200) + (data.output.length > 200 ? '...' : '')}
                            </div>
                        )}
                    </div>
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
