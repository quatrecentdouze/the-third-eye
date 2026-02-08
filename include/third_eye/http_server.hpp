#pragma once

#include <string>
#include <functional>
#include <thread>
#include <atomic>
#include <cstdint>

namespace third_eye {

class Registry;
class Agent;


class HttpServer {
public:
    using MetricsProvider = std::function<std::string()>;

    explicit HttpServer(uint16_t port, MetricsProvider provider,
                        Registry* registry = nullptr, Agent* agent = nullptr);
    ~HttpServer();

    void start();
    void stop();

private:
    void accept_loop();
    void handle_client(uintptr_t client_socket);


    void send_response(uintptr_t sock, int code, const std::string& content_type,
                       const std::string& body);
    std::string handle_api_status();
    std::string handle_api_logs(const std::string& query);
    std::string handle_api_config_post(const std::string& body);

    uint16_t        port_;
    MetricsProvider provider_;
    Registry*       registry_ = nullptr;
    Agent*          agent_    = nullptr;
    std::atomic<bool> running_{false};
    std::jthread    thread_;
    uintptr_t       listen_socket_{static_cast<uintptr_t>(-1)};
};

}
