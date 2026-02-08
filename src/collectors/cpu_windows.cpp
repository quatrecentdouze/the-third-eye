#include "third_eye/collector.hpp"
#include "third_eye/registry.hpp"
#include <memory>

#ifdef _WIN32

#ifndef WIN32_LEAN_AND_MEAN
  #define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>

namespace third_eye {

/// Collects CPU utilization metrics using Windows native APIs.
///
/// CPU usage is computed from the delta of GetSystemTimes() between
/// consecutive collection cycles. The first call establishes a baseline.
class CpuCollector : public Collector {
public:
    [[nodiscard]] std::string name() const override { return "cpu"; }

    void collect(Registry& registry) override {

        registry.register_metric("the_third_eye_cpu_usage_percent",
                                 MetricType::Gauge,
                                 "Current CPU usage as a percentage (0-100).");
        registry.register_metric("the_third_eye_cpu_cores",
                                 MetricType::Gauge,
                                 "Number of logical CPU cores.");


        SYSTEM_INFO si{};
        GetSystemInfo(&si);
        registry.gauge_set("the_third_eye_cpu_cores",
                           static_cast<double>(si.dwNumberOfProcessors));


        FILETIME idle_ft{}, kernel_ft{}, user_ft{};
        if (!GetSystemTimes(&idle_ft, &kernel_ft, &user_ft)) return;

        auto to_u64 = [](const FILETIME& ft) -> uint64_t {
            return (static_cast<uint64_t>(ft.dwHighDateTime) << 32) | ft.dwLowDateTime;
        };

        uint64_t idle   = to_u64(idle_ft);
        uint64_t kernel = to_u64(kernel_ft);
        uint64_t user   = to_u64(user_ft);

        if (has_prev_) {
            uint64_t d_idle   = idle   - prev_idle_;
            uint64_t d_kernel = kernel - prev_kernel_;
            uint64_t d_user   = user   - prev_user_;

            uint64_t total = d_kernel + d_user;  // kernel includes idle time
            uint64_t busy  = total - d_idle;

            double usage = (total > 0)
                ? (static_cast<double>(busy) / static_cast<double>(total)) * 100.0
                : 0.0;

            registry.gauge_set("the_third_eye_cpu_usage_percent", usage);
        }

        prev_idle_   = idle;
        prev_kernel_ = kernel;
        prev_user_   = user;
        has_prev_    = true;
    }

private:
    bool     has_prev_    = false;
    uint64_t prev_idle_   = 0;
    uint64_t prev_kernel_ = 0;
    uint64_t prev_user_   = 0;
};

}


std::unique_ptr<third_eye::Collector> create_cpu_collector() {
    return std::make_unique<third_eye::CpuCollector>();
}

#endif // _WIN32
