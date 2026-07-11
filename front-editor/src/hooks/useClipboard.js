import { useCallback, useEffect } from 'react';

export const useClipboard = (nodes, edges, selectedNodes, selectedEdges, setNodes, setEdges, takeSnapshot) => {

    const onCopy = useCallback(() => {
        if (selectedNodes.length === 0) return;
        
        const clipboard = {
            nodes: selectedNodes,
            edges: selectedEdges,
        };
        localStorage.setItem('nodalpy_clipboard', JSON.stringify(clipboard));
    }, [selectedNodes, selectedEdges]);

    const onCut = useCallback(() => {
        if (selectedNodes.length === 0) return;
        onCopy();
        
        if (takeSnapshot) takeSnapshot();
        const nodeIds = selectedNodes.map(n => n.id);
        const edgeIds = selectedEdges.map(e => e.id);
        
        setNodes(nds => nds.filter(n => !nodeIds.includes(n.id)));
        setEdges(eds => eds.filter(e => !edgeIds.includes(e.id)));
    }, [selectedNodes, selectedEdges, onCopy, setNodes, setEdges, takeSnapshot]);

    const onPaste = useCallback(() => {
        const clipboardStr = localStorage.getItem('nodalpy_clipboard');
        if (!clipboardStr) return;
        
        try {
            const clipboard = JSON.parse(clipboardStr);
            if (!clipboard.nodes || clipboard.nodes.length === 0) return;
            
            if (takeSnapshot) takeSnapshot();
            
            const newNodes = [];
            const newEdges = [];
            const idMap = {};
            
            clipboard.nodes.forEach(n => {
                const newId = crypto.randomUUID();
                idMap[n.id] = newId;
                
                const newData = JSON.parse(JSON.stringify(n.data));
                newData.id = newId;
                
                // Clear execution state
                newData.state = 0;
                newData.output = '';
                newData.logs = '';
                newData.error = null;
                
                newNodes.push({
                    ...n,
                    id: newId,
                    data: newData,
                    position: {
                        x: n.position.x + 50,
                        y: n.position.y + 50
                    },
                    selected: true,
                });
            });
            
            clipboard.edges.forEach(e => {
                if (idMap[e.source] && idMap[e.target]) {
                    newEdges.push({
                        ...e,
                        id: `edge-${idMap[e.source]}-${idMap[e.target]}`,
                        source: idMap[e.source],
                        target: idMap[e.target],
                        selected: true,
                    });
                }
            });
            
            setNodes(nds => nds.map(n => ({ ...n, selected: false })).concat(newNodes));
            setEdges(eds => eds.map(e => ({ ...e, selected: false })).concat(newEdges));
            
        } catch (err) {
            console.error("Failed to paste", err);
        }
    }, [setNodes, setEdges, takeSnapshot]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.closest('.cm-editor') || e.target.closest('.nodrag')) {
                return;
            }
            
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'c' || e.key === 'C') {
                    if (window.getSelection().toString() === '') {
                        e.preventDefault();
                        onCopy();
                    }
                } else if (e.key === 'x' || e.key === 'X') {
                    if (window.getSelection().toString() === '') {
                        e.preventDefault();
                        onCut();
                    }
                } else if (e.key === 'v' || e.key === 'V') {
                    e.preventDefault();
                    onPaste();
                }
            }
        };
        
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onCopy, onCut, onPaste]);
    
    return { onCopy, onCut, onPaste };
};
