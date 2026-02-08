import React, { useState, useEffect, useCallback } from 'react';
import { Icon } from 'fontnotawesome';
import 'fontnotawesome/css/all.css';
import { fetchStatus, fetchAlerts } from './services/agentApi.js';
import Dashboard from './components/Dashboard.jsx';
import LogViewer from './components/LogViewer.jsx';
import Settings from './components/Settings.jsx';
import About from './components/About.jsx';
import Alerts from './components/Alerts.jsx';

const NAV_ITEMS = [
    { id: 'dashboard', label: 'Dashboard', icon: 'chart-line' },
    { id: 'alerts', label: 'Alerts', icon: 'bell' },
    { id: 'logs', label: 'Logs', icon: 'terminal' },
    { id: 'settings', label: 'Settings', icon: 'gear' },
    { id: 'about', label: 'About', icon: 'circle-info' },
];

export default function App() {
    const [page, setPage] = useState('dashboard');
    const [status, setStatus] = useState(null);
    const [connected, setConnected] = useState(false);
    const [history, setHistory] = useState([]);
    const [alertCount, setAlertCount] = useState(0);
    const [updateVersion, setUpdateVersion] = useState(null);
    const MAX_HISTORY = 180;

    useEffect(() => {
        if (window.electronAPI?.onUpdateReady) {
            window.electronAPI.onUpdateReady((version) => setUpdateVersion(version));
        }
    }, []);

    const pollStatus = useCallback(async () => {
        try {
            const data = await fetchStatus();
            setStatus(data);
            setConnected(true);
            setAlertCount(data.active_alerts_count || 0);
            setHistory(prev => {
                const next = [...prev, {
                    time: Date.now(),
                    cpu: data.cpu_usage_percent,
                    mem: data.memory_total_bytes ? (data.memory_used_bytes / data.memory_total_bytes * 100) : 0,
                    collectDur: data.collect_duration_seconds || 0,
                    scrapeDur: data.scrape_duration_seconds || 0,
                }];
                return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
            });
        } catch {
            setConnected(false);
        }
    }, []);

    useEffect(() => {
        pollStatus();
        const id = setInterval(pollStatus, 1000);
        return () => clearInterval(id);
    }, [pollStatus]);

    const renderPage = () => {
        switch (page) {
            case 'dashboard': return <Dashboard status={status} connected={connected} history={history} onRetry={pollStatus} />;
            case 'alerts': return <Alerts />;
            case 'logs': return <LogViewer />;
            case 'settings': return <Settings status={status} connected={connected} />;
            case 'about': return <About status={status} connected={connected} />;
            default: return null;
        }
    };

    return (
        <div className="app-layout">
            <aside className="sidebar">
                <div className="sidebar-brand">
                    <h1><Icon icon="eye" style={{ marginRight: 8 }} />The Third Eye</h1>
                    <div className="brand-sub">System Monitor</div>
                </div>

                {updateVersion && (
                    <div className="update-banner">
                        <div style={{ fontSize: 12, fontWeight: 600 }}>v{updateVersion} available</div>
                        <button className="btn btn-primary" style={{ fontSize: 11, padding: '4px 10px', marginTop: 4 }}
                            onClick={() => window.electronAPI?.installUpdate()}>
                            <Icon icon="rotate" style={{ marginRight: 4 }} />Update now
                        </button>
                    </div>
                )}

                <nav className="sidebar-nav">
                    {NAV_ITEMS.map(item => (
                        <button
                            key={item.id}
                            className={`nav-item ${page === item.id ? 'active' : ''}`}
                            onClick={() => setPage(item.id)}
                        >
                            <span className="nav-icon"><Icon icon={item.icon} /></span>
                            {item.label}
                            {item.id === 'alerts' && alertCount > 0 && (
                                <span className="nav-badge">{alertCount}</span>
                            )}
                        </button>
                    ))}
                </nav>

                <div className="sidebar-status">
                    <div className="status-badge">
                        <span className={`status-dot ${connected ? 'green pulse' : 'red'}`} />
                        {connected ? 'Agent connected' : 'Agent unreachable'}
                    </div>
                </div>
            </aside>

            <main className="content">
                <div className="titlebar">
                    <span className="titlebar-title">The Third Eye</span>
                    <div className="titlebar-controls">
                        <button className="titlebar-btn minimize" title="Minimize"
                            onClick={() => window.electronAPI?.minimize()} />
                        <button className="titlebar-btn maximize" title="Maximize"
                            onClick={() => window.electronAPI?.maximize()} />
                        <button className="titlebar-btn close" title="Close"
                            onClick={() => window.electronAPI?.close()} />
                    </div>
                </div>
                <div className="content-body">
                    <div className="fade-in" key={page}>
                        {renderPage()}
                    </div>
                </div>
            </main>
        </div>
    );
}
