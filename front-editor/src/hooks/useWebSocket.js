import { useCallback, useEffect, useRef } from 'react';
import { toast } from "react-toastify";

// ✅ Hook WebSocket dédié et réutilisable avec reconnexion automatique
export const useWebSocket = (url, setNodes, setServerConfig) => {
    const wsRef = useRef(null);
    const reconnectAttemptsRef = useRef(0);
    const reconnectTimeoutRef = useRef(null);
    const isManualCloseRef = useRef(false);
    const setNodesRef = useRef(setNodes);
    const setServerConfigRef = useRef(setServerConfig);

    const WEBSOCKET_ERROR_TOAST_ID = "websocket-error";
    const WEBSOCKET_RECONNECTING_TOAST_ID = "websocket-reconnecting";
    const WEBSOCKET_CONNECTED_TOAST_ID = "websocket-connected";

    // Throttle map for notifications
    const notificationThrottleMap = useRef(new Map());

    useEffect(() => {
        setNodesRef.current = setNodes;
        setServerConfigRef.current = setServerConfig;
    }, [setNodes, setServerConfig]);

    const clearNotifs = useCallback(() => {
        toast.dismiss(WEBSOCKET_ERROR_TOAST_ID);
        toast.dismiss(WEBSOCKET_RECONNECTING_TOAST_ID);
        toast.dismiss(WEBSOCKET_CONNECTED_TOAST_ID);
    }, []);

    const notifySuccess = useCallback(() => {
        clearNotifs();
        toast.success("Websocket ouvert ✅", {
            position: "bottom-right",
            toastId: WEBSOCKET_CONNECTED_TOAST_ID,
            autoClose: 3000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
        });
    }, [clearNotifs]);

    const notifyError = useCallback(() => {
        toast.dismiss(WEBSOCKET_RECONNECTING_TOAST_ID);
        toast.error("WebSocket fermé ❌", {
            toastId: WEBSOCKET_ERROR_TOAST_ID,
            position: "bottom-right",
            autoClose: false,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
        });
    }, []);

    const notifyReconnecting = useCallback((attemptNumber) => {
        console.log(`🔄 Programmation reconnexion ${reconnectAttemptsRef.current}`);

        toast.info(`Tentative de reconnexion ${attemptNumber}...`, {
            toastId: WEBSOCKET_RECONNECTING_TOAST_ID,
            position: "bottom-right",
            autoClose: 1500,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
        });
    }, []);

    const notifyExecution = useCallback((name, id) => {
        toast.info(`L'exécution du noeud '${name}' est terminée`, {
            toastId: id,
            position: "bottom-right",
            autoClose: 2000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
        });
    }, []);

    const getReconnectDelay = useCallback((attemptNumber) => {
        if (attemptNumber <= 10) {
            return 3000;
        } else {
            return 60000;
        }
    }, []);

    const sendMessage = useCallback((message) => {
        const currentWs = wsRef.current;
        if (currentWs && currentWs.readyState === WebSocket.OPEN) {
            currentWs.send(JSON.stringify(message));
            return true;
        }
        console.warn("⚠️ Impossible d'envoyer le message : WebSocket non connecté");
        return false;
    }, []);




    // 🔥 SOLUTION : Créer connect et scheduleReconnect avec des refs pour briser la dépendance circulaire
    const connectRef = useRef(null);

    const scheduleReconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        reconnectAttemptsRef.current++;
        const delay = getReconnectDelay(reconnectAttemptsRef.current);

        notifyReconnecting(reconnectAttemptsRef.current);

        reconnectTimeoutRef.current = setTimeout(() => {
            reconnectTimeoutRef.current = null;
            // 🔥 Utiliser connectRef au lieu de connect directement
            if (connectRef.current) {
                connectRef.current();
            }
        }, delay);
    }, [getReconnectDelay, notifyReconnecting]);

    // 🔥 Créer une ref pour scheduleReconnect
    const scheduleReconnectRef = useRef(scheduleReconnect);

    useEffect(() => {
        scheduleReconnectRef.current = scheduleReconnect;
    }, [scheduleReconnect]);

    const connect = useCallback(() => {
        if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
            isManualCloseRef.current = true;
            wsRef.current.close();
        }

        const socket = new WebSocket(url);
        wsRef.current = socket;
        isManualCloseRef.current = false;

        socket.onopen = () => {
            // console.log("🔗 WebSocket connecté");

            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
            }

            reconnectAttemptsRef.current = 0;
            notifySuccess();

            // 🔥 Send login with persistent User ID
            let userId = localStorage.getItem("nodal_user_id");
            if (!userId) {
                // Simple UUID generation if crypto.randomUUID not available (older browsers)
                if (typeof crypto !== 'undefined' && crypto.randomUUID) {
                    userId = crypto.randomUUID();
                } else {
                    userId = 'user_' + Math.random().toString(36).substr(2, 9) + Date.now();
                }
                localStorage.setItem("nodal_user_id", userId);
            }

            socket.send(JSON.stringify({
                action: "login",
                identifier: userId
            }));
        };

        // Listen for login success to get config
        const handleLoginResponse = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.action === "login" && msg.status === "success" && msg.config) {
                    if (setServerConfigRef.current) {
                        setServerConfigRef.current(msg.config);
                        console.log("Scaled to server config:", msg.config);
                    }
                }
            } catch (e) { }
        };
        socket.addEventListener('message', handleLoginResponse);

        socket.onclose = (event) => {
            console.log("❌ WebSocket fermé", event.code, event.reason);

            if (!isManualCloseRef.current) {
                notifyError();
                // 🔥 Utiliser scheduleReconnectRef au lieu de scheduleReconnect
                scheduleReconnectRef.current();
            }
        };

        socket.onerror = (err) => {
            console.error("⚠️ WS error", err);
        };

        let messageQueue = [];
        let timeoutId = null;

        const processMessageQueue = () => {
            if (messageQueue.length === 0) return;

            const messages = [...messageQueue];
            messageQueue = [];

            // Batch update state once
            setNodesRef.current((currentNodes) => {
                let updatedNodes = [...currentNodes];
                let hasChanges = false;

                // Optimization: Map node ID to index for O(1) lookup ?? 
                // Overhead of creating map might exceed benefit for small N
                // Just iteration is fine for now < 100 nodes

                messages.forEach(msg => {
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

                                // Side Effect: Notifications (Non-pure, but safe-ish here)
                                if (node.type === 'custom') {
                                    // Throttle notifications to avoid UI lag
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

                            // Check deep equality ?? No, just assume change for variable update
                            updatedNodes[nodeIndex] = { ...node, data: { ...node.data, outputs: newOutputs } };
                            hasChanges = true;
                        }
                    }
                    else if (!msg.action) {
                        // console.log("Message sans action ?", msg);
                    }
                });

                return hasChanges ? updatedNodes : currentNodes;
            });
        };

        socket.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            // console.log("WS reçu:", msg); // Removed for performance in loops

            messageQueue.push(msg);

            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(processMessageQueue, 0);
        };

        socket.addEventListener('close', () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
        });

    }, [url, sendMessage, notifySuccess, notifyError]);

    // 🔥 Mettre à jour connectRef à chaque fois que connect change
    useEffect(() => {
        connectRef.current = connect;
    }, [connect]);

    // ✅ Ce useEffect ne se déclenchera qu'une seule fois au montage
    useEffect(() => {
        connect();

        return () => {
            isManualCloseRef.current = true;

            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
            }

            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
        };
    }, [connect]);

    const isConnected = useCallback(() => {
        return wsRef.current && wsRef.current.readyState === WebSocket.OPEN;
    }, []);

    const disconnect = useCallback(() => {
        isManualCloseRef.current = true;

        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        if (wsRef.current) {
            wsRef.current.close();
        }
    }, []);

    const reconnect = useCallback(() => {
        reconnectAttemptsRef.current = 0;
        connect();
    }, [connect]);

    return {
        wsRef,
        sendMessage,
        isConnected,
        disconnect,
        reconnect
    };
};