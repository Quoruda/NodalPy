import React, { memo, useCallback } from 'react';
import { toast } from 'react-toastify';
import { uiRegistry } from '../../front-editor/src/core/uiRegistry';
import { useFlowContext } from '../../front-editor/src/components/FlowContext.jsx';

// Helper: check if a given node type is a group component
const isGroupNode = (type) => {
    const plugin = uiRegistry.slots.nodeTypes.find(n => n.type === type);
    return plugin?.config?.isGroupComponent || false;
};


const PADDING = 40;
const TITLE_HEIGHT = 36;

// Bounding-box helper (accounts for nodeOrigin=[0.5, 0.5] on children)
// With center-origin, position.x/y is the CENTER of the node.
function getChildrenBounds(children) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    children.forEach(child => {
        const w = child.measured?.width || 250;
        const h = child.measured?.height || 150;
        const left   = child.position.x - w / 2;
        const right  = child.position.x + w / 2;
        const top    = child.position.y - h / 2;
        const bottom = child.position.y + h / 2;
        if (left   < minX) minX = left;
        if (right  > maxX) maxX = right;
        if (top    < minY) minY = top;
        if (bottom > maxY) maxY = bottom;
    });
    return { minX, minY, maxX, maxY };
}


const GroupNode = memo(({ id, data, selected }) => {
    const { updateNode } = useFlowContext();

    const onTitleChange = useCallback((e) => {
        updateNode(id, { title: e.target.value });
    }, [id, updateNode]);

    return (
        <div style={{
            width: '100%',
            height: '100%',
            background: 'rgba(255, 255, 255, 0.04)',
            border: `1.5px solid ${selected ? '#a78bfa' : 'rgba(255, 255, 255, 0.12)'}`,
            borderRadius: '8px',
            position: 'relative',
            transition: 'border-color 0.2s',
            boxShadow: selected ? '0 0 0 1px #a78bfa' : 'none'
        }}>
            <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0,
                height: `${TITLE_HEIGHT}px`,
                padding: '0 12px',
                background: 'rgba(0,0,0,0.35)',
                borderTopLeftRadius: '8px',
                borderTopRightRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
            }}>
                <span style={{ opacity: 0.4, fontSize: '10px' }}>▪</span>
                <input
                    className="nodrag"
                    value={data.title || 'Group'}
                    onChange={onTitleChange}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'rgba(255,255,255,0.85)',
                        fontWeight: '600',
                        fontSize: '13px',
                        outline: 'none',
                        width: '100%',
                        letterSpacing: '0.02em',
                    }}
                />
            </div>
        </div>
    );
});

GroupNode.displayName = 'GroupNode';
export default GroupNode;


uiRegistry.registerNodeType({
    type: 'groupNode',
    component: GroupNode,
    config: {
        type: 'groupNode',
        label: 'Group / Backdrop',
        category: 'Utilities',
        color: '#6D6D7A',
        inputs: 0,
        outputs: 0,
        autoTrigger: false,
        isGroupComponent: true,
        hideFromSidebar: true,
    },
    defaultData: {
        title: 'New Group',
    },
});

// Keyboard Shortcuts (Ctrl+G / Ctrl+Shift+G)
uiRegistry.registerShortcut({
    key: 'g',
    ctrl: true,
    shift: false,
    description: 'Group selected nodes into a backdrop (Ctrl+G)',
    action: ({ nodes, selectedNodes, setNodes, takeSnapshot }) => {
        if (!selectedNodes || selectedNodes.length === 0) return;

        const groupPlugin = uiRegistry.slots.nodeTypes.find(n => n.config?.isGroupComponent);
        if (!groupPlugin) {
            toast.warn('No group plugin installed.');
            return;
        }

        // We only group loose nodes (no groupBaseId) that are not groups themselves
        const nodesToGroup = selectedNodes.filter(n => !isGroupNode(n.type) && !n.data?.groupBaseId);
        if (nodesToGroup.length === 0) return;

        const bounds = getChildrenBounds(nodesToGroup);

        const groupX = bounds.minX - PADDING;
        const groupY = bounds.minY - PADDING - TITLE_HEIGHT;
        const groupWidth = (bounds.maxX - bounds.minX) + PADDING * 2;
        const groupHeight = (bounds.maxY - bounds.minY) + PADDING * 2 + TITLE_HEIGHT;
        const groupId = crypto.randomUUID();

        const newGroup = {
            id: groupId,
            type: groupPlugin.type,
            position: { x: groupX, y: groupY },
            origin: [0, 0], // Top-left origin for easy sizing
            style: { width: groupWidth, height: groupHeight, zIndex: -1 },
            data: { title: 'New Group' },
        };

        const updatedNodes = nodes.map(n => {
            if (nodesToGroup.some(sn => sn.id === n.id)) {
                return {
                    ...n,
                    // NO parentId used! We use an independent property to avoid d3-drag glitches
                    data: { ...n.data, groupBaseId: groupId },
                };
            }
            return n;
        });

        takeSnapshot();
        setNodes([newGroup, ...updatedNodes]);
    },
});

uiRegistry.registerShortcut({
    key: 'g',
    ctrl: true,
    shift: true,
    description: 'Ungroup selected backdrop (Ctrl+Shift+G)',
    action: ({ selectedNodes, setNodes, takeSnapshot }) => {
        if (!selectedNodes || selectedNodes.length === 0) return;

        const groupsToRemove = selectedNodes.filter(n => isGroupNode(n.type));
        if (groupsToRemove.length === 0) return;

        const groupIds = groupsToRemove.map(g => g.id);

        takeSnapshot();
        setNodes(nds => {
            const withoutGroups = nds.filter(n => !groupIds.includes(n.id));
            return withoutGroups.map(n => {
                if (n.data?.groupBaseId && groupIds.includes(n.data.groupBaseId)) {
                    const newData = { ...n.data };
                    delete newData.groupBaseId;
                    return { ...n, data: newData };
                }
                return n;
            });
        });
    },
});

// Live Auto-resize and Live Dragging via onNodesChange
uiRegistry.registerCallback('onNodesChange', (changes, ctx) => {
    const { nodes: oldNodes, setNodes } = ctx;
    
    // We only care if something moved
    const posChanges = changes.filter(c => c.type === 'position' && c.position);
    if (posChanges.length === 0) return;

    setNodes(nds => {
        let changed = false;
        let nextNds = [...nds];

        // 1. If a Group node moved, we must manually move all its children
        posChanges.forEach(c => {
            const oldNode = oldNodes.find(n => n.id === c.id);
            if (!oldNode || !isGroupNode(oldNode.type)) return;
            if (!c.position) return;
            
            const dx = c.position.x - oldNode.position.x;
            const dy = c.position.y - oldNode.position.y;
            
            if (dx === 0 && dy === 0) return;

            nextNds = nextNds.map(n => {
                if (n.data?.groupBaseId === c.id) {
                    changed = true;
                    return {
                        ...n,
                        position: {
                            x: n.position.x + dx,
                            y: n.position.y + dy
                        }
                    };
                }
                return n;
            });
        });

        // 2. If a child node moved, we must automatically resize its Group
        const affectedGroups = new Set();
        posChanges.forEach(c => {
            const node = nextNds.find(n => n.id === c.id);
            // If the node that moved is a child, mark its group for resize
            if (node && node.data?.groupBaseId) {
                affectedGroups.add(node.data.groupBaseId);
            }
        });

        affectedGroups.forEach(groupId => {
            const groupNode = nextNds.find(n => n.id === groupId);
            if (!groupNode) return;

            const children = nextNds.filter(n => n.data?.groupBaseId === groupId);
            if (children.length === 0) return;

            const bounds = getChildrenBounds(children);
            
            const newX = bounds.minX - PADDING;
            const newY = bounds.minY - PADDING - TITLE_HEIGHT;
            const newWidth = (bounds.maxX - bounds.minX) + PADDING * 2;
            const newHeight = (bounds.maxY - bounds.minY) + PADDING * 2 + TITLE_HEIGHT;

            if (Math.abs(groupNode.position.x - newX) > 0.5 ||
                Math.abs(groupNode.position.y - newY) > 0.5 ||
                Math.abs((groupNode.style?.width || 0) - newWidth) > 0.5 ||
                Math.abs((groupNode.style?.height || 0) - newHeight) > 0.5) {
                
                changed = true;
                nextNds = nextNds.map(n => {
                    if (n.id === groupId) {
                        return {
                            ...n,
                            position: { x: newX, y: newY },
                            width: newWidth,
                            height: newHeight,
                            style: { ...n.style, width: newWidth, height: newHeight }
                        };
                    }
                    return n;
                });
            }
        });

        return changed ? nextNds : nds;
    });
});
