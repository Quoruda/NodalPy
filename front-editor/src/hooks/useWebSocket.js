import { useEffect, useRef } from 'react';
import {toast} from "react-toastify";


// ✅ Hook WebSocket dédié et réutilisable
export const useWebSocket = (url, setNodes) => {
    const wsRef = useRef(null);

    const notifySucces = () => {
        toast.success("Websocket ouvert ✅", {
          position: "top-right",
          autoClose: 3000, // disparaît après 3s
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
      };

    const notifyError = () => {
        toast.error("WebSocket fermé ❌", {
          position: "top-right",
          autoClose: 3000, // disparaît après 3s
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
      };

    useEffect(() => {
        const socket = new WebSocket(url);
        wsRef.current = socket;

        socket.onopen = () => notifySucces();
        socket.onclose = () => notifyError();
        socket.onerror = (err) => console.error("⚠️ WS error", err);

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

        return () => {
            if (timeoutId) clearTimeout(timeoutId);
            socket.close();
            wsRef.current = null;
        };
    }, [url, setNodes]);

    // ✅ Fonction pour envoyer des messages
    const sendMessage = (message) => {
        const currentWs = wsRef.current;
        if (currentWs && currentWs.readyState === WebSocket.OPEN) {
            currentWs.send(JSON.stringify(message));
            return true;
        }
        return false;
    };

    // ✅ Fonction pour vérifier l'état de connexion
    const isConnected = () => {
        return wsRef.current && wsRef.current.readyState === WebSocket.OPEN;
    };

    return {
        wsRef,
        sendMessage,
        isConnected
    };
};