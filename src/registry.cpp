#include "third_eye/registry.hpp"

#include <sstream>
#include <iomanip>
#include <cmath>
#include <mutex>
#include <locale>

namespace third_eye {

void Registry::register_metric(const std::string& name, MetricType type, const std::string& help) {
    std::unique_lock lock(mutex_);
    if (metrics_.contains(name)) return;
    order_.push_back(name);
    // Create with a default unlabeled series (value 0) so it always appears in snapshot
    metrics_[name] = MetricEntry{type, help, {MetricSeries{"", 0.0}}};
}

MetricSeries* Registry::find_or_create_series(const std::string& name, const std::string& labels) {
    auto it = metrics_.find(name);
    if (it == metrics_.end()) return nullptr;

    for (auto& s : it->second.series) {
        if (s.labels == labels) return &s;
    }
    it->second.series.push_back(MetricSeries{labels, 0.0});
    return &it->second.series.back();
}

void Registry::gauge_set(const std::string& name, double value) {
    gauge_set(name, "", value);
}

void Registry::gauge_set(const std::string& name, const std::string& labels, double value) {
    std::unique_lock lock(mutex_);
    auto* s = find_or_create_series(name, labels);
    if (s) s->value = value;
}

void Registry::gauge_replace_all(const std::string& name,
                                  const std::vector<std::pair<std::string, double>>& entries) {
    std::unique_lock lock(mutex_);
    auto it = metrics_.find(name);
    if (it == metrics_.end()) return;

    std::vector<MetricSeries> new_series;
    new_series.reserve(entries.size());
    for (const auto& [labels, value] : entries) {
        new_series.push_back(MetricSeries{labels, value});
    }
    it->second.series = std::move(new_series);
}

void Registry::counter_inc(const std::string& name, double delta) {
    counter_inc(name, "", delta);
}

void Registry::counter_inc(const std::string& name, const std::string& labels, double delta) {
    std::unique_lock lock(mutex_);
    auto it = metrics_.find(name);
    if (it == metrics_.end() || it->second.type != MetricType::Counter) return;
    auto* s = find_or_create_series(name, labels);
    if (s) s->value += delta;
}

std::string Registry::serialize() const {
    std::shared_lock lock(mutex_);
    std::ostringstream out;
    out.imbue(std::locale::classic());
    out << std::fixed << std::setprecision(6);

    for (const auto& name : order_) {
        auto it = metrics_.find(name);
        if (it == metrics_.end()) continue;

        const auto& entry = it->second;
        const char* type_str = (entry.type == MetricType::Gauge) ? "gauge" : "counter";

        out << "# HELP " << name << " " << entry.help << "\n";
        out << "# TYPE " << name << " " << type_str << "\n";

        for (const auto& s : entry.series) {
            out << name << s.labels << " ";
            double val = s.value;
            if (val == std::floor(val) && std::abs(val) < 1e15) {
                out << static_cast<long long>(val);
            } else {
                out << val;
            }
            out << "\n";
        }
    }

    return out.str();
}

std::vector<MetricSnapshot> Registry::snapshot() const {
    std::shared_lock lock(mutex_);
    std::vector<MetricSnapshot> result;
    for (const auto& name : order_) {
        auto it = metrics_.find(name);
        if (it == metrics_.end()) continue;
        for (const auto& s : it->second.series) {
            result.push_back({name, s.labels, s.value});
        }
    }
    return result;
}

}
