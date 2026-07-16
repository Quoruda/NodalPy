import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import NodeShell, { NodeShellHeader, useNodeShell } from '../../front-editor/src/components/Nodes/NodeShell.jsx';
import { useShadowNode } from './useShadowNode.js';
import './ShadowNode.css';

const ShadowNode = memo(({ id, data, selected }) => {
    const { stopPropagation } = useNodeShell(id);
    
    const {
        masterNode,
        validMasters,
        isShadowable,
        handleTitleChange,
        onMasterChange,
        runMasterCode
    } = useShadowNode(id, data);

    return (
        <NodeShell 
            id={id} 
            selected={selected} 
            nodeClass={`shadow-node ${masterNode?.state === 1 ? 'master-running' : ''}`}
        >
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

            <NodeShellHeader 
                nodeClass="shadow" 
                title={data.title || "Link"} 
                onTitleChange={handleTitleChange}
                onTitleKeyDown={stopPropagation}
            />

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
                                {m.title} ({m.type})
                            </option>
                        ))}
                    </select>
                </div>

                {masterNode ? (
                    <div className="shadow-content">
                        <div className="shadow-ports inputs">
                            {masterNode.inputs?.map((input) => (
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
                            {masterNode.outputs?.map((output) => (
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
        </NodeShell>
    );
});

ShadowNode.displayName = 'ShadowNode';
export default ShadowNode;
