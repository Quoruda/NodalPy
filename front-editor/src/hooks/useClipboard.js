import { useCallback, useEffect } from 'react';

export const useClipboard = (nodes, edges, selectedNodes, selectedEdges, setNodes, setEdges, takeSnapshot) => {

    const onCopy = useCallback(() => {
        if (selectedNodes.length === 0) return;
        
        const nodesToCopy = [...selectedNodes];
        const groupIds = selectedNodes.map(n => n.id);
        
        nodes.forEach(n => {
            const isChild = (n.parentId && groupIds.includes(n.parentId)) || 
                            (n.data?.groupBaseId && groupIds.includes(n.data.groupBaseId));
            if (isChild) {
                if (!nodesToCopy.some(copiedNode => copiedNode.id === n.id)) {
                    nodesToCopy.push(n);
                }
            }
        });
        
        const nodeIds = nodesToCopy.map(n => n.id);
        const edgesToCopy = edges.filter(e => nodeIds.includes(e.source) && nodeIds.includes(e.target));
        
        const clipboard = {
            nodes: nodesToCopy,
            edges: edgesToCopy,
        };
        localStorage.setItem('nodalpy_clipboard', JSON.stringify(clipboard));
    }, [selectedNodes, nodes, edges]);

    const onCut = useCallback(() => {
        if (selectedNodes.length === 0) return;
        
        const nodesToCut = [...selectedNodes];
        const groupIds = selectedNodes.map(n => n.id);
        
        nodes.forEach(n => {
            const isChild = (n.parentId && groupIds.includes(n.parentId)) || 
                            (n.data?.groupBaseId && groupIds.includes(n.data.groupBaseId));
            if (isChild) {
                if (!nodesToCut.some(cutNode => cutNode.id === n.id)) {
                    nodesToCut.push(n);
                }
            }
        });
        
        const nodeIds = nodesToCut.map(n => n.id);
        const edgesToCut = edges.filter(e => nodeIds.includes(e.source) && nodeIds.includes(e.target));
        
        const clipboard = {
            nodes: nodesToCut,
            edges: edgesToCut,
        };
        localStorage.setItem('nodalpy_clipboard', JSON.stringify(clipboard));
        
        if (takeSnapshot) takeSnapshot();
        
        setNodes(nds => nds.filter(n => !nodeIds.includes(n.id)));
        const edgeIdsToCut = edgesToCut.map(e => e.id);
        setEdges(eds => eds.filter(e => !edgeIdsToCut.includes(e.id)));
    }, [selectedNodes, nodes, edges, setNodes, setEdges, takeSnapshot]);

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
            
            const mappedNodes = newNodes.map(n => {
                let updatedNode = { ...n };
                if (updatedNode.parentId && idMap[updatedNode.parentId]) {
                    updatedNode.parentId = idMap[updatedNode.parentId];
                }
                if (updatedNode.data?.groupBaseId && idMap[updatedNode.data.groupBaseId]) {
                    updatedNode.data = { ...updatedNode.data, groupBaseId: idMap[updatedNode.data.groupBaseId] };
                }
                return updatedNode;
            });
            
            setNodes(nds => nds.map(n => ({ ...n, selected: false })).concat(mappedNodes));
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
