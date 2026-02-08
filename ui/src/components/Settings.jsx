import React, { useState, useEffect, useMemo } from 'react';
import { Icon } from 'fontnotawesome';
import { postConfig, testConnection } from '../services/agentApi.js';

export default function Settings({ status, connected }) {
    const [interval, setInterval_] = useState(1);
    const [logLevel, setLogLevel] = useState('info');
    const [cpuThreshold, setCpuThreshold] = useState(90);
    const [memThreshold, setMemThreshold] = useState(90);
    const [collectThreshold, setCollectThreshold] = useState(2.0);
    const [notifEnabled, setNotifEnabled] = useState(true);
    const [testResult, setTestResult] = useState(null);
    const [applying, setApplying] = useState(false);
    const [message, setMessage] = useState(null);
    const [synced, setSynced] = useState(false);

    useEffect(() => {
        if (status && !synced) {
            setInterval_(status.interval || 1);
            setLogLevel(status.log_level || 'info');
            if (status.cpu_threshold != null) setCpuThreshold(status.cpu_threshold);
            if (status.memory_threshold != null) setMemThreshold(status.memory_threshold);
            if (status.collect_threshold != null) setCollectThreshold(status.collect_threshold);
            setSynced(true);
        }
    }, [status, synced]);

    useEffect(() => {
        if (window.electronAPI?.getNotificationsEnabled) {
            window.electronAPI.getNotificationsEnabled().then(v => setNotifEnabled(v));
        }
    }, []);

    const hasPendingChanges = useMemo(() => {
        if (!status) return false;
        return interval !== (status.interval || 1)
            || logLevel !== (status.log_level || 'info')
            || cpuThreshold !== (status.cpu_threshold ?? 90)
            || memThreshold !== (status.memory_threshold ?? 90)
            || collectThreshold !== (status.collect_threshold ?? 2.0);
    }, [interval, logLevel, cpuThreshold, memThreshold, collectThreshold, status]);

    const handleTest = async () => {
        setTestResult(null);
        const result = await testConnection();
        setTestResult(result);
        setTimeout(() => setTestResult(null), 4000);
    };

    const handleApply = async () => {
        setApplying(true);
        setMessage(null);
        try {
            await postConfig({
                interval,
                log_level: logLevel,
                cpu_threshold: cpuThreshold,
                memory_threshold: memThreshold,
                collect_threshold: collectThreshold,
            });
            setMessage({ type: 'success', text: 'Configuration applied successfully.' });
        } catch (e) {
            setMessage({ type: 'error', text: `Failed: ${e.message}` });
        }
        setApplying(false);
        setTimeout(() => setMessage(null), 4000);
    };

    const handleNotifToggle = () => {
        const next = !notifEnabled;
        setNotifEnabled(next);
        if (window.electronAPI?.setNotificationsEnabled) {
            window.electronAPI.setNotificationsEnabled(next);
        }
    };

    return (
        <div className="fade-in">
            <div className="page-header">
                <h2>Settings</h2>
                <p>Configure the monitoring agent</p>
            </div>

            <div className="settings-form">
                {window.electronAPI && (
                    <div className="form-group" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                            <label className="form-label" style={{ margin: 0 }}>
                                <Icon icon="bell" style={{ marginRight: 8 }} />
                                Desktop Notifications
                            </label>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                                Show Windows toast notifications when alerts fire
                            </div>
                        </div>
                        <button
                            className={`toggle-switch ${notifEnabled ? 'active' : ''}`}
                            onClick={handleNotifToggle}
                            style={{
                                width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
                                background: notifEnabled ? 'var(--accent)' : 'var(--bg-tertiary)',
                                position: 'relative', transition: 'background 0.2s',
                                flexShrink: 0,
                            }}
                        >
                            <span style={{
                                position: 'absolute', top: 3, left: notifEnabled ? 25 : 3,
                                width: 20, height: 20, borderRadius: '50%',
                                background: '#fff', transition: 'left 0.2s',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                            }} />
                        </button>
                    </div>
                )}

                <div className="form-group">
                    <label className="form-label">Port</label>
                    <input className="form-input" type="number" value={status?.port || 9100} disabled style={{ opacity: 0.5 }} />
                    <div style={{ fontSize: 11, color: 'var(--orange)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Icon icon="triangle-exclamation" style={{ fontSize: 10 }} />
                        Restart required to change port — use <code>--port</code> CLI flag
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label">Collection Interval (seconds)</label>
                    <input className="form-input" type="number" min={1} max={60} value={interval}
                        onChange={e => setInterval_(parseInt(e.target.value) || 1)} />
                </div>

                <div className="form-group">
                    <label className="form-label">Log Level</label>
                    <select className="form-select" value={logLevel} onChange={e => setLogLevel(e.target.value)}>
                        <option value="info">Info</option>
                        <option value="debug">Debug</option>
                    </select>
                </div>

                <div style={{ borderTop: '1px solid var(--border)', margin: '20px 0', paddingTop: 20 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Icon icon="sliders" style={{ opacity: 0.6 }} />
                        Alert Thresholds
                    </h3>

                    <div className="form-group">
                        <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>CPU Usage</span>
                            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{cpuThreshold}%</span>
                        </label>
                        <input type="range" min={10} max={100} step={5} value={cpuThreshold}
                            onChange={e => setCpuThreshold(Number(e.target.value))}
                            style={{ width: '100%', accentColor: 'var(--accent)' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                            <span>10%</span><span>100%</span>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Memory Usage</span>
                            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{memThreshold}%</span>
                        </label>
                        <input type="range" min={10} max={100} step={5} value={memThreshold}
                            onChange={e => setMemThreshold(Number(e.target.value))}
                            style={{ width: '100%', accentColor: 'var(--accent)' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                            <span>10%</span><span>100%</span>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Collection Duration</span>
                            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{collectThreshold.toFixed(1)}s</span>
                        </label>
                        <input type="range" min={0.5} max={10} step={0.5} value={collectThreshold}
                            onChange={e => setCollectThreshold(Number(e.target.value))}
                            style={{ width: '100%', accentColor: 'var(--accent)' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                            <span>0.5s</span><span>10s</span>
                        </div>
                    </div>
                </div>

                {hasPendingChanges && (
                    <div className="changes-pending">
                        <Icon icon="circle-exclamation" />
                        Changes pending — click Apply to save
                    </div>
                )}

                {message && (
                    <div style={{
                        padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16,
                        background: message.type === 'success' ? 'var(--green-bg)' : 'var(--red-bg)',
                        color: message.type === 'success' ? 'var(--green)' : 'var(--red)',
                        border: `1px solid ${message.type === 'success' ? 'rgba(0,214,143,0.2)' : 'rgba(255,83,112,0.2)'}`,
                    }}>
                        {message.type === 'success' ? '✓ ' : '✗ '}{message.text}
                    </div>
                )}

                {testResult && (
                    <div style={{
                        padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16,
                        background: testResult.ok ? 'var(--green-bg)' : 'var(--red-bg)',
                        color: testResult.ok ? 'var(--green)' : 'var(--red)',
                        border: `1px solid ${testResult.ok ? 'rgba(0,214,143,0.2)' : 'rgba(255,83,112,0.2)'}`,
                    }}>
                        {testResult.ok ? '✓ Connection successful' : `✗ ${testResult.error}`}
                    </div>
                )}

                <div className="btn-group">
                    <button className="btn btn-secondary" onClick={handleTest}>
                        <Icon icon="plug" /> Test Connection
                    </button>
                    <button className="btn btn-primary" onClick={handleApply} disabled={applying || !connected}>
                        <Icon icon={applying ? 'spinner' : 'check'} className={applying ? 'fa-spin' : ''} />
                        {applying ? ' Applying...' : ' Apply'}
                    </button>
                </div>
            </div>
        </div>
    );
}
