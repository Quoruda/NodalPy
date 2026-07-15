import { toast } from "react-toastify";

export const processSystemMessage = (msg, setServerConfigRef, frontVersionRef, onProjectLoadedRef) => {
    if (msg.action === "login") {
        if (msg.status === "preparing") {
            toast.loading(msg.message || "Initializing Python environment...", {
                toastId: "runner_prep"
            });
        } else if (msg.status === "success" && msg.config) {
            if (toast.isActive("runner_prep")) {
                toast.update("runner_prep", {
                    render: "Python environment ready! 🐍✨",
                    type: "success",
                    isLoading: false,
                    autoClose: 2000
                });
            } else {
                toast.success("Python environment connected! 🐍✨", {
                    autoClose: 2000
                });
            }
            setServerConfigRef.current(msg.config);
            
            if (msg.front_version) {
                if (frontVersionRef.current === null) {
                    frontVersionRef.current = msg.front_version;
                } else if (frontVersionRef.current !== msg.front_version) {
                    console.log("New frontend version detected. Reloading page...");
                    toast.info("New update available! Reloading the page...", {
                        autoClose: 1500,
                        onClose: () => window.location.reload()
                    });
                    return;
                }
            }
        }
    } else if (msg.action === "load_project") {
        if (msg.status === "success" && msg.project_data) {
            onProjectLoadedRef.current?.(msg.project_data);
        } else if (msg.status === "empty") {
            onProjectLoadedRef.current?.({});
        } else if (msg.status === "error") {
            toast.error(`Failed to load project: ${msg.error}`);
        }
    } else if (msg.action === "save_project") {
        if (msg.status === "success") {
            console.log("Project auto-saved to backend successfully.");
        } else if (msg.status === "error") {
            toast.error(`Failed to save project: ${msg.error}`);
        }
    } else if (msg.action === "fs_list") {
        if (msg.status === "success") {
            window.dispatchEvent(new CustomEvent('fs_tree_update', { detail: msg.tree }));
        }
    } else if (msg.action === "fs_read") {
        window.dispatchEvent(new CustomEvent('fs_read_result', { detail: msg }));
    }
};

export const processNodeMessages = (nodeMessages, setNodesRef, notifyExecution, notificationThrottleMap) => {
    setNodesRef.current((currentNodes) => {
        let updatedNodes = [...currentNodes];
        let hasChanges = false;

        nodeMessages.forEach(msg => {
            if (msg.action === "run_code") {
                const nodeIndex = updatedNodes.findIndex(n => n.id === msg.node);
                if (nodeIndex !== -1) {
                    const node = updatedNodes[nodeIndex];
                    let newData = { ...node.data };
                    let changed = false;

                    if (msg.status === "running") {
                        if (newData.state !== 1) { newData.state = 1; changed = true; }
                    }
                    if (msg.status === "finished") {
                        if (newData.state !== 2) { newData.state = 2; changed = true; }
                        newData.error = null;
                        
                        if (msg.output !== undefined && msg.output !== "") {
                            newData.logs = msg.output;
                            changed = true;
                        } else if (newData.logs) {
                            newData.logs = null;
                            changed = true;
                        }

                        // Side Effect: Notifications
                        if (node.type === 'custom') {
                            const now = Date.now();
                            const lastTime = notificationThrottleMap.current.get(node.id) || 0;
                            if (now - lastTime > 1000) { // Max 1 notification per second per node
                                notifyExecution(node.data.title, node.id);
                                notificationThrottleMap.current.set(node.id, now);
                            }
                        }
                    }
                    if (msg.status === "error") {
                        if (newData.state !== 3) { newData.state = 3; changed = true; }
                        newData.error = msg.error;
                    }

                    if (changed || msg.status === "finished" || msg.status === "error") {
                        updatedNodes[nodeIndex] = { ...node, data: newData };
                        hasChanges = true;
                    }
                }
            }
            else if (msg.action === "get_variable") {
                const nodeIndex = updatedNodes.findIndex(n => n.id === msg.node);
                if (nodeIndex !== -1) {
                    const node = updatedNodes[nodeIndex];
                    const newOutputs = node.data.outputs.map((output) => {
                        if (output.name === msg.name) {
                            return { ...output, value: msg.value, type: msg.type };
                        }
                        return output;
                    });

                    updatedNodes[nodeIndex] = { ...node, data: { ...node.data, outputs: newOutputs } };
                    hasChanges = true;

                    const isValueMissing = msg.error || msg.value === null || msg.value === undefined;
                    if (isValueMissing) {
                        window.dispatchEvent(new CustomEvent('auto_run_node', { detail: { nodeId: node.id } }));
                    }
                }
            }
        });

        return hasChanges ? updatedNodes : currentNodes;
    });
};
