import React, { useState, useEffect } from 'react';
import { uiRegistry } from '../../front-editor/src/core/uiRegistry';

const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const StorageMonitor = ({ sendMessage }) => {
    const [info, setInfo] = useState(null);

    useEffect(() => {
        const handleResponse = (e) => {
            const data = e.detail;
            if (data.action === 'get_storage_info' && data.status === 'success') {
                setInfo(data);
            }
        };
        window.addEventListener('ws_get_storage_info', handleResponse);
        sendMessage({ action: 'get_storage_info' });
        
        return () => {
            window.removeEventListener('ws_get_storage_info', handleResponse);
        };
    }, [sendMessage]);

    const refresh = () => {
        sendMessage({ action: 'get_storage_info' });
    };

    return (
        <div style={{ padding: '12px', color: '#dfe6e9', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button 
                onClick={refresh} 
                style={{ 
                    width: '100%', 
                    padding: '8px', 
                    background: 'rgba(108, 92, 231, 0.2)', 
                    border: '1px solid rgba(108, 92, 231, 0.4)', 
                    color: '#fff', 
                    borderRadius: '4px', 
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                    e.target.style.background = 'rgba(108, 92, 231, 0.3)';
                    e.target.style.borderColor = 'rgba(108, 92, 231, 0.6)';
                }}
                onMouseLeave={(e) => {
                    e.target.style.background = 'rgba(108, 92, 231, 0.2)';
                    e.target.style.borderColor = 'rgba(108, 92, 231, 0.4)';
                }}
            >
                🔄 Refresh Stats
            </button>
            {info ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ 
                        background: 'rgba(255, 255, 255, 0.03)', 
                        border: '1px solid rgba(255, 255, 255, 0.05)', 
                        padding: '12px', 
                        borderRadius: '6px' 
                    }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#6c5ce7', marginBottom: '8px' }}>📂 User Files</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', opacity: 0.8, marginBottom: '4px' }}>
                            <span>Disk Usage:</span>
                            <span style={{ fontWeight: '500' }}>{formatSize(info.files_size)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', opacity: 0.8 }}>
                            <span>Total Files:</span>
                            <span style={{ fontWeight: '500' }}>{info.files_count}</span>
                        </div>
                    </div>
                    <div style={{ 
                        background: 'rgba(255, 255, 255, 0.03)', 
                        border: '1px solid rgba(255, 255, 255, 0.05)', 
                        padding: '12px', 
                        borderRadius: '6px' 
                    }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#6c5ce7', marginBottom: '8px' }}>🧠 Project Graphs</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', opacity: 0.8, marginBottom: '4px' }}>
                            <span>Disk Usage:</span>
                            <span style={{ fontWeight: '500' }}>{formatSize(info.projects_size)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', opacity: 0.8 }}>
                            <span>Total Files:</span>
                            <span style={{ fontWeight: '500' }}>{info.projects_count}</span>
                        </div>
                    </div>
                    <div style={{ 
                        background: 'rgba(255, 255, 255, 0.03)', 
                        border: '1px solid rgba(255, 255, 255, 0.05)', 
                        padding: '12px', 
                        borderRadius: '6px' 
                    }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#6c5ce7', marginBottom: '8px' }}>⚡ Cache (States)</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', opacity: 0.8, marginBottom: '4px' }}>
                            <span>Disk Usage:</span>
                            <span style={{ fontWeight: '500' }}>{formatSize(info.states_size)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', opacity: 0.8 }}>
                            <span>Cached Nodes:</span>
                            <span style={{ fontWeight: '500' }}>{info.states_count}</span>
                        </div>
                    </div>
                </div>
            ) : (
                <div style={{ fontSize: '0.8rem', opacity: 0.6, textAlign: 'center', padding: '20px 0' }}>Loading storage statistics...</div>
            )}
        </div>
    );
};

uiRegistry.registerSidebarTab({
    id: 'storage',
    label: '💾 Storage',
    component: StorageMonitor
});

export default StorageMonitor;
