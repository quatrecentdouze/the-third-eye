#include "third_eye/collector.hpp"
#include "third_eye/registry.hpp"
#include <memory>
#include <string>

#ifdef _WIN32

#ifndef WIN32_LEAN_AND_MEAN
  #define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>
#include <chrono>


#ifndef THIRD_EYE_VERSION
  #define THIRD_EYE_VERSION "1.0.0"
#endif
#ifndef THIRD_EYE_GIT_COMMIT
  #define THIRD_EYE_GIT_COMMIT "unknown"
#endif
#ifndef THIRD_EYE_PLATFORM
  #define THIRD_EYE_PLATFORM "windows"
#endif
#ifndef THIRD_EYE_COMPILER
  #define THIRD_EYE_COMPILER "unknown"
#endif

namespace third_eye {


class SystemCollector : public Collector {
public:
    [[nodiscard]] std::string name() const override { return "system"; }

    void collect(Registry& registry) override {

        registry.register_metric("the_third_eye_build_info",
                                 MetricType::Gauge,
                                 "Build and version info (value is always 1).");

        static const std::string build_labels =
            std::string(R"({version=")") + THIRD_EYE_VERSION +
            R"(",commit=")" + THIRD_EYE_GIT_COMMIT +
            R"(",platform=")" + THIRD_EYE_PLATFORM +
            R"(",compiler=")" + THIRD_EYE_COMPILER +
            R"("})";
        registry.gauge_set("the_third_eye_build_info", build_labels, 1.0);


        registry.register_metric("the_third_eye_system_uptime_seconds",
                                 MetricType::Gauge,
                                 "System uptime in seconds.");

        double uptime_s = static_cast<double>(GetTickCount64()) / 1000.0;
        registry.gauge_set("the_third_eye_system_uptime_seconds", uptime_s);


        registry.register_metric("the_third_eye_collect_timestamp_seconds",
                                 MetricType::Gauge,
                                 "Unix timestamp of the last collection cycle.");

        auto now = std::chrono::system_clock::now();
        double ts = static_cast<double>(
            std::chrono::duration_cast<std::chrono::seconds>(
                now.time_since_epoch()).count());
        registry.gauge_set("the_third_eye_collect_timestamp_seconds", ts);
    }
};

}

std::unique_ptr<third_eye::Collector> create_system_collector() {
    return std::make_unique<third_eye::SystemCollector>();
}

#endif // _WIN32
