import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import './PackageManager.css';

const PackageManager = ({ sendMessage }) => {
    const [packages, setPackages] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [newPackage, setNewPackage] = useState('');
    const [loading, setLoading] = useState(false);
    const [actionRunning, setActionRunning] = useState(false);
    const [logs, setLogs] = useState([]);
    const [showLogs, setShowLogs] = useState(false);
    const logEndRef = useRef(null);

    useEffect(() => {
        const handleList = (e) => {
            setLoading(false);
            if (e.detail.status === 'success') {
                setPackages(e.detail.packages || []);
            } else if (e.detail.status === 'error') {
                toast.error(`Failed to list packages: ${e.detail.error}`);
            }
        };

        const handleInstall = (e) => {
            setActionRunning(false);
            if (e.detail.status === 'success') {
                setNewPackage('');
                sendMessage({ action: 'package_manager:list' });
                toast.success(`Installed ${e.detail.package}`);
            } else if (e.detail.status === 'error') {
                toast.error(`Install failed: ${e.detail.error}`);
            }
        };

        const handleUninstall = (e) => {
            setActionRunning(false);
            if (e.detail.status === 'success') {
                sendMessage({ action: 'package_manager:list' });
                toast.success(`Uninstalled ${e.detail.package}`);
            } else if (e.detail.status === 'error') {
                toast.error(`Uninstall failed: ${e.detail.error}`);
            }
        };

        const handleLog = (e) => {
            setLogs((prev) => [...prev, e.detail.line]);
            setShowLogs(true);
        };

        const handleReset = (e) => {
            setActionRunning(false);
            if (e.detail.status === 'success') {
                toast.success("Environment reset successfully!");
                sendMessage({ action: 'package_manager:list' });
            } else if (e.detail.status === 'error') {
                toast.error(`Reset failed: ${e.detail.error}`);
            }
        };

        window.addEventListener('ws_package_manager:list', handleList);
        window.addEventListener('ws_package_manager:install', handleInstall);
        window.addEventListener('ws_package_manager:uninstall', handleUninstall);
        window.addEventListener('ws_package_manager:log', handleLog);
        window.addEventListener('ws_package_manager:reset', handleReset);

        setLoading(true);
        sendMessage({ action: 'package_manager:list' });

        return () => {
            window.removeEventListener('ws_package_manager:list', handleList);
            window.removeEventListener('ws_package_manager:install', handleInstall);
            window.removeEventListener('ws_package_manager:uninstall', handleUninstall);
            window.removeEventListener('ws_package_manager:log', handleLog);
            window.removeEventListener('ws_package_manager:reset', handleReset);
        };
    }, [sendMessage]);

    useEffect(() => {
        if (logEndRef.current) {
            logEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs]);

    const handleInstallClick = () => {
        if (!newPackage.trim() || actionRunning) return;
        setLogs([]);
        setActionRunning(true);
        sendMessage({
            action: 'package_manager:install',
            package: newPackage.trim()
        });
    };

    const handleDeleteClick = (pkgName) => {
        if (actionRunning) return;
        setLogs([]);
        setActionRunning(true);
        sendMessage({
            action: 'package_manager:uninstall',
            package: pkgName
        });
    };

    const handleResetClick = () => {
        if (actionRunning) return;
        if (window.confirm("Are you sure you want to reset the entire Python environment? All installed packages will be deleted.")) {
            setLogs([]);
            setActionRunning(true);
            sendMessage({
                action: 'package_manager:reset'
            });
        }
    };

    const filteredPackages = packages.filter((pkg) =>
        pkg.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="pkg-manager-container">
            <div className="pkg-header">
                <div className="pkg-title">
                    📦 Python Packages
                    <button 
                        className="pkg-btn-reset" 
                        onClick={handleResetClick} 
                        disabled={actionRunning}
                        title="Reset Python Environment"
                        style={{ marginLeft: '10px', fontSize: '12px', padding: '4px 8px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                        Reset Env
                    </button>
                </div>
                <div className="pkg-install-box">
                    <input
                        type="text"
                        className="pkg-input"
                        placeholder="Install package..."
                        value={newPackage}
                        onChange={(e) => setNewPackage(e.target.value)}
                        disabled={actionRunning}
                        onKeyDown={(e) => e.key === 'Enter' && handleInstallClick()}
                    />
                    <button
                        className="pkg-btn-install"
                        onClick={handleInstallClick}
                        disabled={actionRunning || !newPackage.trim()}
                    >
                        {actionRunning ? <span className="pkg-loader"></span> : 'Install'}
                    </button>
                </div>
            </div>

            <div className="pkg-search-bar">
                <input
                    type="text"
                    className="pkg-input"
                    placeholder="Search installed..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            <div className="pkg-list-container">
                {loading ? (
                    <div style={{ textAlign: 'center', opacity: 0.5, fontSize: '0.85rem', padding: '20px 0' }}>
                        Loading packages...
                    </div>
                ) : filteredPackages.length === 0 ? (
                    <div style={{ textAlign: 'center', opacity: 0.5, fontSize: '0.85rem', padding: '20px 0' }}>
                        No packages found
                    </div>
                ) : (
                    filteredPackages.map((pkg) => (
                        <div className="pkg-item" key={pkg.name}>
                            <div className="pkg-info">
                                <span className="pkg-name">{pkg.name}</span>
                                <span className="pkg-version">{pkg.version}</span>
                            </div>
                            <button
                                className="pkg-btn-delete"
                                onClick={() => handleDeleteClick(pkg.name)}
                                disabled={actionRunning}
                            >
                                🗑️
                            </button>
                        </div>
                    ))
                )}
            </div>

            <div className={`pkg-logs-panel ${showLogs ? '' : 'collapsed'}`}>
                <div className="pkg-logs-header">
                    <span>Terminal Logs</span>
                    <button className="pkg-logs-close" onClick={() => setShowLogs(false)}>✕</button>
                </div>
                <div className="pkg-logs-content">
                    {logs.map((log, idx) => (
                        <div key={idx}>{log}</div>
                    ))}
                    <div ref={logEndRef} />
                </div>
            </div>
        </div>
    );
};

export default PackageManager;
