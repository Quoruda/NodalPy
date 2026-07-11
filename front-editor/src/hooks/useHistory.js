import { useCallback, useEffect, useRef } from 'react';

export const useHistory = (nodes, edges, setNodes, setEdges) => {
    const past = useRef([]);
    const future = useRef([]);
    const isInternalChange = useRef(false);

    const takeSnapshot = useCallback(() => {
        if (isInternalChange.current) return;
        
        past.current.push({
            nodes: JSON.parse(JSON.stringify(nodes)),
            edges: JSON.parse(JSON.stringify(edges))
        });
        
        if (past.current.length > 50) {
            past.current.shift();
        }
        
        future.current = [];
    }, [nodes, edges]);

    const undo = useCallback(() => {
        if (past.current.length === 0) return;
        
        const previousState = past.current.pop();
        future.current.push({
            nodes: JSON.parse(JSON.stringify(nodes)),
            edges: JSON.parse(JSON.stringify(edges))
        });
        
        isInternalChange.current = true;
        setNodes(previousState.nodes);
        setEdges(previousState.edges);
        
        setTimeout(() => {
            isInternalChange.current = false;
        }, 50);
    }, [nodes, edges, setNodes, setEdges]);

    const redo = useCallback(() => {
        if (future.current.length === 0) return;
        
        const nextState = future.current.pop();
        past.current.push({
            nodes: JSON.parse(JSON.stringify(nodes)),
            edges: JSON.parse(JSON.stringify(edges))
        });
        
        isInternalChange.current = true;
        setNodes(nextState.nodes);
        setEdges(nextState.edges);
        
        setTimeout(() => {
            isInternalChange.current = false;
        }, 50);
    }, [nodes, edges, setNodes, setEdges]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.closest('.cm-editor') || e.target.closest('.nodrag')) {
                return;
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    redo();
                } else {
                    undo();
                }
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                e.preventDefault();
                redo();
            }
        };
        
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo]);

    return { takeSnapshot, undo, redo, isInternalChange };
};
