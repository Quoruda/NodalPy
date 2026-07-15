import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from "react-toastify";
import { processSystemMessage, processNodeMessages } from './wsMessageProcessors';

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
    const frontVersionRef = useRef(null);

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
            const userId = "default_user";

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

            if (event.code === 1008) {
                console.log("🛑 Connection closed by server due to conflict (another tab opened).");
                isManualCloseRef.current = true;
                toast.error("Session disconnected. You have NodalPy open in another tab.", {
                    toastId: "ws_conflict",
                    autoClose: false,
                    closeOnClick: false,
                    draggable: false
                });
                return;
            }

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

            messages.forEach(msg => {
                window.dispatchEvent(new CustomEvent(`ws_${msg.action}`, { detail: msg }));
                processSystemMessage(msg, setServerConfigRef, frontVersionRef);
            });

            // Filter messages for node updates
            const nodeMessages = messages.filter(msg => msg.action === "run_code" || msg.action === "get_variable");
            if (nodeMessages.length > 0) {
                processNodeMessages(nodeMessages, setNodesRef, notifyExecution, notificationThrottleMap);
            }
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