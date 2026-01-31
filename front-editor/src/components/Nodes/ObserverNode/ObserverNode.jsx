import { memo, useCallback, useEffect, useState } from "react";
import { Handle, Position } from '@xyflow/react';
import { useFlowContext } from '../../FlowContext.jsx';

import '../nodes.css'
import './ObserverNode.css'

const ObserverNode = memo(({ data, id }) => {
    const { edges, nodes, wsRef } = useFlowContext();
    const [variableValue, setVariableValue] = useState(null);
    const [variableType, setVariableType] = useState(null);
    const [connectedSource, setConnectedSource] = useState(null);

    // Find the connected source
    useEffect(() => {
        const edge = edges.find(e => e.target === id);
        if (edge) {
            const sourceNode = nodes.find(n => n.id === edge.source);
            if (sourceNode) {
                const output = sourceNode.data.outputs?.find(o => o.id === edge.sourceHandle);
                if (output) {
                    setConnectedSource({
                        nodeId: sourceNode.id,
                        variableName: output.name,
                        // Check if value is already cached in source node
                        cachedValue: output.value,
                        cachedType: output.type
                    });

                    // Update local state if source has value
                    if (output.value !== undefined) {
                        setVariableValue(output.value);
                        setVariableType(output.type);
                    }
                }
            }
        } else {
            setConnectedSource(null);
            setVariableValue(null);
            setVariableType(null);
        }
    }, [edges, nodes, id]);

    const handleRefresh = useCallback(() => {
        if (connectedSource && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
                action: "get_variable",
                node: connectedSource.nodeId,
                name: connectedSource.variableName
            }));
        }
    }, [connectedSource, wsRef]);

    // Auto-refresh when source node finishes execution
    useEffect(() => {
        if (connectedSource) {
            const sourceNode = nodes.find(n => n.id === connectedSource.nodeId);
            if (sourceNode && sourceNode.data.state === 2) { // Finished state
                handleRefresh();
            }
        }
    }, [nodes, connectedSource, handleRefresh]);

    // Also update if source node output value changes directly (via useWebSocket update)
    useEffect(() => {
        if (connectedSource && connectedSource.cachedValue !== undefined) {
            setVariableValue(connectedSource.cachedValue);
            setVariableType(connectedSource.cachedType);
        }
    }, [connectedSource]);

    return (
        <div className="node observer-node">
            <Handle
                type="target"
                position={Position.Left}
                style={{ background: '#555' }}
                isConnectable={true}
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
                        <div className="value">
                            {variableValue !== null ? String(variableValue) : "Waiting..."}
                        </div>
                        {variableType && <div className="type">({variableType})</div>}
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