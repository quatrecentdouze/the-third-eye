#include "third_eye/agent.hpp"

#include <iostream>
#include <chrono>
#include <iomanip>
#include <sstream>

namespace third_eye {

static std::string timestamp_now() {
    auto now = std::chrono::system_clock::now();
    auto t   = std::chrono::system_clock::to_time_t(now);
    std::tm tm_buf{};
#ifdef _WIN32
    localtime_s(&tm_buf, &t);
#else
    localtime_r(&t, &tm_buf);
#endif
    std::ostringstream oss;
    oss << std::put_time(&tm_buf, "%Y-%m-%d %H:%M:%S");
    return oss.str();
}

void Agent::add_log(const std::string& level, const std::string& msg) {
    auto ts = timestamp_now();
    if (level == "ERROR") {
        std::cerr << "[" << ts << "] [" << level << "] " << msg << "\n";
    } else {
        std::cout << "[" << ts << "] [" << level << "]  " << msg << "\n";
    }
    std::lock_guard lock(log_mutex_);
    log_buffer_.push_back({ts, level, msg});
    while (log_buffer_.size() > MAX_LOG_ENTRIES) {
        log_buffer_.pop_front();
    }
}

void Agent::log_info(const std::string& msg)  { add_log("INFO", msg); }
void Agent::log_debug(const std::string& msg) {
    if (config_.log_level == LogLevel::Debug) add_log("DEBUG", msg);
}
void Agent::log_error(const std::string& msg) { add_log("ERROR", msg); }

std::vector<LogEntry> Agent::get_logs(const std::string& level_filter, int limit) const {
    std::lock_guard lock(log_mutex_);
    std::vector<LogEntry> result;
    int count = 0;
    for (auto it = log_buffer_.rbegin(); it != log_buffer_.rend() && count < limit; ++it) {
        if (level_filter.empty() || it->level == level_filter) {
            result.push_back(*it);
            ++count;
        }
    }
    std::reverse(result.begin(), result.end());
    return result;
}

void Agent::update_config(int new_interval, const std::string& new_log_level) {
    if (new_interval > 0) config_.interval = new_interval;
    if (new_log_level == "debug") {
        config_.log_level = LogLevel::Debug;
    } else if (new_log_level == "info") {
        config_.log_level = LogLevel::Info;
    }
    log_info("Config updated: interval=" + std::to_string(config_.interval) +
             " log_level=" + (config_.log_level == LogLevel::Debug ? "debug" : "info"));
}

LastError Agent::last_error() const {
    std::lock_guard lock(error_mutex_);
    return last_error_;
}

std::string Agent::compute_health() const {
    if (total_errors_.load() > 0.0) return "unhealthy";

    auto snap = registry_.snapshot();
    for (const auto& m : snap) {
        if (m.name == "the_third_eye_collect_duration_seconds" && m.labels.empty()) {
            if (m.value > 2.0) return "degraded";
        }
        if (m.name == "the_third_eye_scrape_duration_seconds" && m.labels.empty()) {
            if (m.value > 1.0) return "degraded";
        }
    }
    return "healthy";
}

Agent::Agent(Config config)
    : config_(config)
    , start_time_(std::chrono::steady_clock::now()) {}

Agent::~Agent() { stop(); }

void Agent::add_collector(std::unique_ptr<Collector> collector) {
    log_debug("Registered collector: " + collector->name());
    collectors_.push_back(std::move(collector));
}

void Agent::register_agent_metrics() {
    registry_.register_metric("the_third_eye_collect_duration_seconds",
                              MetricType::Gauge, "Total duration of a collection cycle in seconds.");
    registry_.register_metric("the_third_eye_collector_duration_seconds",
                              MetricType::Gauge, "Duration of a single collector in seconds.");
    registry_.register_metric("the_third_eye_collect_errors_total",
                              MetricType::Counter, "Total number of collection errors per collector.");
    registry_.register_metric("the_third_eye_agent_uptime_seconds",
                              MetricType::Gauge, "Agent uptime in seconds.");
    registry_.register_metric("the_third_eye_scrape_duration_seconds",
                              MetricType::Gauge, "Duration of the last /metrics scrape generation in seconds.");
    registry_.register_metric("the_third_eye_http_requests_total",
                              MetricType::Counter, "Total HTTP requests received.");
}

void Agent::run() {
    log_info("The Third Eye agent v" THIRD_EYE_VERSION " starting");
    log_info("  Port:     " + std::to_string(config_.port));
    log_info("  Interval: " + std::to_string(config_.interval) + "s");
    log_info("  Log level: " + std::string(config_.log_level == LogLevel::Debug ? "debug" : "info"));
    log_info("  Collectors: " + std::to_string(collectors_.size()));

    register_agent_metrics();

    server_ = std::make_unique<HttpServer>(config_.port, [this]() {
        auto scrape_start = std::chrono::steady_clock::now();

        auto agent_elapsed = std::chrono::steady_clock::now() - start_time_;
        registry_.gauge_set("the_third_eye_agent_uptime_seconds",
                            std::chrono::duration<double>(agent_elapsed).count());

        std::string body = registry_.serialize();

        auto scrape_s = std::chrono::duration<double>(
            std::chrono::steady_clock::now() - scrape_start).count();
        registry_.gauge_set("the_third_eye_scrape_duration_seconds", scrape_s);

        return body;
    }, &registry_, this);

    try {
        server_->start();
        log_info("HTTP server listening on http://127.0.0.1:" + std::to_string(config_.port));
    } catch (const std::exception& e) {
        log_error(std::string("Failed to start HTTP server: ") + e.what());
        return;
    }

    running_.store(true);
    collect_all();

    while (running_.load()) {
        std::unique_lock lock(cv_mutex_);
        cv_.wait_for(lock, std::chrono::seconds(config_.interval), [this] {
            return !running_.load();
        });
        if (!running_.load()) break;
        collect_all();
    }

    log_info("Shutting down...");
    if (server_) server_->stop();
    log_info("The Third Eye agent stopped.");
}

void Agent::stop() {
    bool expected = true;
    if (running_.compare_exchange_strong(expected, false)) {
        cv_.notify_all();
    }
}

void Agent::collect_all() {
    log_debug("Starting metric collection cycle");
    auto cycle_start = std::chrono::steady_clock::now();

    for (auto& collector : collectors_) {
        auto col_start = std::chrono::steady_clock::now();
        std::string label = R"({collector=")" + collector->name() + R"("})";

        try {
            collector->collect(registry_);
            double col_s = std::chrono::duration<double>(
                std::chrono::steady_clock::now() - col_start).count();
            registry_.gauge_set("the_third_eye_collector_duration_seconds", label, col_s);
            log_debug("  Collector [" + collector->name() + "] OK");
        } catch (const std::exception& e) {
            std::string err_msg = e.what();
            log_error("Collector [" + collector->name() + "] failed: " + err_msg);
            registry_.counter_inc("the_third_eye_collect_errors_total", label, 1.0);
            total_errors_.store(total_errors_.load() + 1.0);
            {
                std::lock_guard lock(error_mutex_);
                last_error_ = { collector->name(), timestamp_now(), err_msg };
            }
        } catch (...) {
            log_error("Collector [" + collector->name() + "] failed with unknown error");
            registry_.counter_inc("the_third_eye_collect_errors_total", label, 1.0);
            total_errors_.store(total_errors_.load() + 1.0);
            {
                std::lock_guard lock(error_mutex_);
                last_error_ = { collector->name(), timestamp_now(), "unknown error" };
            }
        }
    }

    double cycle_s = std::chrono::duration<double>(
        std::chrono::steady_clock::now() - cycle_start).count();
    registry_.gauge_set("the_third_eye_collect_duration_seconds", cycle_s);

    log_debug("Collection cycle completed in " +
              std::to_string(static_cast<int>(cycle_s * 1e6)) + " us");
}

}
