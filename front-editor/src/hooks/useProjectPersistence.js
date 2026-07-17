import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
import { containsCycle } from '../utils/cycleDetection';
import { uiRegistry } from '../core/uiRegistry';

const isValidType = (type) => {
    if (type === 'custom' || type === 'missingPlugin') return true;
    return uiRegistry.slots.nodeTypes.some(p => p.type === type);
};

const sanitizeNodes = (nodes) => {
    return nodes.map(node => ({
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
};

const validateAndPrepareNodes = (rawNodes) => {
    return rawNodes.map(node => {
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
};

export const useProjectPersistence = (nodes, edges, setNodes, setEdges, isConnected, sendMessage) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [openTabs, setOpenTabs] = useState([]);
    const [activeProjectId, setActiveProjectId] = useState(null);
    const [allProjects, setAllProjects] = useState([]);

    const hasUnsavedChanges = useRef(false);
    const nodesRef = useRef(nodes);
    const edgesRef = useRef(edges);
    const projectCacheRef = useRef({});
    const activeProjectIdRef = useRef(null);

    useEffect(() => {
        nodesRef.current = nodes;
        edgesRef.current = edges;
    }, [nodes, edges]);

    useEffect(() => {
        activeProjectIdRef.current = activeProjectId;
        if (activeProjectId) {
            localStorage.setItem('nodalpy_active_project', activeProjectId);
        }
    }, [activeProjectId]);

    useEffect(() => {
        if (openTabs.length > 0) {
            localStorage.setItem('nodalpy_open_tabs', JSON.stringify(openTabs));
        }
    }, [openTabs]);

    // Request project list on initial connection
    useEffect(() => {
        if (isConnected && !isLoaded) {
            sendMessage({ action: "list_projects" });
        }
    }, [isConnected, isLoaded, sendMessage]);

    // Listen for list_projects response
    useEffect(() => {
        const handler = (e) => {
            const msg = e.detail;
            if (msg.status === "success") {
                setAllProjects(msg.projects);
                if (!isLoaded) {
                    if (msg.projects.length > 0) {
                        let savedTabs = [];
                        let savedActive = null;
                        try {
                            savedTabs = JSON.parse(localStorage.getItem('nodalpy_open_tabs') || '[]');
                            savedActive = localStorage.getItem('nodalpy_active_project');
                        } catch (e) {}

                        // Filter saved tabs to only those that still exist on server
                        const validSavedTabs = savedTabs.filter(t => msg.projects.some(p => p.id === t.id));
                        
                        if (validSavedTabs.length > 0) {
                            // Update tab names from server just in case
                            const updatedTabs = validSavedTabs.map(t => {
                                const p = msg.projects.find(p => p.id === t.id);
                                return { id: t.id, name: p.name };
                            });
                            setOpenTabs(updatedTabs);
                            
                            const targetId = (savedActive && updatedTabs.some(t => t.id === savedActive)) 
                                ? savedActive 
                                : updatedTabs[0].id;
                                
                            setActiveProjectId(targetId);
                            sendMessage({ action: "load_project", project_id: targetId });
                        } else {
                            const first = msg.projects[0];
                            setOpenTabs([{ id: first.id, name: first.name }]);
                            setActiveProjectId(first.id);
                            sendMessage({ action: "load_project", project_id: first.id });
                        }
                    } else {
                        sendMessage({ action: "create_project", name: "My Project" });
                    }
                }
            }
        };
        window.addEventListener('ws_list_projects', handler);
        return () => window.removeEventListener('ws_list_projects', handler);
    }, [isLoaded, sendMessage]);

    // Listen for create_project response
    useEffect(() => {
        const handler = (e) => {
            const msg = e.detail;
            if (msg.status === "success" && msg.project) {
                const newTab = { id: msg.project.id, name: msg.project.name };
                setAllProjects(prev => [msg.project, ...prev]);
                setOpenTabs(prev => [...prev, newTab]);

                // Cache current project before switching
                if (activeProjectIdRef.current) {
                    projectCacheRef.current[activeProjectIdRef.current] = {
                        nodes: nodesRef.current,
                        edges: edgesRef.current
                    };
                }

                setActiveProjectId(msg.project.id);
                setNodes([]);
                setEdges([]);
                setIsLoaded(true);
                hasUnsavedChanges.current = false;
            }
        };
        window.addEventListener('ws_create_project', handler);
        return () => window.removeEventListener('ws_create_project', handler);
    }, [setNodes, setEdges]);

    // Listen for load_project response
    useEffect(() => {
        const handler = (e) => {
            const msg = e.detail;
            if (msg.status === "success" && msg.project_data) {
                const projectData = msg.project_data;
                if (projectData.nodes && projectData.edges) {
                    if (containsCycle(projectData.nodes, projectData.edges)) {
                        toast.error("Project contains loops! Loading empty canvas.");
                        setNodes([]);
                        setEdges([]);
                    } else {
                        setNodes(validateAndPrepareNodes(projectData.nodes));
                        setEdges(projectData.edges);
                    }

                    // Update tab name from metadata
                    if (projectData.meta?.name) {
                        setOpenTabs(prev => prev.map(tab =>
                            tab.id === msg.project_id
                                ? { ...tab, name: projectData.meta.name }
                                : tab
                        ));
                    }
                } else {
                    setNodes([]);
                    setEdges([]);
                }
                setIsLoaded(true);
                hasUnsavedChanges.current = false;
            } else if (msg.status === "error") {
                toast.error(`Failed to load project: ${msg.error}`);
            }
        };
        window.addEventListener('ws_load_project', handler);
        return () => window.removeEventListener('ws_load_project', handler);
    }, [setNodes, setEdges]);

    // Listen for delete_project response
    useEffect(() => {
        const handler = (e) => {
            const msg = e.detail;
            if (msg.status === "success") {
                const deletedId = msg.project_id;
                delete projectCacheRef.current[deletedId];
                setAllProjects(prev => prev.filter(p => p.id !== deletedId));
                setOpenTabs(prev => {
                    const remaining = prev.filter(t => t.id !== deletedId);
                    if (remaining.length === 0) {
                        localStorage.removeItem('nodalpy_open_tabs');
                    }
                    if (activeProjectIdRef.current === deletedId) {
                        if (remaining.length > 0) {
                            switchToProject(remaining[0].id);
                        } else {
                            sendMessage({ action: "create_project", name: "My Project" });
                        }
                    }
                    return remaining;
                });
                toast.success("Project deleted.");
            }
        };
        window.addEventListener('ws_delete_project', handler);
        return () => window.removeEventListener('ws_delete_project', handler);
    }, [sendMessage]);

    // Listen for rename_project response
    useEffect(() => {
        const handler = (e) => {
            const msg = e.detail;
            if (msg.status === "success") {
                setOpenTabs(prev => prev.map(tab =>
                    tab.id === msg.project_id ? { ...tab, name: msg.name } : tab
                ));
                setAllProjects(prev => prev.map(p =>
                    p.id === msg.project_id ? { ...p, name: msg.name } : p
                ));
            }
        };
        window.addEventListener('ws_rename_project', handler);
        return () => window.removeEventListener('ws_rename_project', handler);
    }, []);

    // Auto-save active project
    const saveProjectToBackend = useCallback(() => {
        if (!isLoaded || !isConnected || !activeProjectId) return;
        const sanitizedNodes = sanitizeNodes(nodesRef.current);
        sendMessage({
            action: "save_project",
            project_id: activeProjectId,
            project_data: { nodes: sanitizedNodes, edges: edgesRef.current }
        });
    }, [isLoaded, isConnected, sendMessage, activeProjectId]);

    // Sync on reconnect
    useEffect(() => {
        if (isConnected && isLoaded && hasUnsavedChanges.current) {
            saveProjectToBackend();
            hasUnsavedChanges.current = false;
        }
    }, [isConnected, isLoaded, saveProjectToBackend]);

    // Track changes
    useEffect(() => {
        if (isLoaded) {
            hasUnsavedChanges.current = true;
        }
    }, [nodes, edges, isLoaded]);

    // Auto-save interval
    useEffect(() => {
        const intervalId = setInterval(() => {
            if (isLoaded && hasUnsavedChanges.current && isConnected) {
                saveProjectToBackend();
                hasUnsavedChanges.current = false;
            }
        }, 5000);
        return () => clearInterval(intervalId);
    }, [saveProjectToBackend, isLoaded, isConnected]);

    // Switch to a different project tab
    const switchToProject = useCallback((projectId) => {
        if (projectId === activeProjectIdRef.current) return;

        // Save current state before switching
        if (activeProjectIdRef.current && isLoaded) {
            saveProjectToBackend();
            hasUnsavedChanges.current = false;
            projectCacheRef.current[activeProjectIdRef.current] = {
                nodes: nodesRef.current,
                edges: edgesRef.current
            };
        }

        setActiveProjectId(projectId);

        // Restore from cache or load from server
        const cached = projectCacheRef.current[projectId];
        if (cached) {
            setNodes(cached.nodes);
            setEdges(cached.edges);
        } else {
            setNodes([]);
            setEdges([]);
            sendMessage({ action: "load_project", project_id: projectId });
        }
    }, [isLoaded, saveProjectToBackend, sendMessage, setNodes, setEdges]);

    // Open an existing project in a new tab
    const openProject = useCallback((projectId, projectName) => {
        const alreadyOpen = openTabs.find(t => t.id === projectId);
        if (alreadyOpen) {
            switchToProject(projectId);
            return;
        }
        setOpenTabs(prev => [...prev, { id: projectId, name: projectName }]);
        switchToProject(projectId);
    }, [openTabs, switchToProject]);

    // Close a tab (does NOT delete the project)
    const closeTab = useCallback((projectId) => {
        // Save before closing
        if (projectId === activeProjectIdRef.current) {
            saveProjectToBackend();
        }
        delete projectCacheRef.current[projectId];

        setOpenTabs(prev => {
            const remaining = prev.filter(t => t.id !== projectId);
            if (remaining.length === 0) {
                localStorage.removeItem('nodalpy_open_tabs');
                sendMessage({ action: "create_project", name: "My Project" });
                return [];
            }
            if (projectId === activeProjectIdRef.current) {
                const idx = prev.findIndex(t => t.id === projectId);
                const nextTab = remaining[Math.min(idx, remaining.length - 1)];
                switchToProject(nextTab.id);
            }
            return remaining;
        });
    }, [saveProjectToBackend, switchToProject, sendMessage]);

    // Create a new project
    const createProject = useCallback((name = "Untitled") => {
        sendMessage({ action: "create_project", name });
    }, [sendMessage]);

    // Delete a project
    const deleteProject = useCallback((projectId) => {
        sendMessage({ action: "delete_project", project_id: projectId });
    }, [sendMessage]);

    // Rename a project
    const renameProject = useCallback((projectId, name) => {
        sendMessage({ action: "rename_project", project_id: projectId, name });
    }, [sendMessage]);

    // Export active project to file
    const saveProjectToFile = useCallback(() => {
        const activeTab = openTabs.find(t => t.id === activeProjectId);
        const sanitizedNodes = sanitizeNodes(nodesRef.current);
        const data = {
            meta: {
                name: activeTab?.name || "Untitled",
                exportedAt: new Date().toISOString()
            },
            nodes: sanitizedNodes,
            edges: edgesRef.current
        };
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const href = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = href;
        link.download = `${(activeTab?.name || "project").replace(/[^a-zA-Z0-9]/g, '_')}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, [activeProjectId, openTabs]);

    const loadProjectFromData = useCallback((json, fallbackName) => {
        try {
            const rawNodes = json.nodes || [];
            const rawEdges = json.edges || [];

            if (containsCycle(rawNodes, rawEdges)) {
                toast.error("Import Failed: Project contains loops!");
                return;
            }

            const idMapping = {};
            rawNodes.forEach(node => {
                idMapping[node.id] = crypto.randomUUID();
            });

            const loadedNodes = rawNodes.map(node => {
                const newId = idMapping[node.id];
                const isValid = isValidType(node.type);
                let newGroupBaseId = node.data?.groupBaseId;
                if (newGroupBaseId && idMapping[newGroupBaseId]) {
                    newGroupBaseId = idMapping[newGroupBaseId];
                }
                return {
                    ...node,
                    id: newId,
                    type: isValid ? node.type : 'missingPlugin',
                    data: {
                        ...node.data,
                        fromLoad: true,
                        missingType: isValid ? undefined : node.type,
                        groupBaseId: newGroupBaseId
                    }
                };
            });

            const loadedEdges = rawEdges.map(edge => ({
                ...edge,
                id: `reactflow__edge-${idMapping[edge.source] || edge.source}-${edge.sourceHandle}-${idMapping[edge.target] || edge.target}-${edge.targetHandle}`,
                source: idMapping[edge.source] || edge.source,
                target: idMapping[edge.target] || edge.target
            }));

            // Create a new project on the server for this import
            const projectName = json.meta?.name || fallbackName || "Imported";

            // We need to create the project, then populate it
            const tempId = crypto.randomUUID();
            projectCacheRef.current[tempId] = { nodes: loadedNodes, edges: loadedEdges };

            // Listen for the create response to save the data
            const onCreated = (ev) => {
                const msg = ev.detail;
                if (msg.status === "success" && msg.project) {
                    // Move cached data to the real ID
                    const cached = projectCacheRef.current[tempId];
                    delete projectCacheRef.current[tempId];
                    if (cached) {
                        projectCacheRef.current[msg.project.id] = cached;
                        // Since create_project handler will set this as active with empty canvas,
                        // we need to override with the imported data
                        setNodes(cached.nodes);
                        setEdges(cached.edges);
                        hasUnsavedChanges.current = true;
                    }
                    window.removeEventListener('ws_create_project', onCreated);
                }
            };
            window.addEventListener('ws_create_project', onCreated);
            sendMessage({ action: "create_project", name: projectName });

        } catch (err) {
            console.error("Load error:", err);
            toast.error("Failed to parse project data.");
        }
    }, [sendMessage, setNodes, setEdges]);

    // Import a file as a new project
    const loadProjectFromFile = useCallback((file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target.result);
                loadProjectFromData(json, file.name.replace('.json', ''));
            } catch (err) {
                console.error("Load error:", err);
                toast.error("Failed to parse project file.");
            }
        };
        reader.readAsText(file);
    }, [loadProjectFromData]);

    return {
        isLoaded,
        openTabs,
        activeProjectId,
        allProjects,
        switchToProject,
        openProject,
        closeTab,
        createProject,
        deleteProject,
        renameProject,
        saveProjectToFile,
        loadProjectFromFile,
        loadProjectFromData
    };
};
