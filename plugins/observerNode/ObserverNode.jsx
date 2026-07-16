import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Handle, Position } from '@xyflow/react';
import { useFlowContext } from '../../front-editor/src/components/FlowContext.jsx';

import '../../front-editor/src/components/Nodes/nodes.css';
import '../../front-editor/src/components/Nodes/node_content.css';
import NodeShell, { NodeShellHeader } from '../../front-editor/src/components/Nodes/NodeShell.jsx';
import './ObserverNode.css';

const ObserverNode = memo(({ data, id, selected }) => {
    const { edges, nodes, sendMessage, setNodes } = useFlowContext();
    const [variableValue, setVariableValue] = useState(data.cachedValue || null);
    const [variableType, setVariableType] = useState(data.cachedType || null);
    const [connectedSource, setConnectedSource] = useState(null);
    const [prevConnection, setPrevConnection] = useState(null);

    useEffect(() => {
        const edge = edges.find(e => e.target === id);
        if (edge) {
            const sourceNode = nodes.find(n => n.id === edge.source);
            if (sourceNode) {
                let output = sourceNode.data.outputs?.find(o => o.id === edge.sourceHandle);
                if (!output && sourceNode.data.outputs?.length === 1) {
                    output = sourceNode.data.outputs[0];
                }

                if (output) {
                    const newConnection = {
                        nodeId: sourceNode.id,
                        variableName: output.name,
                        cachedValue: output.value,
                        cachedType: output.type
                    };

                    if (!connectedSource ||
                        connectedSource.nodeId !== newConnection.nodeId ||
                        connectedSource.variableName !== newConnection.variableName ||
                        connectedSource.cachedValue !== newConnection.cachedValue ||
                        connectedSource.cachedType !== newConnection.cachedType) {

                        setConnectedSource(newConnection);

                        if (output.value !== undefined) {
                            setVariableValue(output.value);
                            setVariableType(output.type);

                            setNodes((nds) => nds.map(n => {
                                if (n.id === id) {
                                    return {
                                        ...n,
                                        data: {
                                            ...n.data,
                                            cachedValue: output.value,
                                            cachedType: output.type
                                        }
                                    };
                                }
                                return n;
                            }));
                        }
                    }

                    if (!prevConnection ||
                        prevConnection.nodeId !== newConnection.nodeId ||
                        prevConnection.variableName !== newConnection.variableName) {
                        setPrevConnection(newConnection);

                        if (!sourceNode.data.fromLoad) {
                            setTimeout(() => {
                                sendMessage({
                                    action: "get_variable",
                                    node: newConnection.nodeId,
                                    name: newConnection.variableName
                                });
                            }, 100);
                        }
                    }
                }
            }
        } else {
            setConnectedSource(null);
            setPrevConnection(null);
            setVariableValue(null);
            setVariableType(null);
        }
    }, [edges, nodes, id, prevConnection, connectedSource, setNodes, sendMessage]);

    const handleRefresh = useCallback(() => {
        if (connectedSource) {
            sendMessage({
                action: "get_variable",
                node: connectedSource.nodeId,
                name: connectedSource.variableName
            });
        }
    }, [connectedSource, sendMessage]);

    const sourceNodeState = nodes.find(n => connectedSource && n.id === connectedSource.nodeId)?.data?.state;
    const prevSourceStateRef = useRef(null);
    const prevSourceIdRef = useRef(null);

    useEffect(() => {
        if (!connectedSource) {
            prevSourceStateRef.current = null;
            prevSourceIdRef.current = null;
            return;
        }

        const sourceId = connectedSource.nodeId;
        const prevState = prevSourceStateRef.current;
        const prevId = prevSourceIdRef.current;
        const justFinished = sourceNodeState === 2 && (prevState !== 2 || prevId !== sourceId);

        if (justFinished) {
            const timer = setTimeout(() => handleRefresh(), 100);
            prevSourceStateRef.current = sourceNodeState;
            prevSourceIdRef.current = sourceId;
            return () => clearTimeout(timer);
        }

        prevSourceStateRef.current = sourceNodeState;
        prevSourceIdRef.current = sourceId;
    }, [connectedSource, sourceNodeState, handleRefresh]);

    return (
        <NodeShell 
            id={id} 
            selected={selected} 
            nodeClass="observer-node"
        >
            <Handle
                type="target"
                position={Position.Left}
                style={{ background: '#555' }}
                isConnectable={!connectedSource}
            />

            <NodeShellHeader nodeClass="observer" readOnly={true}>
                <div className="observer-eyes">
                    <div className="eye">
                        <div className="pupil"></div>
                    </div>
                    <div className="eye">
                        <div className="pupil"></div>
                    </div>
                </div>
                <span className="observer-title">
                    {connectedSource ? connectedSource.variableName : "Observer"}
                </span>
            </NodeShellHeader>

            <div className="observer-content">
                {connectedSource ? (
                    <div className="variable-display">
                        <div className="value node-content-container">
                            {variableType === "image" ? (
                                <img
                                    src={`data:image/png;base64,${variableValue}`}
                                    alt="Output"
                                    style={{ maxWidth: '100%', objectFit: 'contain' }}
                                />
                            ) : variableType === "table" ? (
                                <div
                                    className="table-container"
                                    dangerouslySetInnerHTML={{ __html: variableValue }}
                                />
                            ) : variableType === "list" ? (
                                <pre style={{ textAlign: 'left', margin: 0, fontSize: '11px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                    {JSON.stringify(variableValue)}
                                </pre>
                            ) : variableType === "tuple" ? (
                                <pre style={{ textAlign: 'left', margin: 0, fontSize: '11px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                    {"(" + JSON.stringify(variableValue).slice(1, -1) + ")"}
                                </pre>
                            ) : variableType === "dict" ? (
                                <pre style={{ textAlign: 'left', margin: 0, fontSize: '11px', whiteSpace: 'pre-wrap' }}>
                                    {JSON.stringify(variableValue, null, 2)}
                                </pre>
                            ) : (
                                String(variableValue) !== "null" ? String(variableValue) : "Waiting..."
                            )}
                        </div>
                        {variableType && variableType !== "image" && variableType !== "table" && <div className="type">({variableType})</div>}
                        <button className="refresh-btn" onClick={handleRefresh} title="Refresh Value">
                            🔄
                        </button>
                    </div>
                ) : (
                    <div className="no-connection">Connect a variable</div>
                )}
            </div>
        </NodeShell>
    )
});

ObserverNode.displayName = 'ObserverNode';
export default ObserverNode;
