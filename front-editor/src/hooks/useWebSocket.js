import {useCallback, useEffect, useRef} from 'react';
import {toast} from "react-toastify";

// ✅ Hook WebSocket dédié et réutilisable avec reconnexion automatique
export const useWebSocket = (url, setNodes) => {
    const wsRef = useRef(null);
    const reconnectAttemptsRef = useRef(0);
    const reconnectTimeoutRef = useRef(null);
    const isManualCloseRef = useRef(false); // Pour éviter la reconnexion lors de la fermeture manuelle
    const WEBSOCKET_ERROR_TOAST_ID = "websocket-error";
    const WEBSOCKET_RECONNECTING_TOAST_ID = "websocket-reconnecting";
    const WEBSOCKET_CONNECTED_TOAST_ID = "websocket-connected";


    const clearNotifs = () => {
        toast.dismiss(WEBSOCKET_ERROR_TOAST_ID);
        toast.dismiss(WEBSOCKET_RECONNECTING_TOAST_ID);
        toast.dismiss(WEBSOCKET_CONNECTED_TOAST_ID);
    }

    const notifySucces = () => {
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

    // Fonction pour calculer le délai de reconnexion
    const getReconnectDelay = (attemptNumber) => {
        if (attemptNumber <= 10) {
            // 10 premières tentatives : toutes les 3 secondes
            return 3000;
        } else {
            // Après 10 tentatives : toutes les minutes
            return 60000;
        }
    };

    // Fonction pour créer la connexion WebSocket
    const connect = useCallback(() => {
        // Nettoyer la connexion existante
        if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
            isManualCloseRef.current = true;
            wsRef.current.close();
        }

        const socket = new WebSocket(url);
        wsRef.current = socket;
        isManualCloseRef.current = false;

        socket.onopen = () => {
            console.log("🔗 WebSocket connecté");

            // ✅ IMPORTANT: Annuler toute tentative de reconnexion en cours
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
                reconnectTimeoutRef.current = null;
            }

            reconnectAttemptsRef.current = 0; // Reset des tentatives
            notifySucces();
        };

        socket.onclose = (event) => {
            console.log("❌ WebSocket fermé", event.code, event.reason);

            // Ne pas reconnecter si c'est une fermeture manuelle ou si le composant est démonté
            if (!isManualCloseRef.current) {
                notifyError();
                scheduleReconnect();
            }
        };

        socket.onerror = (err) => {
            console.error("⚠️ WS error", err);
        };

        // ✅ Debounce des messages pour éviter trop de re-renders
        let messageQueue = [];
        let timeoutId = null;

        const processMessageQueue = () => {
            if (messageQueue.length === 0) return;

            const messages = [...messageQueue];
            messageQueue = [];

            setNodes((nds) => {
                let updatedNodes = [...nds];

                messages.forEach(msg => {
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
                });

                return updatedNodes;
            });
        };

        socket.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            console.log("WS reçu:", msg);

            messageQueue.push(msg);

            // Debounce : traiter les messages par batch toutes les 16ms (60fps)
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(processMessageQueue, 16);
        };

        // Cleanup function pour les timeouts de messages
        socket.addEventListener('close', () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
        });

    }, [url, setNodes]);

    // Fonction pour programmer la reconnexion
    const scheduleReconnect = useCallback(() => {
        // Annuler toute tentative de reconnexion en cours
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

    // Effet principal pour initialiser la connexion
    useEffect(() => {
        connect();

        return () => {
            // Cleanup lors du démontage
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

    // ✅ Fonction pour envoyer des messages
    const sendMessage = useCallback((message) => {
        const currentWs = wsRef.current;
        if (currentWs && currentWs.readyState === WebSocket.OPEN) {
            currentWs.send(JSON.stringify(message));
            return true;
        }
        console.warn("⚠️ Impossible d'envoyer le message : WebSocket non connecté");
        return false;
    }, []);

    // ✅ Fonction pour vérifier l'état de connexion
    const isConnected = useCallback(() => {
        return wsRef.current && wsRef.current.readyState === WebSocket.OPEN;
    }, []);

    // ✅ Fonction pour fermer manuellement la connexion (sans reconnexion)
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

    // ✅ Fonction pour forcer une reconnexion
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