import { useCallback, useEffect, useMemo } from 'react';
import { useStore } from '@xyflow/react';
import { useFlowContext } from '../../front-editor/src/components/FlowContext.jsx';
import { uiRegistry } from '../../front-editor/src/core/uiRegistry';

const isValidMaster = (node) => {
    return node.type !== 'shadowNode' && node.type !== 'groupNode' && node.type !== 'missingPlugin';
};

export const useShadowNode = (id, data) => {
    const { updateNode, addNodeToQueue } = useFlowContext();

    const isShadowable = useCallback((type) => {
        const config = uiRegistry.slots.nodeTypes.find(t => t.type === type)?.config;
        return config?.supportsShadowing === true;
    }, []);

    const validMasters = useStore(state => {
        return state.nodes
            .filter(n => isValidMaster(n) && n.id !== id)
            .map(n => ({ 
                id: n.id, 
                title: n.data?.title || n.id.slice(0, 6), 
                type: n.type 
            }));
    }, (oldVal, newVal) => JSON.stringify(oldVal) === JSON.stringify(newVal));

    const masterNode = useStore(state => {
        if (!data.masterId) return null;
        const node = state.nodeLookup.get(data.masterId);
        if (node && node.data && typeof node.data.code === 'string') {
            return {
                id: node.id,
                type: node.type,
                state: node.data.state,
                inputs: node.data.inputs,
                outputs: node.data.outputs,
                code: node.data.code
            };
        }
        return null;
    }, (oldVal, newVal) => JSON.stringify(oldVal) === JSON.stringify(newVal));

    const handleTitleChange = useCallback((e) => {
        updateNode(id, { title: e.target.value });
    }, [id, updateNode]);

    const onMasterChange = useCallback((e) => {
        const newMasterId = e.target.value;
        const updates = { masterId: newMasterId };
        updateNode(id, updates);
    }, [id, updateNode]);

    useEffect(() => {
        if (masterNode) {
            const currentOutputs = data.outputs || [];
            const masterOutputs = masterNode.outputs || [];
            const currentInputs = data.inputs || [];
            const masterInputs = masterNode.inputs || [];
            
            const masterConfig = uiRegistry.slots.nodeTypes.find(t => t.type === masterNode.type)?.config;
            const masterAutoTrigger = masterConfig?.autoTrigger;

            let needsUpdate = false;
            let updates = {};
            
            if (masterAutoTrigger !== undefined && data.autoTrigger !== masterAutoTrigger) {
                needsUpdate = true;
                updates.autoTrigger = masterAutoTrigger;
            }
            
            if (currentOutputs.length !== masterOutputs.length || currentOutputs.some((o, i) => o.id !== masterOutputs[i].id || o.name !== masterOutputs[i].name)) {
                needsUpdate = true;
                updates.outputs = masterOutputs.map(o => ({ id: o.id, name: o.name }));
            }
            if (currentInputs.length !== masterInputs.length || currentInputs.some((inpt, i) => inpt.id !== masterInputs[i].id || inpt.name !== masterInputs[i].name)) {
                needsUpdate = true;
                updates.inputs = masterInputs.map(inpt => ({ id: inpt.id, name: inpt.name }));
            }
            
            if (needsUpdate) {
                updateNode(id, updates);
            }
        }
    }, [masterNode?.outputs, masterNode?.inputs, data.outputs, data.inputs, id, updateNode, masterNode?.type, data.autoTrigger]);

    const runMasterCode = useCallback(() => {
        if (!masterNode) return;
        
        addNodeToQueue({
            id: id,
            code: masterNode.code || '',
            inputs: data.inputs || [],
            outputs: data.outputs || []
        });
    }, [masterNode, id, data.inputs, data.outputs, addNodeToQueue]);

    return {
        masterNode,
        validMasters,
        isShadowable,
        handleTitleChange,
        onMasterChange,
        runMasterCode
    };
};
