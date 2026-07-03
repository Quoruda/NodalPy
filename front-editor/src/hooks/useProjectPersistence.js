import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import { containsCycle } from '../utils/cycleDetection';

export const useProjectPersistence = (nodes, edges, setNodes, setEdges, setNodeCount, isConnected, sendMessage) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const hasUnsavedChanges = useRef(false);
    const nodesRef = useRef(nodes);
    const edgesRef = useRef(edges);

    useEffect(() => {
        nodesRef.current = nodes;
        edgesRef.current = edges;
    }, [nodes, edges]);

    // Send load request when connection is established
    useEffect(() => {
        if (isConnected) {
            sendMessage({ action: "load_project" });
        } else {
            setIsLoaded(false);
        }
    }, [isConnected, sendMessage]);

    const saveProjectToBackend = useCallback(() => {
        if (!isLoaded || !isConnected) return;

        // Sanitize nodes to remove heavy execution data (output, error)
        const sanitizedNodes = nodesRef.current.map(node => ({
            ...node,
            data: {
                ...node.data,
                output: undefined,
                error: undefined,
                state: 0,
                outputs: node.data.outputs ? node.data.outputs.map(out => ({
                    ...out,
                    value: undefined,
                    type: undefined
                })) : undefined
            }
        }));

        sendMessage({
            action: "save_project",
            project_data: { nodes: sanitizedNodes, edges: edgesRef.current }
        });
    }, [isLoaded, isConnected, sendMessage]);

    // Track changes to trigger auto-save
    useEffect(() => {
        if (isLoaded) {
            hasUnsavedChanges.current = true;
        }
    }, [nodes, edges, isLoaded]);

    // Auto-save every 5 seconds if changes are made
    useEffect(() => {
        const intervalId = setInterval(() => {
            if (isLoaded && hasUnsavedChanges.current && isConnected) {
                saveProjectToBackend();
                hasUnsavedChanges.current = false;
            }
        }, 5000);

        return () => clearInterval(intervalId);
    }, [saveProjectToBackend, isLoaded, isConnected]);

    const loadProject = useCallback((projectData) => {
        if (projectData && projectData.nodes && projectData.edges) {
            if (containsCycle(projectData.nodes, projectData.edges)) {
                toast.error("Import Failed: Saved project contains loops!");
                setIsLoaded(true);
                return;
            }

            const loadedNodes = projectData.nodes.map(node => ({
                ...node,
                data: { ...node.data, fromLoad: true }
            }));
            setNodes(loadedNodes);
            setEdges(projectData.edges);

            const maxId = projectData.nodes.reduce((max, node) => {
                const numId = parseInt(node.id);
                return isNaN(numId) ? max : Math.max(max, numId);
            }, 0);
            setNodeCount(maxId + 1);
            
            toast.success("Project loaded from server! 💾✨");
        } else {
            // First time connecting (no saved project on server yet)
            setNodes([]);
            setEdges([]);
            setNodeCount(0);
        }
        setIsLoaded(true);
    }, [setNodes, setEdges, setNodeCount]);

    return {
        isLoaded,
        setIsLoaded,
        loadProject
    };
};
