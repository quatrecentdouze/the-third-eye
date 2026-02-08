import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Icon } from 'fontnotawesome';
import { fetchLogs } from '../services/agentApi.js';
import { useToast, Toast } from './Toast.jsx';

const LEVELS = ['ALL', 'INFO', 'DEBUG', 'ERROR'];

export default function LogViewer() {
    const [logs, setLogs] = useState([]);
    const [level, setLevel] = useState('ALL');
    const [search, setSearch] = useState('');
    const [autoScroll, setAutoScroll] = useState(true);
    const [paused, setPaused] = useState(false);
    const containerRef = useRef(null);
    const { toast, show: showToast } = useToast();

    const pollLogs = useCallback(async () => {
        if (paused) return;
        try {
            const filterLevel = level === 'ALL' ? '' : level;
            const data = await fetchLogs(filterLevel, 500);
            setLogs(data.logs || []);
        } catch { }
    }, [level, paused]);

    useEffect(() => {
        pollLogs();
        const id = setInterval(pollLogs, 1500);
        return () => clearInterval(id);
    }, [pollLogs]);

    useEffect(() => {
        if (autoScroll && containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, [logs, autoScroll]);

    const filtered = search
        ? logs.filter(l => l.message.toLowerCase().includes(search.toLowerCase()) ||
            l.timestamp.includes(search))
        : logs;

    const lastError = [...filtered].reverse().find(l => l.level === 'ERROR');

    const copySelected = () => {
        const text = filtered.map(l => `[${l.timestamp}] [${l.level}] ${l.message}`).join('\n');
        navigator.clipboard.writeText(text);
        showToast('Copied ' + filtered.length + ' log entries');
    };

    const copyErrorContext = () => {
        if (!lastError) return;
        const idx = filtered.findIndex(l => l === lastError || (l.timestamp === lastError.timestamp && l.message === lastError.message));
        if (idx < 0) return;
        const start = Math.max(0, idx - 20);
        const end = Math.min(filtered.length, idx + 21);
        const context = filtered.slice(start, end)
            .map(l => `[${l.timestamp}] [${l.level}] ${l.message}`)
            .join('\n');
        navigator.clipboard.writeText(context);
        showToast('Copied error context (' + (end - start) + ' lines)');
    };

    const exportLogs = () => {
        const text = filtered.map(l => `[${l.timestamp}] [${l.level}] ${l.message}`).join('\n');
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `the-third-eye-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Logs exported');
    };

    return (
        <div className="fade-in">
            <div className="page-header">
                <h2>Logs</h2>
                <p>Real-time agent log viewer</p>
            </div>

            {lastError && (
                <div className="log-error-banner">
                    <Icon icon="circle-exclamation" style={{ marginRight: 8, flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                        <strong>Last error</strong> [{lastError.timestamp}] {lastError.message}
                    </span>
                    <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 11, flexShrink: 0 }} onClick={copyErrorContext}>
                        <Icon icon="copy" /> ±20 lines
                    </button>
                </div>
            )}

            <div className="log-toolbar">
                <input
                    className="log-search"
                    placeholder="Search logs..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
                {LEVELS.map(l => (
                    <button
                        key={l}
                        className={`filter-btn ${level === l ? 'active' : ''}`}
                        onClick={() => setLevel(l)}
                    >
                        {l}
                    </button>
                ))}
                <button
                    className={`filter-btn ${paused ? 'active' : ''}`}
                    onClick={() => setPaused(!paused)}
                    title={paused ? 'Resume' : 'Pause'}
                >
                    <Icon icon={paused ? 'play' : 'pause'} style={{ marginRight: 5 }} />
                    {paused ? 'Resume' : 'Pause'}
                </button>
                <button
                    className={`filter-btn ${autoScroll ? 'active' : ''}`}
                    onClick={() => setAutoScroll(!autoScroll)}
                >
                    <Icon icon="arrow-down" style={{ marginRight: 5 }} />
                    Auto-scroll
                </button>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <button className="btn btn-secondary" onClick={copySelected}>
                    <Icon icon="copy" /> Copy All
                </button>
                <button className="btn btn-secondary" onClick={exportLogs}>
                    <Icon icon="file-export" /> Export
                </button>
                <span style={{ flex: 1 }} />
                <span style={{ color: 'var(--text-muted)', fontSize: 12, alignSelf: 'center' }}>
                    {filtered.length} entries
                </span>
            </div>

            <div className="log-container" ref={containerRef}>
                {filtered.length === 0 ? (
                    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                        {paused ? 'Paused — click Resume to continue' : 'No logs yet'}
                    </div>
                ) : (
                    filtered.map((log, i) => (
                        <div className={`log-line log-level-${log.level}`} key={i}>
                            <span className="log-ts">{log.timestamp}</span>
                            <span className={`log-level ${log.level}`}>{log.level}</span>
                            <span className="log-msg">{log.message}</span>
                        </div>
                    ))
                )}
            </div>
            <Toast toast={toast} />
        </div>
    );
}
