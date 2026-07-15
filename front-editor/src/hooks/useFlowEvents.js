import { useCallback, useEffect, useRef } from 'react';
import { addEdge } from '@xyflow/react';
import { toast } from 'react-toastify';
import { uiRegistry } from '../core/uiRegistry';
import { wouldCreateCycle } from '../utils/cycleDetection.js';

/**
 * Hook to manage all ReactFlow events (drag, drop, connect, changes, etc.)
 */
export const useFlowEvents = ({
    nodes, edges, selectedNodes, selectedEdges,
    setNodes, setEdges,
    onNodesChange, onEdgesChange,
    takeSnapshot,
    addNode,
    screenToFlowPosition,
    setSelectedNodes, setSelectedEdges
}) => {
    // Keep a fresh ref of the graph context to pass to plugin callbacks
    const contextRef = useRef({ nodes, edges, selectedNodes, selectedEdges, setNodes, setEdges, takeSnapshot });
    
    // Update ref synchronously during render
    contextRef.current = { nodes, edges, selectedNodes, selectedEdges, setNodes, setEdges, takeSnapshot };

    const handleNodesChange = useCallback((changes) => {
        const shouldSnapshot = changes.some(c =>
            c.type === 'remove' || c.type === 'add' || c.type === 'replace'
        );
        if (shouldSnapshot) takeSnapshot();
        onNodesChange(changes);
        uiRegistry.fireCallbacks('onNodesChange', changes, contextRef.current);
    }, [onNodesChange, takeSnapshot]);

    const handleEdgesChange = useCallback((changes) => {
        const shouldSnapshot = changes.some(c => c.type === 'remove' || c.type === 'add');
        if (shouldSnapshot) takeSnapshot();
        onEdgesChange(changes);
    }, [onEdgesChange, takeSnapshot]);

    const onNodeDragStart = useCallback(() => {
        takeSnapshot();
    }, [takeSnapshot]);

    const onNodeDragStop = useCallback((_event, node) => {
        uiRegistry.fireCallbacks('onNodeDragStop', _event, node, contextRef.current);
    }, []);

    const onNodeDrag = useCallback((_event, node) => {
        uiRegistry.fireCallbacks('onNodeDrag', _event, node, contextRef.current);
    }, []);

    const onConnectEdge = useCallback(
        (params) => {
            if (wouldCreateCycle(nodes, edges, params)) {
                toast.error("Cycles forbidden! 🚫 Loop detected.");
                return;
            }
            takeSnapshot();
            setEdges((eds) => addEdge(params, eds));
        },
        [setEdges, nodes, edges, takeSnapshot]
    );

    const onSelectionChange = useCallback(({ nodes, edges }) => {
        setSelectedNodes(nodes || []);
        setSelectedEdges(edges || []);
    }, [setSelectedNodes, setSelectedEdges]);

    const onDragOver = useCallback((event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback(
        (event) => {
            event.preventDefault();
            const type = event.dataTransfer.getData('application/reactflow');

            if (typeof type === 'undefined' || !type) {
                return;
            }

            const position = screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });

            takeSnapshot();
            addNode(type, position);
        },
        [addNode, screenToFlowPosition, takeSnapshot],
    );

    return {
        handleNodesChange,
        handleEdgesChange,
        onNodeDragStart,
        onNodeDragStop,
        onNodeDrag,
        onConnectEdge,
        onSelectionChange,
        onDragOver,
        onDrop
    };
};
