import React, { memo, useCallback } from 'react';
import { Handle, Position, useStore, useNodes } from '@xyflow/react';
import { useFlowContext } from '../../front-editor/src/components/FlowContext.jsx';
import { uiRegistry } from '../../front-editor/src/core/uiRegistry';
import './ShadowNode.css';

const isValidMaster = (node) => {
    return node.type !== 'shadowNode' && node.type !== 'groupNode' && node.type !== 'missingPlugin';
};

const ShadowNode = memo(({ id, data, selected }) => {
    const { updateNode, sendMessage, addNodeToQueue } = useFlowContext();


    // Use uiRegistry to check if a node explicitly supports being shadowed
    const isShadowable = useCallback((type) => {
        const config = uiRegistry.slots.nodeTypes.find(t => t.type === type)?.config;
        return config?.supportsShadowing === true;
    }, []);

    // Dynamically retrieve master node from the store with a Sanity Check
    const masterNode = useStore(state => {
        if (!data.masterId) return null;
        const node = state.nodeLookup.get(data.masterId);
        // Sanity check: Ensure it really has code data, even if it claims it supports shadowing
        if (node && node.data && typeof node.data.code === 'string') {
            return node;
        }
        return null;
    });

    const allNodes = useNodes();
    const validMasters = React.useMemo(() => {
        return allNodes.filter(n => isValidMaster(n) && n.id !== id);
    }, [allNodes, id]);

    const onMasterChange = useCallback((e) => {
        const newMasterId = e.target.value;
        const newMaster = allNodes.find(n => n.id === newMasterId);
        const updates = { masterId: newMasterId };

        if (newMaster) {
            const masterConfig = uiRegistry.slots.nodeTypes.find(t => t.type === newMaster.type)?.config;
            if (masterConfig && masterConfig.autoTrigger !== undefined) {
                updates.autoTrigger = masterConfig.autoTrigger;
            }
            if (newMaster.data?.outputs) {
                updates.outputs = newMaster.data.outputs.map(o => ({ id: o.id, name: o.name }));
            }
            if (newMaster.data?.inputs) {
                updates.inputs = newMaster.data.inputs.map(i => ({ id: i.id, name: i.name }));
            }
        }
        
        updateNode(id, updates);
    }, [id, updateNode, allNodes]);

    // Keep inputs, outputs, and autoTrigger synced if master node's structure changes
    React.useEffect(() => {
        if (masterNode) {
            const currentOutputs = data.outputs || [];
            const masterOutputs = masterNode.data?.outputs || [];
            const currentInputs = data.inputs || [];
            const masterInputs = masterNode.data?.inputs || [];
            
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
    }, [masterNode?.data?.outputs, masterNode?.data?.inputs, data.outputs, data.inputs, id, updateNode]);

    const runMasterCode = useCallback(() => {
        if (!masterNode) return;
        
        // Use addNodeToQueue to properly resolve edge dependencies (buildVariables)
        addNodeToQueue({
            id: id,
            code: masterNode.data?.code || '',
            inputs: data.inputs || [],
            outputs: data.outputs || []
        });
    }, [masterNode, id, data.inputs, data.outputs, addNodeToQueue]);

    const stateClasses = ['idle', 'running', 'success', 'error'];
    const stateClass = stateClasses[data.state || 0];

    return (
        <div className={`shadow-node ${selected ? 'selected' : ''} state-${stateClass}`}>
            <div className="shadow-chain-links">
                <svg className="shadow-chain-svg" width="48" height="35" viewBox="0 0 72 52">
                    <defs>
                        <linearGradient id="linkGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#dfe4e8"/>
                            <stop offset="50%" stopColor="#8f9ba5"/>
                            <stop offset="100%" stopColor="#5c6670"/>
                        </linearGradient>
                        <linearGradient id="linkGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#c3cad1"/>
                            <stop offset="50%" stopColor="#727e88"/>
                            <stop offset="100%" stopColor="#454e56"/>
                        </linearGradient>
                        <mask id="hideTopA">
                            <rect x="0" y="0" width="72" height="52" fill="white"/>
                            <rect x="23" y="6" width="26" height="15" fill="black"/>
                        </mask>
                        <mask id="hideBottomB">
                            <rect x="0" y="0" width="72" height="52" fill="white"/>
                            <rect x="23" y="31" width="26" height="15" fill="black"/>
                        </mask>
                    </defs>
                    <ellipse cx="26" cy="26" rx="20" ry="14" fill="none" stroke="url(#linkGrad2)" strokeWidth="8" mask="url(#hideTopA)"/>
                    <ellipse cx="46" cy="26" rx="20" ry="14" fill="none" stroke="url(#linkGrad1)" strokeWidth="8" mask="url(#hideBottomB)"/>
                </svg>
            </div>
            
            <div className="shadow-header">
                <input 
                    type="text" 
                    className="title-input nodrag" 
                    value={data.title || 'Link Node'} 
                    onChange={(e) => updateNode(id, { title: e.target.value })}
                />
            </div>

            <div className="shadow-body">
                <div className="link-badge nodrag">
                    <span>🔗 Linked to:</span>
                    <select 
                        className="shadow-select"
                        value={data.masterId || ''}
                        onChange={onMasterChange}
                    >
                        <option value="" disabled>Select Target</option>
                        {validMasters.filter(m => isShadowable(m.type)).map(m => (
                            <option key={m.id} value={m.id}>
                                {m.data?.title || m.id.slice(0,6)} ({m.type})
                            </option>
                        ))}
                    </select>
                </div>

                {masterNode ? (
                    <div className="shadow-content">
                        <div className="shadow-ports inputs">
                            {masterNode.data?.inputs?.map((input) => (
                                <div key={input.id} className="shadow-port-row">
                                    <Handle
                                        type="target"
                                        position={Position.Left}
                                        id={input.id}
                                        className="shadow-handle"
                                        isConnectable={true}
                                    />
                                    <span className="shadow-port-label">{input.name}</span>
                                </div>
                            ))}
                        </div>

                        {!data.autoTrigger && (
                            <button className="shadow-play-btn nodrag" onClick={runMasterCode}>
                                ▶
                            </button>
                        )}

                        <div className="shadow-ports outputs">
                            {masterNode.data?.outputs?.map((output) => (
                                <div key={output.id} className="shadow-port-row">
                                    <span className="shadow-port-label">{output.name}</span>
                                    <Handle
                                        type="source"
                                        position={Position.Right}
                                        id={output.id}
                                        className="shadow-handle"
                                        isConnectable={true}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="shadow-empty">
                        No Master Selected
                    </div>
                )}
            </div>
            
            {/* Visual Indicator of state */}
            {data.state === 3 && <div className="shadow-error" title={data.error}>!</div>}
        </div>
    );
});

ShadowNode.displayName = 'ShadowNode';
export default ShadowNode;
