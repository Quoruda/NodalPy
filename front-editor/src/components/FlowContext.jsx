import React, { createContext, useContext, useEffect, useRef, useCallback } from 'react';
import { buildVariables } from '../utils/nodeUtils.js';

// Create the context to share flow data and handle sequential execution
const FlowContext = createContext({
    edges: [],
    nodes: [],
    setNodes: () => { },
    setEdges: () => { },
    wsRef: { current: null },
    sendMessage: () => { },
    isConnected: false,
    serverConfig: { debounce: 50, batch_interval: 0, fast_timeout: 1.0, manual_timeout: 0.0 }, // Defaults
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
export const FlowProvider = ({ children, edges, nodes, setNodes, setEdges, wsRef, sendMessage, isConnected, serverConfig, setServerConfig }) => {
    
    // Refs to access current states without recreating functions
    const nodesRef = useRef(nodes);
    const edgesRef = useRef(edges);
    
    useEffect(() => {
        nodesRef.current = nodes;
    }, [nodes]);

    useEffect(() => {
        edgesRef.current = edges;
    }, [edges]);

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

    const runCodeBackend = useCallback((node, timeout = null) => {
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
            timeout,
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
            const { node, timeout } = executionQueueRef.current.shift();
            activeNodeRef.current = node.id;

            runCodeBackend(node, timeout);
        } catch (error) {
            console.error("Queue execution error:", error);
            isExecutingRef.current = false;
            activeNodeRef.current = null;
            setTimeout(() => processQueue(), 0);
        }
    }, [runCodeBackend]);

    const addNodeToQueue = useCallback((node, timeout = null) => {
        const index = executionQueueRef.current.findIndex(item => item.node.id === node.id);
        if (index !== -1) {
            // Update the existing queue item with the latest node state/code
            executionQueueRef.current[index] = { node, timeout };
            return;
        }

        executionQueueRef.current.push({ node, timeout });
        setTimeout(() => processQueue(), 0);
    }, [processQueue]);

    const triggerDownstreamNodes = useCallback((sourceNodeId) => {
        const currentEdges = edgesRef.current;
        const currentNodes = nodesRef.current;

        const targetIds = currentEdges
            .filter(e => e.source === sourceNodeId)
            .map(e => e.target);

        const uniqueTargetIds = [...new Set(targetIds)];

        uniqueTargetIds.forEach(targetId => {
            const targetNode = currentNodes.find(n => n.id === targetId);
            if (!targetNode || targetNode.type !== 'FastNode') return;

            // Check that ALL source nodes of the FastNode have completed (state 2)
            const incomingEdges = currentEdges.filter(e => e.target === targetId);
            const allSourcesReady = incomingEdges.every(edge => {
                const srcNode = currentNodes.find(n => n.id === edge.source);
                return srcNode && srcNode.data?.state === 2;
            });

            if (allSourcesReady) {
                addNodeToQueue({ ...targetNode.data, id: targetNode.id });
            }
        });
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