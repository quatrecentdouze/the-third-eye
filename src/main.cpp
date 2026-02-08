

#include "third_eye/agent.hpp"
#include "third_eye/collector.hpp"

#include <iostream>
#include <string>
#include <cstdlib>
#include <csignal>
#include <memory>
#include <vector>

#ifdef _WIN32
  #ifndef WIN32_LEAN_AND_MEAN
    #define WIN32_LEAN_AND_MEAN
  #endif
  #include <windows.h>
#endif


#ifdef _WIN32
extern std::unique_ptr<third_eye::Collector> create_cpu_collector();
extern std::unique_ptr<third_eye::Collector> create_memory_collector();
extern std::unique_ptr<third_eye::Collector> create_system_collector();
#endif


static third_eye::Agent* g_agent = nullptr;

#ifdef _WIN32
static BOOL WINAPI console_handler(DWORD event) {
    if (event == CTRL_C_EVENT || event == CTRL_CLOSE_EVENT) {
        if (g_agent) g_agent->stop();
        return TRUE;
    }
    return FALSE;
}
#endif

static void signal_handler(int sig) {
    (void)sig;
    if (g_agent) g_agent->stop();
}



static std::string get_arg(int argc, char* argv[],
                           const std::string& flag,
                           const std::string& env_name,
                           const std::string& default_val) {

    for (int i = 1; i < argc - 1; ++i) {
        if (std::string(argv[i]) == flag) {
            return std::string(argv[i + 1]);
        }
    }

    const char* env = std::getenv(env_name.c_str());
    if (env && env[0] != '\0') return std::string(env);

    return default_val;
}

static bool has_flag(int argc, char* argv[], const std::string& flag) {
    for (int i = 1; i < argc; ++i) {
        if (std::string(argv[i]) == flag) return true;
    }
    return false;
}



int main(int argc, char* argv[]) {

    if (has_flag(argc, argv, "--help") || has_flag(argc, argv, "-h")) {
        std::cout << "the-third-eye v1.0.0 — System monitoring agent\n\n"
                  << "Usage: the_third_eye [options]\n\n"
                  << "Options:\n"
                  << "  --port <int>          HTTP port for /metrics (default: 9100, env: TTE_PORT)\n"
                  << "  --interval <sec>      Collection interval in seconds (default: 1, env: TTE_INTERVAL)\n"
                  << "  --log-level <level>   Log level: info|debug (default: info, env: TTE_LOG_LEVEL)\n"
                  << "  --help, -h            Show this help\n";
        return 0;
    }


    third_eye::Agent::Config config;

    auto port_str     = get_arg(argc, argv, "--port",      "TTE_PORT",      "9100");
    auto interval_str = get_arg(argc, argv, "--interval",  "TTE_INTERVAL",  "1");
    auto log_str      = get_arg(argc, argv, "--log-level", "TTE_LOG_LEVEL", "info");

    try {
        config.port     = static_cast<uint16_t>(std::stoi(port_str));
        config.interval = std::stoi(interval_str);
    } catch (...) {
        std::cerr << "Error: invalid --port or --interval value.\n";
        return 1;
    }

    if (config.interval <= 0) {
        std::cerr << "Error: --interval must be > 0.\n";
        return 1;
    }

    config.log_level = (log_str == "debug")
        ? third_eye::LogLevel::Debug
        : third_eye::LogLevel::Info;


    third_eye::Agent agent(config);
    g_agent = &agent;


    std::signal(SIGINT,  signal_handler);
    std::signal(SIGTERM, signal_handler);

#ifdef _WIN32
    SetConsoleCtrlHandler(console_handler, TRUE);
#endif


#ifdef _WIN32
    agent.add_collector(create_cpu_collector());
    agent.add_collector(create_memory_collector());
    agent.add_collector(create_system_collector());
#else
    agent.log_info("No collectors available for this platform yet.");
#endif


    agent.run();

    g_agent = nullptr;
    return 0;
}
