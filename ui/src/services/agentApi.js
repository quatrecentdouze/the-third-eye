const BASE = 'http://127.0.0.1:9100';

export async function fetchStatus() {
    const res = await fetch(`${BASE}/api/status`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export async function fetchLogs(level = '', limit = 500) {
    const params = new URLSearchParams();
    if (level) params.set('level', level);
    params.set('limit', String(limit));
    const res = await fetch(`${BASE}/api/logs?${params}`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export async function postConfig(config) {
    const res = await fetch(`${BASE}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
        signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export async function fetchAlerts() {
    const res = await fetch(`${BASE}/api/alerts`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}

export async function testConnection() {
    try {
        await fetchStatus();
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e.message };
    }
}
