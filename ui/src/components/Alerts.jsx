import React, { useState, useEffect, useCallback } from 'react';
import { Icon } from 'fontnotawesome';
import { fetchAlerts } from '../services/agentApi.js';

const TYPE_ICONS = {
    cpu_high: 'microchip',
    memory_high: 'memory',
    collect_slow: 'gauge-high',
};

const TYPE_LABELS = {
    cpu_high: 'High CPU',
    memory_high: 'High Memory',
    collect_slow: 'Slow Collection',
};

function AlertCard({ alert }) {
    return (
        <div className="alert-card alert-active">
            <div className="alert-card-header">
                <Icon icon={TYPE_ICONS[alert.type] || 'triangle-exclamation'} style={{ marginRight: 8, fontSize: 13 }} />
                <span className="alert-card-type">{TYPE_LABELS[alert.type] || alert.type}</span>
            </div>
            <div className="alert-card-message">{alert.message}</div>
            <div className="alert-card-meta">
                <span>{alert.timestamp}</span>
            </div>
        </div>
    );
}

export default function Alerts() {
    const [data, setData] = useState(null);
    const [error, setError] = useState(false);

    const poll = useCallback(async () => {
        try {
            const d = await fetchAlerts();
            setData(d);
            setError(false);
        } catch {
            setError(true);
        }
    }, []);

    useEffect(() => {
        poll();
        const id = setInterval(poll, 2000);
        return () => clearInterval(id);
    }, [poll]);

    const active = data?.active || [];
    const history = data?.history || [];

    return (
        <div className="fade-in">
            <div className="page-header">
                <h2>Alerts</h2>
                <p>Threshold-based local anomaly detection</p>
            </div>

            {error && (
                <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                    <Icon icon="plug-circle-xmark" size="2x" style={{ marginBottom: 12 }} />
                    <div>Agent unreachable</div>
                </div>
            )}

            {!error && active.length > 0 && (
                <div className="about-section">
                    <h3 style={{ color: 'var(--red)' }}>
                        <Icon icon="bell" style={{ marginRight: 8 }} />
                        Active Alerts ({active.length})
                    </h3>
                    <div className="alert-active-grid">
                        {active.map((a, i) => <AlertCard key={i} alert={a} />)}
                    </div>
                </div>
            )}

            {!error && active.length === 0 && (
                <div className="card" style={{ textAlign: 'center', padding: 32 }}>
                    <Icon icon="check-circle" size="2x" style={{ color: 'var(--green)', marginBottom: 12 }} />
                    <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--green)' }}>All Systems Nominal</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>No active alerts</div>
                </div>
            )}

            {!error && history.length > 0 && (
                <div className="about-section" style={{ marginTop: 12 }}>
                    <h3>
                        <Icon icon="clock-rotate-left" style={{ marginRight: 8, opacity: 0.6 }} />
                        History ({history.length})
                    </h3>
                    <table className="process-table">
                        <thead>
                            <tr>
                                <th>Type</th>
                                <th>Message</th>
                                <th>Time</th>
                                <th style={{ textAlign: 'right' }}>Value</th>
                                <th style={{ textAlign: 'right' }}>Threshold</th>
                                <th style={{ textAlign: 'center' }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[...history].reverse().map((a, i) => (
                                <tr key={i}>
                                    <td>
                                        <Icon icon={TYPE_ICONS[a.type] || 'triangle-exclamation'} style={{ marginRight: 6, opacity: 0.6, fontSize: 11 }} />
                                        {TYPE_LABELS[a.type] || a.type}
                                    </td>
                                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{a.message}</td>
                                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{a.timestamp}</td>
                                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{Number(a.value).toFixed(1)}</td>
                                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{Number(a.threshold).toFixed(1)}</td>
                                    <td style={{ textAlign: 'center' }}>
                                        {a.active
                                            ? <span style={{ color: 'var(--red)', fontWeight: 600, fontSize: 12 }}>firing</span>
                                            : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>resolved</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
