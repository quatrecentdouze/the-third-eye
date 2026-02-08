import React, { useState } from 'react';
import { Icon } from 'fontnotawesome';
import { fetchLogs, fetchAlerts } from '../services/agentApi.js';
import { useToast, Toast } from './Toast.jsx';

const HEALTH_COLORS = { healthy: 'var(--green)', degraded: 'var(--orange)', unhealthy: 'var(--red)' };

export default function About({ status, connected }) {
    const s = status || {};
    const [exporting, setExporting] = useState(false);
    const { toast, show: showToast } = useToast();

    const copyDiagnostics = () => {
        const lines = [
            `The Third Eye v${s.version || '?'}`,
            `Commit: ${s.commit || 'unknown'}`,
            `Platform: ${s.platform || '?'}`,
            `Compiler: ${s.compiler || '?'}`,
            `Port: ${s.port || '?'}`,
            `Interval: ${s.interval || '?'}s`,
            `Health: ${s.health || '?'}`,
            `Agent Uptime: ${s.agent_uptime_seconds ? s.agent_uptime_seconds.toFixed(0) + 's' : '?'}`,
            `System Uptime: ${s.system_uptime_seconds ? s.system_uptime_seconds.toFixed(0) + 's' : '?'}`,
            `Status: ${connected ? 'connected' : 'unreachable'}`,
            `Collected at: ${new Date().toISOString()}`,
        ];
        if (s.last_error) {
            lines.push(`Last Error: [${s.last_error.timestamp}] ${s.last_error.collector}: ${s.last_error.message}`);
        }
        navigator.clipboard.writeText(lines.join('\n'));
        showToast('Diagnostics copied');
    };

    const exportSnapshot = async () => {
        setExporting(true);
        try {
            let recentLogs = [];
            try {
                const data = await fetchLogs('', 50);
                recentLogs = data.logs || [];
            } catch { }

            const snapshot = {
                exported_at: new Date().toISOString(),
                build: {
                    version: s.version || '?',
                    commit: s.commit || 'unknown',
                    platform: s.platform || '?',
                    compiler: s.compiler || '?',
                },
                health: s.health || 'unknown',
                last_error: s.last_error || null,
                config: {
                    port: s.port,
                    interval: s.interval,
                    log_level: s.log_level,
                },
                uptimes: {
                    agent_uptime_seconds: s.agent_uptime_seconds,
                    system_uptime_seconds: s.system_uptime_seconds,
                },
                metrics: {
                    cpu_usage_percent: s.cpu_usage_percent,
                    cpu_cores: s.cpu_cores,
                    memory_used_bytes: s.memory_used_bytes,
                    memory_total_bytes: s.memory_total_bytes,
                    collect_duration_seconds: s.collect_duration_seconds,
                    scrape_duration_seconds: s.scrape_duration_seconds,
                    collector_durations: s.collector_durations,
                    collect_errors: s.collect_errors,
                    http_requests: s.http_requests,
                },
                top_processes: s.top_processes || [],
                recent_logs: recentLogs,
            };

            try {
                const alertData = await fetchAlerts();
                snapshot.alerts = alertData;
            } catch { }

            const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `the-third-eye-diagnostic-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('Diagnostic snapshot exported');
        } catch { }
        setExporting(false);
    };

    return (
        <div className="fade-in">
            <div className="page-header">
                <h2>About</h2>
                <p>Build information and diagnostics</p>
            </div>

            <div className="about-section">
                <h3>Build Info</h3>
                <div className="about-row">
                    <span className="about-key">Version</span>
                    <span className="about-value">{s.version || '—'}</span>
                </div>
                <div className="about-row">
                    <span className="about-key">Git Commit</span>
                    <span className="about-value">{s.commit || '—'}</span>
                </div>
                <div className="about-row">
                    <span className="about-key">Platform</span>
                    <span className="about-value">{s.platform || '—'}</span>
                </div>
                <div className="about-row">
                    <span className="about-key">Compiler</span>
                    <span className="about-value">{s.compiler || '—'}</span>
                </div>
            </div>

            <div className="about-section">
                <h3>Agent Status</h3>
                <div className="about-row">
                    <span className="about-key">Connection</span>
                    <span className="about-value" style={{ color: connected ? 'var(--green)' : 'var(--red)' }}>
                        <Icon icon="circle" style={{ fontSize: 6, marginRight: 6, verticalAlign: 2 }} />
                        {connected ? 'Connected' : 'Unreachable'}
                    </span>
                </div>
                <div className="about-row">
                    <span className="about-key">Health</span>
                    <span className="about-value" style={{ color: HEALTH_COLORS[s.health] || 'var(--text-muted)' }}>
                        {s.health ? s.health.charAt(0).toUpperCase() + s.health.slice(1) : '—'}
                    </span>
                </div>
                <div className="about-row">
                    <span className="about-key">Port</span>
                    <span className="about-value">{s.port || '—'}</span>
                </div>
                <div className="about-row">
                    <span className="about-key">Collection Interval</span>
                    <span className="about-value">{s.interval ? `${s.interval}s` : '—'}</span>
                </div>
                <div className="about-row">
                    <span className="about-key">Log Level</span>
                    <span className="about-value">{s.log_level || '—'}</span>
                </div>
                {s.last_error && (
                    <div className="about-row">
                        <span className="about-key" style={{ color: 'var(--red)' }}>Last Error</span>
                        <span className="about-value" style={{ color: 'var(--red)' }}>
                            [{s.last_error.timestamp}] {s.last_error.collector}: {s.last_error.message}
                        </span>
                    </div>
                )}
            </div>

            <div className="about-section">
                <h3>Endpoints</h3>
                <div className="about-row">
                    <span className="about-key">Prometheus Metrics</span>
                    <span className="about-value">http://127.0.0.1:{s.port || 9100}/metrics</span>
                </div>
                <div className="about-row">
                    <span className="about-key">API Status</span>
                    <span className="about-value">http://127.0.0.1:{s.port || 9100}/api/status</span>
                </div>
                <div className="about-row">
                    <span className="about-key">API Logs</span>
                    <span className="about-value">http://127.0.0.1:{s.port || 9100}/api/logs</span>
                </div>
                <div className="about-row">
                    <span className="about-key">API Alerts</span>
                    <span className="about-value">http://127.0.0.1:{s.port || 9100}/api/alerts</span>
                </div>
            </div>

            <div className="btn-group">
                <button className="btn btn-primary" onClick={copyDiagnostics}>
                    <Icon icon="clipboard" /> Copy Diagnostics
                </button>
                <button className="btn btn-secondary" onClick={exportSnapshot} disabled={exporting}>
                    <Icon icon={exporting ? 'spinner' : 'file-export'} className={exporting ? 'fa-spin' : ''} />
                    {exporting ? ' Exporting...' : ' Export Diagnostic Snapshot'}
                </button>
            </div>
            <Toast toast={toast} />
        </div>
    );
}
