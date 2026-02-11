import { memo, useCallback, useEffect, useState } from "react";
import { Handle, Position } from '@xyflow/react';
import { useFlowContext } from '../../FlowContext.jsx';

import '../nodes.css'
import '../node_content.css'
import './ObserverNode.css'

const ObserverNode = memo(({ data, id }) => {
    const { edges, nodes, wsRef } = useFlowContext();
    const [variableValue, setVariableValue] = useState(null);
    const [variableType, setVariableType] = useState(null);
    const [connectedSource, setConnectedSource] = useState(null);

    // Track previous connection to detect changes
    const [prevConnection, setPrevConnection] = useState(null);

    // Find the connected source
    useEffect(() => {
        const edge = edges.find(e => e.target === id);
        if (edge) {
            const sourceNode = nodes.find(n => n.id === edge.source);
            if (sourceNode) {
                // Debug logs with JSON.stringify to see content
                // console.log("Observer checking connection:", JSON.stringify({ 
                //    edgeHandle: edge.sourceHandle, 
                //    sourceOutputs: sourceNode.data.outputs 
                // }));

                // --- START SEARCH ---

                // 1. Try exact ID match
                let output = sourceNode.data.outputs?.find(o => o.id === edge.sourceHandle);

                // 2. Try fallback: if only 1 output, use it (robustness)
                if (!output && sourceNode.data.outputs?.length === 1) {
                    // console.log("Observer: Fallback to single available output");
                    output = sourceNode.data.outputs[0];
                }

                if (output) {
                    const newConnection = {
                        nodeId: sourceNode.id,
                        variableName: output.name,
                        cachedValue: output.value,
                        cachedType: output.type
                    };

                    // Only update state if something actually changed to avoid render loops
                    if (!connectedSource ||
                        connectedSource.nodeId !== newConnection.nodeId ||
                        connectedSource.variableName !== newConnection.variableName ||
                        connectedSource.cachedValue !== newConnection.cachedValue ||
                        connectedSource.cachedType !== newConnection.cachedType) {

                        setConnectedSource(newConnection);

                        // Update local state immediately if value is present
                        if (output.value !== undefined) {
                            setVariableValue(output.value);
                            setVariableType(output.type);
                        }
                    }

                    // Check if connection changed
                    if (!prevConnection ||
                        prevConnection.nodeId !== newConnection.nodeId ||
                        prevConnection.variableName !== newConnection.variableName) {
                        setPrevConnection(newConnection);
                        // Trigger fetch on new connection
                        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                            setTimeout(() => {
                                wsRef.current.send(JSON.stringify({
                                    action: "get_variable",
                                    node: newConnection.nodeId,
                                    name: newConnection.variableName
                                }));
                            }, 100);
                        }
                    }
                } else {
                    // Check if we already warned to avoid spam? 
                    // For now just fix the log format
                    // console.warn("Observer: Connected but output handle not found in source node outputs. Details: " + JSON.stringify({
                    //    edgeHandle: edge.sourceHandle,
                    //    outputs: sourceNode.data.outputs
                    // }));
                }
            }
        } else {
            setConnectedSource(null);
            setPrevConnection(null);
            setVariableValue(null);
            setVariableType(null);
        }
    }, [edges, nodes, id, prevConnection, wsRef]);

    const handleRefresh = useCallback(() => {
        if (connectedSource && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                action: "get_variable",
                node: connectedSource.nodeId,
                name: connectedSource.variableName
            }));
        }
    }, [connectedSource, wsRef]);



    // Better Auto-refresh logic:
    // Watch specifically the source node's state
    const sourceNodeState = nodes.find(n => connectedSource && n.id === connectedSource.nodeId)?.data?.state;

    useEffect(() => {
        if (connectedSource && sourceNodeState === 2) {
            handleRefresh();
        }
    }, [sourceNodeState, connectedSource?.nodeId, connectedSource?.variableName]); // Only run when state changes to 2


    return (
        <div className="node observer-node">
            <Handle
                type="target"
                position={Position.Left}
                style={{ background: '#555' }}
                isConnectable={!connectedSource} // Only allow one connection
            />

            <div className="observer-header">
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
            </div>

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
        </div>
    )
});

ObserverNode.displayName = 'ObserverNode';
export default ObserverNode;