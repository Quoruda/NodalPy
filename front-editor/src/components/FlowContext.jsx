import React, { createContext, useContext, useEffect, useRef, useCallback } from 'react';
import { buildVariables } from '../utils/nodeUtils.js';
import { uiRegistry } from '../core/uiRegistry';

// Create the context to share flow data and handle sequential execution
const FlowContext = createContext({
    edges: [],
    nodes: [],
    setNodes: () => { },
    setEdges: () => { },
    wsRef: { current: null },
    sendMessage: () => { },
    isConnected: false,
    serverConfig: { core: { debounce: 50, batch_interval: 0 }, plugins: {} }, // Defaults
    setServerConfig: () => { },
    addNodeToQueue: () => { },
    triggerDownstreamNodes: () => { },
    updateNode: () => { }
});

// Custom hook to use the context easily
// eslint-disable-next-line react-refresh/only-export-components
export const useFlowContext = () => {
    const context = useContext(FlowContext);
    if (!context) {
        throw new Error('useFlowContext must be used within a FlowProvider');
    }
    return context;
};

// Provider to wrap ReactFlow
export const FlowProvider = ({ activeProjectId, children, edges, nodes, setNodes, setEdges, wsRef, sendMessage, isConnected, serverConfig, setServerConfig }) => {
    
    const nodesRef = useRef(nodes);
    const edgesRef = useRef(edges);
    const activeProjectIdRef = useRef(activeProjectId);
    
    useEffect(() => {
        nodesRef.current = nodes;
    }, [nodes]);

    useEffect(() => {
        edgesRef.current = edges;
    }, [edges]);

    useEffect(() => {
        activeProjectIdRef.current = activeProjectId;
    }, [activeProjectId]);



    // Global sequential execution queue (avoids parallelism rejected by the Python server)
    const executionQueueRef = useRef([]);
    const isExecutingRef = useRef(false);
    const activeNodeRef = useRef(null);

    const updateNode = useCallback((nodeId, updates) => {
        setNodes((nds) =>
            nds.map((node) =>
                node.id === nodeId
                    ? {
                        ...node,
                        data: {
                            ...node.data,
                            ...updates
                        },
                    }
                    : node
            )
        );
    }, [setNodes]);

    const runCodeBackend = useCallback((node) => {
        const variables = buildVariables(node, edgesRef.current, nodesRef.current);
        const fullNode = nodesRef.current.find(n => n.id === node.id);
        const nodeType = fullNode ? fullNode.type : 'CustomNode';

        sendMessage({
            action: "run_node",
            code: node.code,
            variables,
            inputs: (node.inputs || []).map(i => i.name),
            node: node.id,
            node_type: nodeType,
        });

        setNodes((nds) =>
            nds.map((n) =>
                n.id === node.id ? { ...n, data: { ...n.data, state: 1, output: '', error: null } } : n
            )
        );
    }, [sendMessage, setNodes]);

    const processQueue = useCallback(() => {
        if (isExecutingRef.current) return;
        if (executionQueueRef.current.length === 0) return;

        isExecutingRef.current = true;

        try {
            const { node } = executionQueueRef.current.shift();
            activeNodeRef.current = node.id;

            runCodeBackend(node);
        } catch (error) {
            console.error("Queue execution error:", error);
            isExecutingRef.current = false;
            activeNodeRef.current = null;
            setTimeout(() => processQueue(), 0);
        }
    }, [runCodeBackend]);

    const addNodeToQueue = useCallback((node) => {
        const index = executionQueueRef.current.findIndex(item => item.node.id === node.id);
        if (index !== -1) {
            // Update the existing queue item with the latest node state/code
            executionQueueRef.current[index] = { node };
            return;
        }

        executionQueueRef.current.push({ node });
        setTimeout(() => processQueue(), 0);
    }, [processQueue]);

    const triggerDownstreamNodes = useCallback((sourceNodeId) => {
        const currentEdges = edgesRef.current;
        const currentNodes = nodesRef.current;

        const sourceNode = currentNodes.find(n => n.id === sourceNodeId);
        const sourceConfig = sourceNode ? uiRegistry.slots.nodeTypes.find(n => n.type === sourceNode.type)?.config : null;
        const isSourceTrigger = Boolean(sourceConfig?.isTrigger || sourceNode?.data?.isTrigger);

        const targetIds = currentEdges
            .filter(e => e.source === sourceNodeId)
            .map(e => e.target);

        const uniqueTargetIds = [...new Set(targetIds)];

        uniqueTargetIds.forEach(targetId => {
            const targetNode = currentNodes.find(n => n.id === targetId);
            if (!targetNode) return;

            const nodeConfig = uiRegistry.slots.nodeTypes.find(n => n.type === targetNode.type)?.config;
            const isAutoTrigger = targetNode.data?.autoTrigger !== undefined ? targetNode.data.autoTrigger : nodeConfig?.autoTrigger;

            if (!isAutoTrigger && !isSourceTrigger) return;

            const incomingEdges = currentEdges.filter(e => e.target === targetId);
            const allSourcesReady = incomingEdges.every(edge => {
                if (edge.source === sourceNodeId) return true;
                const srcNode = currentNodes.find(n => n.id === edge.source);
                return srcNode && srcNode.data?.state === 2;
            });

            if (allSourcesReady) {
                let nodePayload = { ...targetNode.data, id: targetNode.id };
                if (targetNode.data?.masterId) {
                    const masterNode = currentNodes.find(n => n.id === targetNode.data.masterId);
                    if (masterNode) {
                        nodePayload.code = masterNode.data?.code || '';
                    }
                }
                addNodeToQueue(nodePayload);
            }
        });
    }, [addNodeToQueue]);

    useEffect(() => {
        const handleTriggerFired = (e) => {
            const { node_id, output } = e.detail;
            const targetNode = nodesRef.current.find(n => n.id === node_id);
            if (!targetNode) return;

            setNodes((nds) =>
                nds.map((n) =>
                    n.id === node_id
                        ? {
                            ...n,
                            data: {
                                ...n.data,
                                state: 2,
                                lastTriggeredAt: output?.timestamp || new Date().toISOString(),
                                tickCount: (n.data?.tickCount || 0) + 1
                            }
                        }
                        : n
                )
            );

            triggerDownstreamNodes(node_id);
        };

        const handleUpdateNodeTrigger = (e) => {
            const { nodeId, isActive, configPatch } = e.detail;
            const targetNode = nodesRef.current.find(n => n.id === nodeId);
            if (!targetNode) return;

            const currentIsActive = isActive !== undefined ? isActive : targetNode.data?.isActive;
            const config = {
                mode: targetNode.data?.mode || 'interval',
                interval: targetNode.data?.interval !== undefined ? targetNode.data.interval : 5,
                unit: targetNode.data?.unit || 'seconds',
                targetTime: targetNode.data?.targetTime || '12:00:00',
                repeatDaily: targetNode.data?.repeatDaily !== undefined ? targetNode.data.repeatDaily : true,
                ...(configPatch || {})
            };

            sendMessage({
                action: "update_trigger",
                project_id: activeProjectIdRef.current || 'default',
                node_id: nodeId,
                node_type: targetNode.type,
                is_active: currentIsActive,
                config
            });
        };

        window.addEventListener('trigger_fired', handleTriggerFired);
        window.addEventListener('update_node_trigger', handleUpdateNodeTrigger);
        return () => {
            window.removeEventListener('trigger_fired', handleTriggerFired);
            window.removeEventListener('update_node_trigger', handleUpdateNodeTrigger);
        };
    }, [sendMessage, setNodes, triggerDownstreamNodes]);

    useEffect(() => {
        const handleAutoRun = (e) => {
            const { nodeId } = e.detail;
            const targetNode = nodesRef.current.find(n => n.id === nodeId);
            if (!targetNode) return;

            const nodeConfig = uiRegistry.slots.nodeTypes.find(n => n.type === targetNode.type)?.config;
            if (nodeConfig && nodeConfig.autoTrigger) {
                let nodePayload = { ...targetNode.data, id: targetNode.id };
                if (targetNode.data?.masterId) {
                    const masterNode = nodesRef.current.find(n => n.id === targetNode.data.masterId);
                    if (masterNode) {
                        nodePayload.code = masterNode.data?.code || '';
                    }
                }
                addNodeToQueue(nodePayload);
            }
        };

        window.addEventListener('auto_run_node', handleAutoRun);
        return () => window.removeEventListener('auto_run_node', handleAutoRun);
    }, [addNodeToQueue]);

    // Unblocks and executes the next node as soon as the active node completes (success or error)
    useEffect(() => {
        if (!isExecutingRef.current || !activeNodeRef.current) return;

        const activeNode = nodes.find(n => n.id === activeNodeRef.current);
        if (!activeNode) {
            // The active node was deleted or no longer exists! Unblock the queue.
            isExecutingRef.current = false;
            activeNodeRef.current = null;
            processQueue();
            return;
        }

        const state = activeNode.data?.state;
        if (state === 2 || state === 3 || state === 0) {
            // Trigger downstream nodes if the node completed successfully
            if (state === 2) {
                triggerDownstreamNodes(activeNode.id);
            }

            isExecutingRef.current = false;
            activeNodeRef.current = null;
            processQueue();
        }
    }, [nodes, processQueue, triggerDownstreamNodes]);

    // Empty the queue on disconnect and cancel active nodes
    useEffect(() => {
        if (!isConnected) {
            executionQueueRef.current = [];
            isExecutingRef.current = false;
            activeNodeRef.current = null;
            setNodes((nds) =>
                nds.map((n) =>
                    n.data.state === 1 ? { ...n, data: { ...n.data, state: 3, error: "Disconnected from server" } } : n
                )
            );
        }
    }, [isConnected, setNodes]);

    return (
        <FlowContext.Provider value={{
            nodes, edges, setNodes, setEdges, wsRef, sendMessage, isConnected, serverConfig, setServerConfig,
            addNodeToQueue, triggerDownstreamNodes, updateNode
        }}>
            {children}
        </FlowContext.Provider>
    );
};