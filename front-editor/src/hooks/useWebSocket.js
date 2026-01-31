import { useCallback, useEffect, useRef } from 'react';
import { toast } from "react-toastify";

// ✅ Hook WebSocket dédié et réutilisable avec reconnexion automatique
export const useWebSocket = (url, setNodes) => {
    const wsRef = useRef(null);
    const reconnectAttemptsRef = useRef(0);
    const reconnectTimeoutRef = useRef(null);
    const isManualCloseRef = useRef(false);
    const setNodesRef = useRef(setNodes);

    const WEBSOCKET_ERROR_TOAST_ID = "websocket-error";
    const WEBSOCKET_RECONNECTING_TOAST_ID = "websocket-reconnecting";
    const WEBSOCKET_CONNECTED_TOAST_ID = "websocket-connected";

    useEffect(() => {
        setNodesRef.current = setNodes;
    }, [setNodes]);

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

    const readRunMessage = useCallback((msg) => {
        setNodesRef.current((nds) => {
            let updatedNodes = [...nds];

            const nodeIndex = updatedNodes.findIndex(n => n.id === msg.node);
            if (nodeIndex !== -1) {
                const node = updatedNodes[nodeIndex];
                let newData = { ...node.data };

                if (msg.status === "running") {
                    newData.state = 1;
                }
                if (msg.status === "finished") {
                    newData.state = 2;
                    notifyExecution(node.data.title, node.id);
                }

                updatedNodes[nodeIndex] = {
                    ...node,
                    data: newData
                };
            }
            return updatedNodes;
        });
    }, [notifyExecution]);

    const readVariableMessage = useCallback((msg) => {
        setNodesRef.current((nds) => {
            return nds.map((node) => {
                if (node.id === msg.node) {
                    const newOutputs = node.data.outputs.map((output) => {
                        if (output.name === msg.name) {
                            return {
                                ...output,
                                value: msg.value,
                                type: msg.type
                            };
                        }
                        return output;
                    });

                    return {
                        ...node,
                        data: {
                            ...node.data,
                            outputs: newOutputs
                        }
                    };
                }
                return node;
            });
        });
    }, []);

    // 🔥 Créer une ref pour readVariableMessage
    const readVariableMessageRef = useRef(readVariableMessage);

    useEffect(() => {
        readVariableMessageRef.current = readVariableMessage;
    }, [readVariableMessage]);


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
            console.log("🔗 WebSocket connecté");

            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
            }

            reconnectAttemptsRef.current = 0;
            notifySuccess();
        };

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

            for (let msg of messages) {
                if (!msg.action) console.log("Message sans action ?", msg);
                else if (msg.action === "run_code") {
                    readRunMessageRef.current(msg);
                }
                else if (msg.action === "get_variable") {
                    readVariableMessageRef.current(msg);
                }
                else {
                    console.log("Message WS inconnu :", msg);
                }
            }
        };

        socket.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            console.log("WS reçu:", msg);

            messageQueue.push(msg);

            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(processMessageQueue, 16);
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