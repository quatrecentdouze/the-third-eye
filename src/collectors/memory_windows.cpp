#include "third_eye/collector.hpp"
#include "third_eye/registry.hpp"
#include <memory>

#ifdef _WIN32

#ifndef WIN32_LEAN_AND_MEAN
  #define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>

namespace third_eye {


class MemoryCollector : public Collector {
public:
    [[nodiscard]] std::string name() const override { return "memory"; }

    void collect(Registry& registry) override {
        registry.register_metric("the_third_eye_memory_total_bytes",
                                 MetricType::Gauge,
                                 "Total physical memory in bytes.");
        registry.register_metric("the_third_eye_memory_used_bytes",
                                 MetricType::Gauge,
                                 "Used physical memory in bytes.");
        registry.register_metric("the_third_eye_memory_available_bytes",
                                 MetricType::Gauge,
                                 "Available physical memory in bytes.");

        MEMORYSTATUSEX mem{};
        mem.dwLength = sizeof(mem);
        if (!GlobalMemoryStatusEx(&mem)) return;

        auto total = static_cast<double>(mem.ullTotalPhys);
        auto avail = static_cast<double>(mem.ullAvailPhys);

        registry.gauge_set("the_third_eye_memory_total_bytes", total);
        registry.gauge_set("the_third_eye_memory_available_bytes", avail);
        registry.gauge_set("the_third_eye_memory_used_bytes",  total - avail);
    }
};

}

std::unique_ptr<third_eye::Collector> create_memory_collector() {
    return std::make_unique<third_eye::MemoryCollector>();
}

#endif // _WIN32
