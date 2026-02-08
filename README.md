# The Third Eye 👁️

**System monitoring agent + desktop UI** — modern C++20 agent, Electron dashboard.  
Single binary, minimal overhead, Prometheus-compatible, premium desktop experience.

---

## What It Does

The Third Eye is a local system monitoring tool for Windows:

- **Agent** — headless C++ process collecting CPU, memory, and system metrics every second
- **UI** — Electron desktop app with real-time dashboard, log viewer, settings, and diagnostics
- **APIs** — Prometheus `/metrics` endpoint + JSON REST API for the UI

### What It Does NOT Do

- No cloud connectivity, no remote access
- No authentication (localhost only, 127.0.0.1)
- No disk, network, GPU, or process-level metrics (v1 scope)
- No Linux/macOS collectors yet (agent compiles but reports no data)

---

## Features

### Metrics

| Category | Metrics |
|----------|---------|
| **CPU** | `cpu_usage_percent`, `cpu_cores` |
| **Memory** | `memory_total_bytes`, `memory_used_bytes`, `memory_free_bytes` |
| **System** | `system_uptime_seconds`, `collect_timestamp_seconds`, `build_info` |
| **Agent** | `agent_uptime_seconds`, `collect_duration_seconds`, `scrape_duration_seconds` |
| **Errors** | `collect_errors_total{collector="..."}` |
| **HTTP** | `http_requests_total{path="..."}` |

### Agent Health

Deterministic health status exposed in `/api/status`:

- **healthy** — all systems nominal
- **degraded** — collection cycle > 2s or scrape > 1s
- **unhealthy** — collector errors detected

### UI Dashboard

- Health badge with color-coded status
- CPU and memory cards with sparklines (3 min)
- Collect/scrape duration sparklines
- Graceful disconnect handling (last known values + retry)

### UI Logs

- Level-based highlighting (INFO/DEBUG/ERROR)
- Error banner with "copy ±20 lines" context
- Search, filter, pause, export

### UI Settings

- Live interval and log level changes
- "Changes pending" indicator
- Connection test

### UI Diagnostics

- Full diagnostic snapshot export (JSON)
- Build info, health, metrics, last 50 log lines

---

## Build

### Requirements

- CMake ≥ 3.20
- C++20 compiler (GCC 11+ / MinGW-w64 / MSVC 2022+)
- Node.js ≥ 18 (for UI)
- Windows (primary target)

### Agent

```bash
cmake -B build -G "MinGW Makefiles" -DCMAKE_BUILD_TYPE=Release
cmake --build build
```

### UI

```bash
cd ui
npm install
npm run dev        # Development
npm run build      # Production
```

---

## Usage

### Start the Agent

```bash
# Defaults: port 9100, 1s interval, info logging
./build/the_third_eye

# Custom
./build/the_third_eye --port 9200 --interval 5 --log-level debug

# Help
./build/the_third_eye --help
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TTE_PORT` | HTTP port | `9100` |
| `TTE_INTERVAL` | Collection interval (seconds) | `1` |
| `TTE_LOG_LEVEL` | `info` or `debug` | `info` |

### Start the UI

```bash
cd ui
npm run dev
```

The UI connects to the agent on `http://127.0.0.1:9100`.

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/metrics` | GET | Prometheus text format |
| `/api/status` | GET | JSON: health, metrics, config, build info |
| `/api/logs` | GET | JSON: log entries (supports `?level=ERROR&limit=100`) |
| `/api/config` | POST | JSON: update `interval` and `log_level` at runtime |

### Sample `/api/status` Response

```json
{
  "status": "running",
  "version": "1.0.0",
  "commit": "abc1234",
  "platform": "windows",
  "compiler": "gcc",
  "port": 9100,
  "interval": 1,
  "log_level": "info",
  "agent_uptime_seconds": 3600.5,
  "health": "healthy",
  "cpu_usage_percent": 12.3,
  "cpu_cores": 8,
  "memory_total_bytes": 17179869184,
  "memory_used_bytes": 8589934592,
  "memory_free_bytes": 8589934592,
  "collect_duration_seconds": 0.000123,
  "scrape_duration_seconds": 0.000045,
  "system_uptime_seconds": 123456.789,
  "collector_durations": { "cpu": 0.00005, "memory": 0.00003, "system": 0.00001 },
  "collect_errors": { "cpu": 0, "memory": 0, "system": 0 },
  "http_requests": {}
}
```

---

## Architecture

```
src/
  main.cpp              CLI parsing, signal handling, bootstrap
  agent.cpp             Collection loop, health computation, lifecycle
  registry.cpp          Thread-safe metric store + Prometheus serialization
  http_server.cpp       HTTP/1.1 server (raw sockets, 127.0.0.1 only)
  collectors/
    cpu_windows.cpp     CPU usage via GetSystemTimes()
    memory_windows.cpp  Memory via GlobalMemoryStatusEx()
    system_windows.cpp  Uptime, timestamp, build info

ui/
  src/App.jsx           Main layout, polling, history tracking
  src/components/
    Dashboard.jsx       Health badge, metric cards, sparklines
    LogViewer.jsx       Real-time log viewer with filtering
    Settings.jsx        Runtime configuration
    About.jsx           Build info, diagnostics export
```

---

## Known Limitations (v1.0.0)

- **Windows only** — Linux/macOS collectors not implemented
- **Localhost only** — binds to 127.0.0.1, no remote access
- **No persistent storage** — metrics and logs are in-memory only
- **Single-threaded HTTP** — handles one request at a time
- **No TLS** — plain HTTP; acceptable for localhost-only use

---

## License

MIT
