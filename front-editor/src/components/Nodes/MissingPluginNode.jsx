import React, { memo } from 'react';
import './NodeShell.css';

const MissingPluginNode = memo(({ data }) => {
    return (
        <div className="node-shell" style={{ border: '2px solid #ef4444', background: 'rgba(239, 68, 68, 0.1)', width: '250px' }}>
            <div className="node-shell-header" style={{ background: '#ef4444', display: 'flex', alignItems: 'center', height: '36px' }}>
                <span style={{ fontWeight: 'bold', color: '#fff', fontSize: '14px', padding: '0 12px' }}>⚠️ Missing Plugin</span>
            </div>
            <div style={{ padding: '16px 12px', color: '#f87171', fontSize: '13px', textAlign: 'center', lineHeight: '1.4' }}>
                The plugin <strong style={{color: '#fff'}}>{data.missingType}</strong> is not installed on this server.
                <div style={{ fontSize: '11px', opacity: 0.8, marginTop: '8px' }}>
                    Install the plugin to view and interact with this node.
                </div>
            </div>
        </div>
    );
});

MissingPluginNode.displayName = 'MissingPluginNode';
export default MissingPluginNode;
