#pragma once

#include <string>
#include <vector>
#include <utility>
#include <unordered_map>
#include <shared_mutex>

namespace third_eye {


enum class MetricType {
    Gauge,
    Counter
};


struct MetricSeries {
    std::string labels;   // Pre-formatted: {key="val",...} or empty
    double      value = 0.0;
};


struct MetricEntry {
    MetricType  type;
    std::string help;
    std::vector<MetricSeries> series;
};


struct MetricSnapshot {
    std::string name;
    std::string labels;
    double      value;
};


class Registry {
public:

    void register_metric(const std::string& name, MetricType type, const std::string& help);


    void gauge_set(const std::string& name, double value);


    void gauge_set(const std::string& name, const std::string& labels, double value);

    void gauge_replace_all(const std::string& name,
                           const std::vector<std::pair<std::string, double>>& entries);


    void counter_inc(const std::string& name, double delta = 1.0);


    void counter_inc(const std::string& name, const std::string& labels, double delta = 1.0);


    [[nodiscard]] std::string serialize() const;


    [[nodiscard]] std::vector<MetricSnapshot> snapshot() const;

private:
    MetricSeries* find_or_create_series(const std::string& name, const std::string& labels);

    mutable std::shared_mutex mutex_;
    std::vector<std::string> order_;
    std::unordered_map<std::string, MetricEntry> metrics_;
};

}
