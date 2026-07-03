import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from "react-toastify";

// Dedicated and reusable WebSocket hook with auto-reconnection
export const useWebSocket = (url, setNodes, setServerConfig) => {
    const wsRef = useRef(null);
    const reconnectAttemptsRef = useRef(0);
    const reconnectTimeoutRef = useRef(null);
    const isManualCloseRef = useRef(false);
    const setNodesRef = useRef(setNodes);
    const setServerConfigRef = useRef(setServerConfig);
    const connectRef = useRef(null);
    const scheduleReconnectRef = useRef(null);

    const WEBSOCKET_ERROR_TOAST_ID = "websocket-error";
    const WEBSOCKET_RECONNECTING_TOAST_ID = "websocket-reconnecting";
    const WEBSOCKET_CONNECTED_TOAST_ID = "websocket-connected";

    // Throttle map for notifications
    const notificationThrottleMap = useRef(new Map());

    // State for connection status
    const [isConnected, setIsConnected] = useState(false);

    // Queue for messages sent while offline
    const pendingMessagesRef = useRef([]);

    useEffect(() => {
        setNodesRef.current = setNodes;
        setServerConfigRef.current = setServerConfig;
    }, [setNodes, setServerConfig]);

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
        
        // WebSocket not connected: queue the message with deduplication
        let updatedQueue = [...pendingMessagesRef.current];
        if (message.action === "run_node") {
            updatedQueue = updatedQueue.filter(msg => !(msg.action === "run_node" && msg.node === message.node));
        } else if (message.action === "get_variable") {
            updatedQueue = updatedQueue.filter(msg => !(msg.action === "get_variable" && msg.node === message.node && msg.name === message.name));
        }
        updatedQueue.push(message);
        pendingMessagesRef.current = updatedQueue;
        console.warn(`⚠️ WebSocket not connected. Message queued (${message.action} for node ${message.node})`);
        return false;
    }, []);

    const notifyReconnecting = useCallback((attemptNumber) => {
        console.log(`🔄 Reconnection scheduled: attempt ${reconnectAttemptsRef.current}`);
    }, []);

    const notifyExecution = useCallback((name, id) => {
        toast.info(`Node '${name}' execution completed`, {
            toastId: id,
            position: "bottom-right",
            autoClose: 2000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
        });
    }, []);

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
            if (connectRef.current) {
                connectRef.current();
            }
        }, delay);
    }, [getReconnectDelay, notifyReconnecting]);

    // Keep scheduleReconnectRef updated
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
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
            }

            reconnectAttemptsRef.current = 0;
            setIsConnected(true);

            // Reset any node stuck in "Running" (state 1) back to "Error" (interrupted)
            setNodesRef.current((currentNodes) =>
                currentNodes.map(node =>
                    node.data?.state === 1
                        ? { 
                            ...node, 
                            data: { 
                                ...node.data, 
                                state: 3, 
                                error: "Interrupted by connection drop" 
                            } 
                          }
                        : node
                )
            );

            // Send login with persistent User ID
            let userId = localStorage.getItem("nodal_user_id");
            if (!userId) {
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

            // Flush pending messages
            const pending = pendingMessagesRef.current;
            pendingMessagesRef.current = [];
            if (pending.length > 0) {
                console.log(`🚀 Connection established: sending ${pending.length} pending messages.`);
                pending.forEach(msg => {
                    socket.send(JSON.stringify(msg));
                });
            }
        };

        socket.onclose = (event) => {
            console.log("❌ WebSocket closed", event.code, event.reason);
            setIsConnected(false);

            if (!isManualCloseRef.current) {
                scheduleReconnectRef.current();
            }
        };

        socket.onerror = (err) => {
            console.error("⚠️ WS error", err);
            setIsConnected(false);
        };

        let messageQueue = [];
        let timeoutId = null;

        const processMessageQueue = () => {
            if (messageQueue.length === 0) return;

            const messages = [...messageQueue];
            messageQueue = [];

            // Process login config updates outside setNodes to avoid nested state update warnings
            messages.forEach(msg => {
                if (msg.action === "login" && msg.status === "success" && msg.config) {
                    setServerConfigRef.current(msg.config);
                }
            });

            // Filter messages for node updates
            const nodeMessages = messages.filter(msg => msg.action === "run_code" || msg.action === "get_variable");
            if (nodeMessages.length === 0) return;

            // Batch update state once
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
                        }
                    }
                });

                return hasChanges ? updatedNodes : currentNodes;
            });
        };

        socket.onmessage = (event) => {
            const msg = JSON.parse(event.data);
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

    }, [url, sendMessage, notifyExecution]);

    // Create connect and scheduleReconnect with refs to break the circular dependency
    useEffect(() => {
        connectRef.current = connect;
    }, [connect]);

    // This useEffect will only run once on mount
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