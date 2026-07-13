import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import { containsCycle } from '../utils/cycleDetection';
import { uiRegistry } from '../core/uiRegistry';

const isValidType = (type) => {
    if (type === 'custom' || type === 'missingPlugin') return true;
    return uiRegistry.slots.nodeTypes.some(p => p.type === type);
};

export const useProjectPersistence = (nodes, edges, setNodes, setEdges, isConnected, sendMessage) => {
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

            const loadedNodes = projectData.nodes.map(node => {
                const isValid = isValidType(node.type);
                return {
                    ...node,
                    type: isValid ? node.type : 'missingPlugin',
                    data: { 
                        ...node.data, 
                        fromLoad: true,
                        missingType: isValid ? undefined : node.type 
                    }
                };
            });
            setNodes(loadedNodes);
            setEdges(projectData.edges);
            
            toast.success("Project loaded from server! 💾✨");
        } else {
            // First time connecting (no saved project on server yet)
            setNodes([]);
            setEdges([]);
        }
        setIsLoaded(true);
    }, [setNodes, setEdges]);

    const saveProjectToFile = useCallback(() => {
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
        const data = { nodes: sanitizedNodes, edges: edgesRef.current };
        const json = JSON.stringify(data, null, 2);

        const blob = new Blob([json], { type: "application/json" });
        const href = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = href;
        link.download = "nodal_project.json";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, []);

    const loadProjectFromFile = useCallback((file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target.result);
                if (json.nodes && json.edges) {
                    if (containsCycle(json.nodes, json.edges)) {
                        toast.error("Import Failed: Project contains loops!");
                        return;
                    }
                    
                    const idMapping = {};
                    const loadedNodes = json.nodes.map(node => {
                        const newId = crypto.randomUUID();
                        idMapping[node.id] = newId;
                        const isValid = isValidType(node.type);
                        return {
                            ...node,
                            id: newId,
                            type: isValid ? node.type : 'missingPlugin',
                            data: { 
                                ...node.data, 
                                fromLoad: true,
                                missingType: isValid ? undefined : node.type 
                            }
                        };
                    });
                    
                    const loadedEdges = json.edges.map(edge => ({
                        ...edge,
                        id: `reactflow__edge-${idMapping[edge.source] || edge.source}-${edge.sourceHandle}-${idMapping[edge.target] || edge.target}-${edge.targetHandle}`,
                        source: idMapping[edge.source] || edge.source,
                        target: idMapping[edge.target] || edge.target
                    }));
                    
                    setNodes(loadedNodes);
                    setEdges(loadedEdges);

                    toast.success("Project imported successfully!");
                } else {
                    toast.error("Invalid project file format.");
                }
            } catch (err) {
                console.error("Load error:", err);
                toast.error("Failed to parse project file.");
            }
        };
        reader.readAsText(file);
    }, [setNodes, setEdges]);

    return {
        isLoaded,
        setIsLoaded,
        loadProject,
        saveProjectToFile,
        loadProjectFromFile
    };
};
