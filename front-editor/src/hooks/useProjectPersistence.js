import { useState, useEffect, useCallback } from 'react';
import { get, set } from 'idb-keyval';
import { toast } from 'react-toastify';

export const useProjectPersistence = (nodes, edges, setNodes, setEdges, setNodeCount) => {
    const [isLoaded, setIsLoaded] = useState(false);

    // Load from IndexedDB on mount
    useEffect(() => {
        const loadFromIDB = async () => {
            try {
                const flowData = await get('flowData');
                if (flowData) {
                    const parsedData = JSON.parse(flowData);
                    console.log("Loaded flow data from IndexedDB");
                    if (parsedData.nodes && parsedData.edges) {
                        setNodes(parsedData.nodes);
                        setEdges(parsedData.edges);
                        setNodeCount(parsedData.nodes.length + 1);
                    }
                }
            } catch (err) {
                console.error("Failed to load from IndexedDB:", err);
                toast.error("Failed to load project from storage.");
            } finally {
                setIsLoaded(true);
            }
        };
        loadFromIDB();
    }, [setNodes, setEdges, setNodeCount]);

    const saveProjectToIDB = useCallback(() => {
        if (!isLoaded) return; // Don't save before initial load completes

        // Sanitize nodes to remove heavy execution data (output, error)
        const sanitizedNodes = nodes.map(node => ({
            ...node,
            data: {
                ...node.data,
                output: undefined, // Clear large outputs
                error: undefined,
                state: 0 // Reset state on save
            }
        }));

        const data = { nodes: sanitizedNodes, edges: edges };
        const json_data = JSON.stringify(data);

        set('flowData', json_data)
            .then(() => console.log("Project saved to IndexedDB (async)"))
            .catch(err => console.error("Failed to save to IndexedDB:", err));

    }, [nodes, edges, isLoaded]);

    // Auto-save debounce
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (isLoaded) {
                saveProjectToIDB();
            }
        }, 1000); // 1 second debounce

        return () => clearTimeout(timeoutId);
    }, [nodes, edges, saveProjectToIDB, isLoaded]);

    // Manual Save to File
    // Manual Save to File
    const saveProjectToFile = useCallback(() => {
        const sanitizedNodes = nodes.map(node => ({
            ...node,
            data: {
                ...node.data,
                output: undefined,
                error: undefined,
                state: 0
            }
        }));
        const data = { nodes: sanitizedNodes, edges: edges };
        const json = JSON.stringify(data, null, 2);

        // Check for PyWebView integration
        if (window.pywebview && window.pywebview.api) {
            window.pywebview.api.save_file(json).then(success => {
                if (success) toast.success("Project saved successfully!");
                else toast.warn("Save cancelled or failed.");
            }).catch(err => {
                console.error("PyWebView save error:", err);
                toast.error("Failed to save via Desktop API.");
            });
            return;
        }

        // Fallback to Browser Download
        const blob = new Blob([json], { type: "application/json" });
        const href = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = href;
        link.download = "nodal_project.json";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, [nodes, edges]);

    // Manual Load from File
    const loadProjectFromFile = useCallback((file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target.result);
                if (json.nodes && json.edges) {
                    setNodes(json.nodes);
                    setEdges(json.edges);

                    // Recalculate node count
                    const maxId = json.nodes.reduce((max, node) => {
                        const numId = parseInt(node.id);
                        return isNaN(numId) ? max : Math.max(max, numId);
                    }, 0);
                    setNodeCount(maxId + 1);

                    toast.success("Project loaded successfully!");
                } else {
                    toast.error("Invalid project file format.");
                }
            } catch (err) {
                console.error("Load error:", err);
                toast.error("Failed to parse project file.");
            }
        };
        reader.readAsText(file);
    }, [setNodes, setEdges, setNodeCount]);

    return {
        isLoaded,
        saveProjectToIDB,
        saveProjectToFile,
        loadProjectFromFile
    };
};
