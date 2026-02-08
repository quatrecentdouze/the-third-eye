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

class Agent {
public:
    struct Config {
        uint16_t port      = 9100;
        int      interval  = 1;
        LogLevel log_level = LogLevel::Info;
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

    void log_info(const std::string& msg);
    void log_debug(const std::string& msg);
    void log_error(const std::string& msg);

private:
    void collect_all();
    void register_agent_metrics();
    void add_log(const std::string& level, const std::string& msg);

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
};

}
