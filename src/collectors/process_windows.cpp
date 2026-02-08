#include "third_eye/collector.hpp"
#include "third_eye/registry.hpp"
#include "third_eye/agent.hpp"
#include <memory>
#include <vector>
#include <algorithm>
#include <string>
#include <unordered_map>

#ifdef _WIN32

#ifndef WIN32_LEAN_AND_MEAN
  #define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>
#include <tlhelp32.h>
#include <psapi.h>

namespace third_eye {

struct ProcSnapshot {
    DWORD       pid;
    std::string name;
    uint64_t    kernel_time;
    uint64_t    user_time;
    uint64_t    memory_bytes;
    bool        times_valid;
};

class ProcessCollector : public Collector {
public:
    explicit ProcessCollector(int top_n, Agent* agent)
        : top_n_(std::clamp(top_n, 1, 10)), agent_(agent) {}

    [[nodiscard]] std::string name() const override { return "process"; }

    void collect(Registry& registry) override {
        registry.register_metric("the_third_eye_process_cpu_percent",
                                 MetricType::Gauge,
                                 "CPU usage percentage of a top-N process.");
        registry.register_metric("the_third_eye_process_memory_bytes",
                                 MetricType::Gauge,
                                 "Working set memory in bytes of a top-N process.");

        auto current = snapshot_processes();

        std::vector<std::pair<std::string, double>> cpu_entries;
        std::vector<std::pair<std::string, double>> mem_entries;

        if (has_prev_) {
            SYSTEM_INFO si{};
            GetSystemInfo(&si);
            int num_cpus = static_cast<int>(si.dwNumberOfProcessors);

            FILETIME idle_ft{}, kernel_ft{}, user_ft{};
            GetSystemTimes(&idle_ft, &kernel_ft, &user_ft);
            auto to_u64 = [](const FILETIME& ft) -> uint64_t {
                return (static_cast<uint64_t>(ft.dwHighDateTime) << 32) | ft.dwLowDateTime;
            };
            uint64_t sys_kernel = to_u64(kernel_ft);
            uint64_t sys_user   = to_u64(user_ft);
            uint64_t sys_total  = (sys_kernel - prev_sys_kernel_) + (sys_user - prev_sys_user_);

            prev_sys_kernel_ = sys_kernel;
            prev_sys_user_   = sys_user;

            struct ProcCpu {
                DWORD pid;
                std::string name;
                double cpu_pct;
                uint64_t mem;
            };
            std::vector<ProcCpu> computed;
            computed.reserve(current.size());

            for (const auto& proc : current) {
                if (!proc.times_valid) continue;

                auto prev_it = prev_times_.find(proc.pid);
                if (prev_it != prev_times_.end()) {
                    uint64_t d_k = proc.kernel_time - prev_it->second.first;
                    uint64_t d_u = proc.user_time   - prev_it->second.second;
                    double pct = 0.0;
                    if (sys_total > 0) {
                        pct = static_cast<double>(d_k + d_u) / static_cast<double>(sys_total) * 100.0 * num_cpus;
                    }
                    if (pct < 0) pct = 0;
                    if (pct > 100.0 * num_cpus) pct = 100.0 * num_cpus;
                    computed.push_back({proc.pid, proc.name, pct, proc.memory_bytes});
                }
            }

            std::sort(computed.begin(), computed.end(),
                      [](const ProcCpu& a, const ProcCpu& b) { return a.cpu_pct > b.cpu_pct; });

            int n = std::min(top_n_, static_cast<int>(computed.size()));
            std::unordered_map<DWORD, bool> selected;

            std::vector<ProcessInfo> top_procs;

            for (int i = 0; i < n; ++i) {
                const auto& p = computed[i];
                std::string lbl = R"({pid=")" + std::to_string(p.pid) +
                                  R"(",process=")" + p.name + R"("})";
                cpu_entries.push_back({lbl, p.cpu_pct});
                selected[p.pid] = true;
                top_procs.push_back({static_cast<uint32_t>(p.pid), p.name, p.cpu_pct, p.mem});
            }

            std::sort(computed.begin(), computed.end(),
                      [](const ProcCpu& a, const ProcCpu& b) { return a.mem > b.mem; });

            for (int i = 0; i < static_cast<int>(computed.size()) && static_cast<int>(mem_entries.size()) < top_n_; ++i) {
                const auto& p = computed[i];
                std::string lbl = R"({pid=")" + std::to_string(p.pid) +
                                  R"(",process=")" + p.name + R"("})";
                mem_entries.push_back({lbl, static_cast<double>(p.mem)});
                if (!selected.count(p.pid)) {
                    top_procs.push_back({static_cast<uint32_t>(p.pid), p.name, p.cpu_pct, p.mem});
                }
            }

            std::sort(top_procs.begin(), top_procs.end(),
                      [](const ProcessInfo& a, const ProcessInfo& b) { return a.cpu_percent > b.cpu_percent; });

            if (agent_) agent_->set_processes(std::move(top_procs));
        } else {
            FILETIME idle_ft{}, kernel_ft{}, user_ft{};
            GetSystemTimes(&idle_ft, &kernel_ft, &user_ft);
            auto to_u64 = [](const FILETIME& ft) -> uint64_t {
                return (static_cast<uint64_t>(ft.dwHighDateTime) << 32) | ft.dwLowDateTime;
            };
            prev_sys_kernel_ = to_u64(kernel_ft);
            prev_sys_user_   = to_u64(user_ft);
        }

        prev_times_.clear();
        for (const auto& proc : current) {
            if (proc.times_valid) {
                prev_times_[proc.pid] = {proc.kernel_time, proc.user_time};
            }
        }
        has_prev_ = true;

        registry.gauge_replace_all("the_third_eye_process_cpu_percent", cpu_entries);
        registry.gauge_replace_all("the_third_eye_process_memory_bytes", mem_entries);
    }

private:
    std::vector<ProcSnapshot> snapshot_processes() {
        std::vector<ProcSnapshot> result;

        HANDLE snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if (snap == INVALID_HANDLE_VALUE) return result;

        PROCESSENTRY32W pe{};
        pe.dwSize = sizeof(pe);

        if (Process32FirstW(snap, &pe)) {
            do {
                if (pe.th32ProcessID == 0) continue;

                char name_buf[260]{};
                WideCharToMultiByte(CP_UTF8, 0, pe.szExeFile, -1, name_buf, sizeof(name_buf), nullptr, nullptr);
                std::string pname(name_buf);

                if (pname == "System Idle Process" || pname == "[System Process]") continue;

                ProcSnapshot ps{};
                ps.pid  = pe.th32ProcessID;
                ps.name = pname;
                ps.times_valid = false;

                HANDLE hProc = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_VM_READ, FALSE, pe.th32ProcessID);
                if (hProc) {
                    FILETIME create_ft{}, exit_ft{}, kernel_ft{}, user_ft{};
                    if (GetProcessTimes(hProc, &create_ft, &exit_ft, &kernel_ft, &user_ft)) {
                        auto to_u64 = [](const FILETIME& ft) -> uint64_t {
                            return (static_cast<uint64_t>(ft.dwHighDateTime) << 32) | ft.dwLowDateTime;
                        };
                        ps.kernel_time = to_u64(kernel_ft);
                        ps.user_time   = to_u64(user_ft);
                        ps.times_valid = true;
                    }

                    PROCESS_MEMORY_COUNTERS pmc{};
                    pmc.cb = sizeof(pmc);
                    if (GetProcessMemoryInfo(hProc, &pmc, sizeof(pmc))) {
                        ps.memory_bytes = pmc.WorkingSetSize;
                    }
                    CloseHandle(hProc);
                }

                result.push_back(std::move(ps));
            } while (Process32NextW(snap, &pe));
        }

        CloseHandle(snap);
        return result;
    }

    int top_n_;
    Agent* agent_;
    bool has_prev_ = false;
    uint64_t prev_sys_kernel_ = 0;
    uint64_t prev_sys_user_   = 0;
    std::unordered_map<DWORD, std::pair<uint64_t, uint64_t>> prev_times_;
};

}

std::unique_ptr<third_eye::Collector> create_process_collector(int top_n, third_eye::Agent* agent) {
    return std::make_unique<third_eye::ProcessCollector>(top_n, agent);
}

#endif // _WIN32
