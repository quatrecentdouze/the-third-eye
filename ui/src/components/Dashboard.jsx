import React from 'react';
import { AreaChart, Area, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import { Icon } from 'fontnotawesome';
import ProcessTable from './ProcessTable.jsx';

function formatBytes(bytes) {
    if (!bytes && bytes !== 0) return '—';
    const gb = bytes / (1024 ** 3);
    return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / (1024 ** 2)).toFixed(0)} MB`;
}

function formatUptime(seconds) {
    if (!seconds && seconds !== 0) return '—';
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${Math.floor(seconds % 60)}s`;
}

function formatDuration(s) {
    if (!s && s !== 0) return '—';
    if (s < 0.001) return `${(s * 1e6).toFixed(0)} µs`;
    if (s < 1) return `${(s * 1000).toFixed(1)} ms`;
    return `${s.toFixed(2)} s`;
}

const HEALTH_STYLES = {
    healthy: { color: 'var(--green)', bg: 'var(--green-bg)', icon: 'check', label: 'Healthy' },
    degraded: { color: 'var(--orange)', bg: 'var(--orange-bg)', icon: 'triangle-exclamation', label: 'Degraded' },
    unhealthy: { color: 'var(--red)', bg: 'var(--red-bg)', icon: 'circle-xmark', label: 'Unhealthy' },
};

function HealthBadge({ health, lastError }) {
    const style = HEALTH_STYLES[health] || HEALTH_STYLES.healthy;
    const tooltip = health === 'degraded' ? 'Collection or scrape duration above threshold'
        : health === 'unhealthy' ? `Collector error: ${lastError?.message || 'unknown'}`
            : 'All systems nominal';

    return (
        <div className="card" title={tooltip}>
            <div className="card-label">
                <Icon icon="heart-pulse" style={{ marginRight: 6, opacity: 0.6, fontSize: 11 }} />
                Agent Health
            </div>
            <div className="card-value" style={{ color: style.color, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon icon={style.icon} style={{ fontSize: 14 }} />
                {style.label}
            </div>
            {lastError && (
                <div className="card-sub" style={{ color: 'var(--red)', fontSize: 11 }}>
                    Last error: {lastError.collector} — {lastError.message}
                </div>
            )}
        </div>
    );
}

function MetricCard({ label, value, unit, sub, color, icon }) {
    return (
        <div className="card">
            <div className="card-label">
                {icon && <Icon icon={icon} style={{ marginRight: 6, opacity: 0.6, fontSize: 11 }} />}
                {label}
            </div>
            <div className="card-value" style={color ? { color } : {}}>
                {value ?? '—'}
                {unit && <span className="unit">{unit}</span>}
            </div>
            {sub && <div className="card-sub">{sub}</div>}
        </div>
    );
}

function MiniChart({ data, dataKey, color, title, formatter }) {
    if (!data || data.length < 2) return null;
    const fmt = formatter || ((v) => [`${v.toFixed(1)}%`]);
    const maxVal = Math.max(...data.map(d => d[dataKey] || 0));
    const domainMax = dataKey === 'cpu' || dataKey === 'mem' ? 100 : Math.max(maxVal * 1.2, 0.001);

    return (
        <div className="chart-section">
            <div className="chart-title">{title}</div>
            <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={data}>
                    <defs>
                        <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                            <stop offset="100%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <YAxis domain={[0, domainMax]} hide />
                    <Tooltip
                        contentStyle={{ background: '#16161f', border: '1px solid #2a2a3a', borderRadius: 8, fontSize: 12 }}
                        labelStyle={{ display: 'none' }}
                        formatter={fmt}
                    />
                    <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2}
                        fill={`url(#grad-${dataKey})`} dot={false} isAnimationActive={false} />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

function MemoryBar({ used, total }) {
    if (!total) return null;
    const pct = (used / total) * 100;
    const color = pct > 90 ? 'var(--red)' : pct > 75 ? 'var(--orange)' : 'var(--accent)';
    return (
        <div className="health-bar">
            <div className="health-bar-fill" style={{ width: `${pct}%`, background: color }} />
        </div>
    );
}

export default function Dashboard({ status, connected, history, onRetry }) {
    if (!connected && !status) {
        return (
            <div className="fade-in">
                <div className="page-header">
                    <h2>Dashboard</h2>
                    <p>Real-time system metrics</p>
                </div>
                <div className="card" style={{ textAlign: 'center', padding: 48 }}>
                    <Icon icon="plug-circle-xmark" size="2x" style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
                    <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--red)' }}>Agent Unreachable</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
                        Make sure The Third Eye agent is running on port 9100
                    </div>
                    {onRetry && (
                        <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={onRetry}>
                            <Icon icon="rotate-right" /> Retry Now
                        </button>
                    )}
                </div>
            </div>
        );
    }

    const s = status || {};
    const stale = !connected;
    const memPct = s.memory_total_bytes ? ((s.memory_used_bytes / s.memory_total_bytes) * 100).toFixed(1) : '—';
    const wrapStyle = stale ? { opacity: 0.5, filter: 'grayscale(0.3)' } : {};

    return (
        <div className="fade-in">
            <div className="page-header">
                <h2>Dashboard</h2>
                <p>
                    Real-time system metrics — v{s.version || '?'}
                    {stale && <span style={{ color: 'var(--orange)', marginLeft: 12, fontSize: 12 }}>
                        <Icon icon="wifi" style={{ marginRight: 4 }} />Disconnected — showing last known values
                    </span>}
                </p>
            </div>

            {stale && onRetry && (
                <div style={{ marginBottom: 12 }}>
                    <button className="btn btn-primary" onClick={onRetry}>
                        <Icon icon="rotate-right" /> Retry Now
                    </button>
                </div>
            )}

            <div style={wrapStyle}>
                <div className="card-grid">
                    <HealthBadge health={s.health || 'healthy'} lastError={s.last_error} />
                    <MetricCard
                        icon="microchip"
                        label="CPU Usage"
                        value={s.cpu_usage_percent?.toFixed(1)}
                        unit="%"
                        color={s.cpu_usage_percent > 80 ? 'var(--red)' : s.cpu_usage_percent > 50 ? 'var(--orange)' : 'var(--green)'}
                        sub={`${s.cpu_cores || '?'} cores`}
                    />
                    <div className="card">
                        <div className="card-label">
                            <Icon icon="memory" style={{ marginRight: 6, opacity: 0.6, fontSize: 11 }} />
                            Memory
                        </div>
                        <div className="card-value">
                            {memPct}<span className="unit">%</span>
                        </div>
                        <div className="card-sub">
                            {formatBytes(s.memory_used_bytes)} / {formatBytes(s.memory_total_bytes)}
                        </div>
                        <MemoryBar used={s.memory_used_bytes} total={s.memory_total_bytes} />
                    </div>
                    <MetricCard icon="globe" label="System Uptime" value={formatUptime(s.system_uptime_seconds)} />
                    <MetricCard icon="clock" label="Agent Uptime" value={formatUptime(s.agent_uptime_seconds)} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <MiniChart data={history} dataKey="cpu" color="#6c5ce7" title="CPU Usage (last 3 min)" />
                    <MiniChart data={history} dataKey="mem" color="#00d68f" title="Memory Usage (last 3 min)" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <MiniChart data={history} dataKey="collectDur" color="#ffa502" title="Collect Duration (last 3 min)"
                        formatter={(v) => [formatDuration(v)]} />
                    <MiniChart data={history} dataKey="scrapeDur" color="#40a8ff" title="Scrape Duration (last 3 min)"
                        formatter={(v) => [formatDuration(v)]} />
                </div>

                <div style={{ marginTop: 8 }}>
                    <div className="card-grid">
                        <MetricCard icon="gauge-high" label="Collect Duration" value={formatDuration(s.collect_duration_seconds)} sub="Total cycle" />
                        <MetricCard icon="bolt" label="Scrape Duration" value={formatDuration(s.scrape_duration_seconds)} sub="/metrics generation" />
                        <MetricCard
                            icon="triangle-exclamation"
                            label="Collector Errors"
                            value={Object.values(s.collect_errors || {}).reduce((a, b) => a + b, 0)}
                            color={Object.values(s.collect_errors || {}).some(v => v > 0) ? 'var(--red)' : 'var(--green)'}
                            sub="Total across all collectors"
                        />
                        <MetricCard icon="server" label="HTTP Requests" value={
                            Object.values(s.http_requests || {}).reduce((sum, v) => sum + v, 0)
                        } sub="Total /metrics scrapes" />
                    </div>
                </div>

                {s.collector_durations && Object.keys(s.collector_durations).length > 0 && (
                    <div className="about-section" style={{ marginTop: 8 }}>
                        <h3>Collector Performance</h3>
                        {Object.entries(s.collector_durations).map(([k, v]) => (
                            <div className="about-row" key={k}>
                                <span className="about-key">{k}</span>
                                <span className="about-value">{formatDuration(v)}</span>
                            </div>
                        ))}
                    </div>
                )}

                <ProcessTable processes={s.top_processes} />
            </div>
        </div>
    );
}
