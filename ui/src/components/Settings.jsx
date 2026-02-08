import React, { useState, useEffect, useMemo } from 'react';
import { Icon } from 'fontnotawesome';
import { postConfig, testConnection } from '../services/agentApi.js';

export default function Settings({ status, connected }) {
    const [interval, setInterval_] = useState(1);
    const [logLevel, setLogLevel] = useState('info');
    const [testResult, setTestResult] = useState(null);
    const [applying, setApplying] = useState(false);
    const [message, setMessage] = useState(null);
    const [synced, setSynced] = useState(false);

    useEffect(() => {
        if (status && !synced) {
            setInterval_(status.interval || 1);
            setLogLevel(status.log_level || 'info');
            setSynced(true);
        }
    }, [status, synced]);

    const hasPendingChanges = useMemo(() => {
        if (!status) return false;
        return interval !== (status.interval || 1) || logLevel !== (status.log_level || 'info');
    }, [interval, logLevel, status]);

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
            await postConfig({ interval, log_level: logLevel });
            setMessage({ type: 'success', text: 'Configuration applied successfully.' });
        } catch (e) {
            setMessage({ type: 'error', text: `Failed: ${e.message}` });
        }
        setApplying(false);
        setTimeout(() => setMessage(null), 4000);
    };

    return (
        <div className="fade-in">
            <div className="page-header">
                <h2>Settings</h2>
                <p>Configure the monitoring agent</p>
            </div>

            <div className="settings-form">
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
