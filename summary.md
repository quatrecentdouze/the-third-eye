# The Third Eye — Summary

**The Third Eye** is a lightweight Windows system monitoring agent written in C++. It collects hardware and OS metrics at a configurable interval and exposes them via a Prometheus-compatible HTTP endpoint (`/metrics`) as well as a JSON API consumed by its companion Electron desktop UI.

---

## What is monitored

### CPU
| Metric | Description |
|--------|-------------|
| `cpu_usage_percent` | Overall CPU usage as a percentage (0–100%) |
| `cpu_cores` | Number of logical CPU cores |

### Memory
| Metric | Description |
|--------|-------------|
| `memory_total_bytes` | Total physical RAM in bytes |
| `memory_used_bytes` | Currently used RAM in bytes |
| `memory_available_bytes` | Available RAM in bytes |

### System
| Metric | Description |
|--------|-------------|
| `system_uptime_seconds` | Time elapsed since last OS boot |
| `build_info` | Agent version, git commit, platform, and compiler (exposed as labeled metric) |
| `collect_timestamp_seconds` | Unix timestamp of the last collection cycle |

### Agent health (self-monitoring)
| Metric | Description |
|--------|-------------|
| `agent_uptime_seconds` | Time elapsed since the agent process started |
| `collect_duration_seconds` | Total duration of a full collection cycle (all collectors) |
| `collector_duration_seconds` | Duration of each individual collector (`cpu`, `memory`, `system`) |
| `collect_errors_total` | Number of errors per collector |
| `scrape_duration_seconds` | Time taken to generate the `/metrics` response |
| `http_requests_total` | Total HTTP requests received, broken down by path and status code |

---

## What is displayed in the UI

The Electron desktop app polls the agent's JSON API (`/api/status`) every second and presents the data across four screens:

### Dashboard
- **CPU Usage** — percentage with color coding (green / orange / red) + core count
- **Memory** — percentage + used / total breakdown + visual progress bar
- **System Uptime** — formatted as `Xd Xh Xm`
- **Agent Uptime** — formatted as `Xd Xh Xm Xs`
- **CPU chart** — mini area chart showing the last 3 minutes of CPU usage
- **Memory chart** — mini area chart showing the last 3 minutes of memory usage
- **Collect Duration** — total time for one collection cycle
- **Scrape Duration** — time to generate the Prometheus `/metrics` response
- **Collector Errors** — total error count across all collectors
- **HTTP Requests** — total number of `/metrics` scrapes received
- **Collector Performance** — per-collector breakdown of collection duration

### Logs
- Real-time agent log viewer with level filtering (ALL / INFO / DEBUG / ERROR)
- Text search, pause/resume, auto-scroll, copy-to-clipboard, and file export

### Settings
- **Collection Interval** — configurable (1–60 seconds, applied live)
- **Log Level** — switch between Info and Debug at runtime
- **Port** — displayed (read-only, requires agent restart)
- **Test Connection** — verify agent reachability

### About
- Build info: version, git commit, platform, compiler
- Agent connection status
- API endpoint URLs
- Copy full diagnostics to clipboard
