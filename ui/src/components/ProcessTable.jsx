import React from 'react';
import { Icon } from 'fontnotawesome';

function formatBytes(bytes) {
    if (!bytes && bytes !== 0) return '—';
    const gb = bytes / (1024 ** 3);
    if (gb >= 1) return `${gb.toFixed(1)} GB`;
    const mb = bytes / (1024 ** 2);
    if (mb >= 1) return `${mb.toFixed(0)} MB`;
    return `${(bytes / 1024).toFixed(0)} KB`;
}

export default function ProcessTable({ processes }) {
    if (!processes || processes.length === 0) {
        return (
            <div className="about-section" style={{ marginTop: 8 }}>
                <h3><Icon icon="list-check" style={{ marginRight: 8, opacity: 0.6 }} />Top Processes</h3>
                <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)', fontSize: 13 }}>
                    <Icon icon="circle-info" style={{ marginRight: 6 }} />
                    No process data available — collecting baseline...
                </div>
            </div>
        );
    }

    return (
        <div className="about-section" style={{ marginTop: 8 }}>
            <h3><Icon icon="list-check" style={{ marginRight: 8, opacity: 0.6 }} />Top Processes</h3>
            <table className="process-table">
                <thead>
                    <tr>
                        <th>Process</th>
                        <th>PID</th>
                        <th style={{ textAlign: 'right' }}>CPU %</th>
                        <th style={{ textAlign: 'right' }}>Memory</th>
                    </tr>
                </thead>
                <tbody>
                    {processes.map((p, i) => {
                        const hot = p.cpu_percent > 50;
                        return (
                            <tr key={`${p.pid}-${i}`} className={hot ? 'row-hot' : ''}>
                                <td className="process-name">
                                    {hot && <Icon icon="fire" style={{ color: 'var(--red)', marginRight: 6, fontSize: 11 }} />}
                                    {p.name}
                                </td>
                                <td className="process-pid">{p.pid}</td>
                                <td style={{ textAlign: 'right', color: hot ? 'var(--red)' : 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                                    {p.cpu_percent.toFixed(1)}%
                                </td>
                                <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                    {formatBytes(p.memory_bytes)}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
