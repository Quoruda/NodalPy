import React, { createContext, useContext } from 'react';

// ✅ Créer le contexte pour partager les données du flow
const FlowContext = createContext({
    edges: [],
    nodes: [],
    setNodes: () => {},
    setEdges: () => {},
    //
    wsRef: { current: null },
    // Vous pouvez ajouter d'autres données partagées ici
});

// ✅ Hook personnalisé pour utiliser le contexte facilement
// eslint-disable-next-line react-refresh/only-export-components
export const useFlowContext = () => {
    const context = useContext(FlowContext);
    if (!context) {
        throw new Error('useFlowContext must be used within a FlowProvider');
    }
    return context;
};

// ✅ Provider pour envelopper ReactFlow
export const FlowProvider = ({ children, edges, nodes, setNodes, setEdges, wsRef }) => {
    return (
        <FlowContext.Provider value={{ nodes, edges, setNodes, setEdges, wsRef }}>
            {children}
        </FlowContext.Provider>
    );
};