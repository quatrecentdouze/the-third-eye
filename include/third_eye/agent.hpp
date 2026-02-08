#pragma once

#include "registry.hpp"
#include "http_server.hpp"
#include "collector.hpp"

#include <vector>
#include <deque>
#include <memory>
#include <atomic>
#include <mutex>
#include <condition_variable>
#include <chrono>
#include <cstdint>
#include <string>

namespace third_eye {

enum class LogLevel { Info, Debug };

struct LogEntry {
    std::string timestamp;
    std::string level;
    std::string message;
};

struct LastError {
    std::string collector;
    std::string timestamp;
    std::string message;
};

struct ProcessInfo {
    uint32_t    pid;
    std::string name;
    double      cpu_percent;
    uint64_t    memory_bytes;
};

struct AlertEntry {
    std::string type;
    std::string severity;
    std::string message;
    std::string timestamp;
    double      value;
    double      threshold;
    bool        active;
};

class Agent {
public:
    struct Config {
        uint16_t port      = 9100;
        int      interval  = 1;
        int      top_n     = 5;
        LogLevel log_level = LogLevel::Info;
        double cpu_threshold     = 90.0;
        double memory_threshold  = 90.0;
        double collect_threshold = 2.0;
    };

    explicit Agent(Config config);
    ~Agent();

    void add_collector(std::unique_ptr<Collector> collector);
    void run();
    void stop();

    Registry& registry() { return registry_; }
    const Config& config() const { return config_; }
    std::chrono::steady_clock::time_point start_time() const { return start_time_; }

    std::string compute_health() const;
    LastError last_error() const;

    std::vector<LogEntry> get_logs(const std::string& level_filter = "", int limit = 500) const;
    void update_config(int new_interval, const std::string& new_log_level);
    void update_thresholds(double cpu, double mem, double collect);

    std::vector<ProcessInfo> get_processes() const;
    void set_processes(std::vector<ProcessInfo> procs);

    std::vector<AlertEntry> get_alerts() const;
    std::vector<AlertEntry> active_alerts() const;

    void log_info(const std::string& msg);
    void log_debug(const std::string& msg);
    void log_error(const std::string& msg);

private:
    void collect_all();
    void register_agent_metrics();
    void add_log(const std::string& level, const std::string& msg);
    void evaluate_alerts();

    Config config_;
    Registry registry_;
    std::vector<std::unique_ptr<Collector>> collectors_;
    std::unique_ptr<HttpServer> server_;

    std::atomic<bool>       running_{false};
    std::mutex              cv_mutex_;
    std::condition_variable cv_;

    std::chrono::steady_clock::time_point start_time_;

    static constexpr size_t MAX_LOG_ENTRIES = 2000;
    mutable std::mutex log_mutex_;
    std::deque<LogEntry> log_buffer_;

    mutable std::mutex error_mutex_;
    LastError last_error_;
    std::atomic<double> total_errors_{0.0};

    mutable std::mutex process_mutex_;
    std::vector<ProcessInfo> processes_;

    static constexpr size_t MAX_ALERT_HISTORY = 100;
    mutable std::mutex alert_mutex_;
    std::deque<AlertEntry> alert_history_;
    std::chrono::steady_clock::time_point last_cpu_alert_{};
    std::chrono::steady_clock::time_point last_mem_alert_{};
    std::chrono::steady_clock::time_point last_collect_alert_{};
};

}
