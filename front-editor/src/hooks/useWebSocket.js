import {useCallback, useEffect, useRef} from 'react';
import {toast} from "react-toastify";

// ✅ Hook WebSocket dédié et réutilisable avec reconnexion automatique
export const useWebSocket = (url, setNodes) => {
    const wsRef = useRef(null);
    const reconnectAttemptsRef = useRef(0);
    const reconnectTimeoutRef = useRef(null);
    const isManualCloseRef = useRef(false);

    // ✅ SOLUTION : Utiliser une ref pour setNodes au lieu de la dépendance directe
    const setNodesRef = useRef(setNodes);

    const WEBSOCKET_ERROR_TOAST_ID = "websocket-error";
    const WEBSOCKET_RECONNECTING_TOAST_ID = "websocket-reconnecting";
    const WEBSOCKET_CONNECTED_TOAST_ID = "websocket-connected";

    // ✅ Mettre à jour la ref à chaque render
    useEffect(() => {
        setNodesRef.current = setNodes;
    }, [setNodes]);

    const clearNotifs = () => {
        toast.dismiss(WEBSOCKET_ERROR_TOAST_ID);
        toast.dismiss(WEBSOCKET_RECONNECTING_TOAST_ID);
        toast.dismiss(WEBSOCKET_CONNECTED_TOAST_ID);
    }

    const notifySuccess = () => {
        clearNotifs()
        toast.success("Websocket ouvert ✅", {
            position: "bottom-right",
            toastId: WEBSOCKET_CONNECTED_TOAST_ID,
            autoClose: 3000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
        });
    };

    const notifyError = () => {
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
    };

    const notifyReconnecting = (attemptNumber) => {
        toast.info(`Tentative de reconnexion ${attemptNumber}...`, {
            toastId: WEBSOCKET_RECONNECTING_TOAST_ID,
            position: "bottom-right",
            autoClose: 2000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
        });
    };

    const notifyExecution = (name,id) => {
        toast.info(`L'exécution du noeud '${name}' est terminée`, {
            toastId: id,
            position: "bottom-right",
            autoClose: 2000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
        });
    };

    const getReconnectDelay = (attemptNumber) => {
        if (attemptNumber <= 10) {
            return 3000;
        } else {
            return 60000;
        }
    };

    // ✅ sendMessage n'a plus besoin de dépendances
    const sendMessage = useCallback((message) => {
        const currentWs = wsRef.current;
        if (currentWs && currentWs.readyState === WebSocket.OPEN) {
            currentWs.send(JSON.stringify(message));
            return true;
        }
        console.warn("⚠️ Impossible d'envoyer le message : WebSocket non connecté");
        return false;
    }, []);

    // ✅ readRunMessage utilise maintenant setNodesRef.current au lieu de setNodes
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
                if (msg.output) {
                    newData.output = (newData.output || "") + msg.output;
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
    }, []); // ✅ Plus de dépendances !

    // ✅ connect n'a plus readRunMessage dans ses dépendances
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

            sendMessage({"action":  "get_ouput"})

            reconnectAttemptsRef.current = 0;
            notifySuccess();
        };

        socket.onclose = (event) => {
            console.log("❌ WebSocket fermé", event.code, event.reason);

            if (!isManualCloseRef.current) {
                notifyError();
                scheduleReconnect();
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

            for(let msg of messages){
                if(!msg.action) console.log("Message sans action ?", msg)
                else if(msg.action === "run"){
                    readRunMessage(msg);
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

    }, [url, sendMessage]); // ✅ Plus de dépendance à readRunMessage !

    const scheduleReconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        reconnectAttemptsRef.current++;
        const delay = getReconnectDelay(reconnectAttemptsRef.current);

        console.log(`🔄 Programmation reconnexion ${reconnectAttemptsRef.current} dans ${delay/1000}s`);
        notifyReconnecting(reconnectAttemptsRef.current);

        reconnectTimeoutRef.current = setTimeout(() => {
            reconnectTimeoutRef.current = null;
            connect();
        }, delay);
    }, [connect]);

    // ✅ Ce useEffect ne se déclenchera plus à chaque déplacement de nœud
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