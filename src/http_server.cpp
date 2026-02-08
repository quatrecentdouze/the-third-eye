#include "third_eye/http_server.hpp"
#include "third_eye/registry.hpp"
#include "third_eye/agent.hpp"

#include <stdexcept>
#include <string>
#include <cstring>
#include <sstream>
#include <iomanip>
#include <chrono>


#ifdef _WIN32
  #ifndef WIN32_LEAN_AND_MEAN
    #define WIN32_LEAN_AND_MEAN
  #endif
  #include <winsock2.h>
  #include <ws2tcpip.h>

  using socket_t = SOCKET;
  static constexpr socket_t INVALID_SOCK = INVALID_SOCKET;
  static void close_socket(socket_t s) { closesocket(s); }

  struct WinsockInit {
      WinsockInit() { WSADATA wsa; WSAStartup(MAKEWORD(2, 2), &wsa); }
      ~WinsockInit() { WSACleanup(); }
  };
  static WinsockInit winsock_guard;
#else
  #include <sys/socket.h>
  #include <netinet/in.h>
  #include <unistd.h>
  #include <arpa/inet.h>

  using socket_t = int;
  static constexpr socket_t INVALID_SOCK = -1;
  static void close_socket(socket_t s) { ::close(s); }
#endif


#ifndef THIRD_EYE_VERSION
  #define THIRD_EYE_VERSION "1.1.3"
#endif
#ifndef THIRD_EYE_GIT_COMMIT
  #define THIRD_EYE_GIT_COMMIT "unknown"
#endif
#ifndef THIRD_EYE_PLATFORM
  #define THIRD_EYE_PLATFORM "unknown"
#endif
#ifndef THIRD_EYE_COMPILER
  #define THIRD_EYE_COMPILER "unknown"
#endif


static std::string json_escape(const std::string& s) {
    std::string out;
    out.reserve(s.size() + 8);
    for (char c : s) {
        switch (c) {
            case '"':  out += "\\\""; break;
            case '\\': out += "\\\\"; break;
            case '\n': out += "\\n";  break;
            case '\r': out += "\\r";  break;
            case '\t': out += "\\t";  break;
            default:   out += c;
        }
    }
    return out;
}


static std::string json_double(double v) {
    std::ostringstream oss;
    oss.imbue(std::locale::classic());
    oss << std::fixed << std::setprecision(6) << v;
    // Trim trailing zeros but keep at least one decimal
    std::string s = oss.str();
    auto dot = s.find('.');
    if (dot != std::string::npos) {
        auto last = s.find_last_not_of('0');
        if (last != std::string::npos && last > dot) {
            s.erase(last + 1);
        } else if (last == dot) {
            s.erase(last + 2); // keep "X.0"
        }
    }
    return s;
}

namespace third_eye {

HttpServer::HttpServer(uint16_t port, MetricsProvider provider,
                       Registry* registry, Agent* agent)
    : port_(port), provider_(std::move(provider)), registry_(registry), agent_(agent) {}

HttpServer::~HttpServer() { stop(); }

void HttpServer::start() {
    listen_socket_ = static_cast<uintptr_t>(::socket(AF_INET, SOCK_STREAM, IPPROTO_TCP));
    if (static_cast<socket_t>(listen_socket_) == INVALID_SOCK)
        throw std::runtime_error("Failed to create listen socket");

    int opt = 1;
    setsockopt(static_cast<socket_t>(listen_socket_), SOL_SOCKET, SO_REUSEADDR,
               reinterpret_cast<const char*>(&opt), sizeof(opt));

    sockaddr_in addr{};
    addr.sin_family      = AF_INET;
    addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK); // 127.0.0.1 only
    addr.sin_port        = htons(port_);

    if (::bind(static_cast<socket_t>(listen_socket_),
               reinterpret_cast<sockaddr*>(&addr), sizeof(addr)) < 0) {
        close_socket(static_cast<socket_t>(listen_socket_));
        throw std::runtime_error("Failed to bind on port " + std::to_string(port_));
    }

    if (::listen(static_cast<socket_t>(listen_socket_), 8) < 0) {
        close_socket(static_cast<socket_t>(listen_socket_));
        throw std::runtime_error("Failed to listen on port " + std::to_string(port_));
    }

    running_.store(true);
    thread_ = std::jthread([this](std::stop_token) { accept_loop(); });
}

void HttpServer::stop() {
    if (!running_.exchange(false)) return;
    if (static_cast<socket_t>(listen_socket_) != INVALID_SOCK) {
        close_socket(static_cast<socket_t>(listen_socket_));
        listen_socket_ = static_cast<uintptr_t>(INVALID_SOCK);
    }
    if (thread_.joinable()) { thread_.request_stop(); thread_.join(); }
}

void HttpServer::accept_loop() {
    while (running_.load()) {
        auto sock = static_cast<socket_t>(listen_socket_);
        if (sock == INVALID_SOCK) break;

        fd_set read_set;
        FD_ZERO(&read_set);
        FD_SET(sock, &read_set);

        timeval timeout{};
        timeout.tv_sec  = 0;
        timeout.tv_usec = 250000;

        int sel = ::select(static_cast<int>(sock + 1), &read_set, nullptr, nullptr, &timeout);
        if (sel <= 0) continue;

        sockaddr_in client_addr{};
        int addr_len = sizeof(client_addr);
#ifdef _WIN32
        auto client = ::accept(sock, reinterpret_cast<sockaddr*>(&client_addr), &addr_len);
#else
        auto client = ::accept(sock, reinterpret_cast<sockaddr*>(&client_addr),
                               reinterpret_cast<socklen_t*>(&addr_len));
#endif
        if (client == INVALID_SOCK) continue;
        handle_client(static_cast<uintptr_t>(client));
    }
}

void HttpServer::send_response(uintptr_t sock_ptr, int code, const std::string& content_type,
                                const std::string& body) {
    auto sock = static_cast<socket_t>(sock_ptr);
    std::string status_text = (code == 200) ? "OK" : (code == 404 ? "Not Found" : "Bad Request");

    std::ostringstream resp;
    resp << "HTTP/1.1 " << code << " " << status_text << "\r\n"
         << "Content-Type: " << content_type << "\r\n"
         << "Content-Length: " << body.size() << "\r\n"
         << "Access-Control-Allow-Origin: *\r\n"
         << "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n"
         << "Access-Control-Allow-Headers: Content-Type\r\n"
         << "Connection: close\r\n"
         << "\r\n"
         << body;
    std::string out = resp.str();
    ::send(sock, out.c_str(), static_cast<int>(out.size()), 0);
    close_socket(sock);
}

void HttpServer::handle_client(uintptr_t client_socket) {
    auto sock = static_cast<socket_t>(client_socket);

    char buf[4096]{};
    int n = ::recv(sock, buf, sizeof(buf) - 1, 0);
    if (n <= 0) { close_socket(sock); return; }
    buf[n] = '\0';

    std::string request(buf, n);


    std::string method, path, query;
    {
        auto sp1 = request.find(' ');
        if (sp1 == std::string::npos) { close_socket(sock); return; }
        method = request.substr(0, sp1);
        auto sp2 = request.find(' ', sp1 + 1);
        std::string uri = request.substr(sp1 + 1, sp2 - sp1 - 1);
        auto qm = uri.find('?');
        if (qm != std::string::npos) {
            path  = uri.substr(0, qm);
            query = uri.substr(qm + 1);
        } else {
            path = uri;
        }
    }


    if (method == "OPTIONS") {
        send_response(client_socket, 200, "text/plain", "");
        return;
    }


    if (method == "GET" && path == "/metrics") {
        std::string body = provider_();
        send_response(client_socket, 200, "text/plain; version=0.0.4; charset=utf-8", body);
        if (registry_) {
            registry_->counter_inc("the_third_eye_http_requests_total",
                                   R"({code="200",path="/metrics"})", 1.0);
        }
        return;
    }


    if (method == "GET" && path == "/api/status") {
        send_response(client_socket, 200, "application/json", handle_api_status());
        if (registry_) {
            registry_->counter_inc("the_third_eye_http_requests_total",
                                   R"({code="200",path="/api/status"})", 1.0);
        }
        return;
    }


    if (method == "GET" && path == "/api/logs") {
        send_response(client_socket, 200, "application/json", handle_api_logs(query));
        return;
    }

    if (method == "GET" && path == "/api/alerts") {
        send_response(client_socket, 200, "application/json", handle_api_alerts());
        return;
    }

    if (method == "POST" && path == "/api/config") {

        std::string post_body;
        auto hdr_end = request.find("\r\n\r\n");
        if (hdr_end != std::string::npos) {
            post_body = request.substr(hdr_end + 4);
        }
        send_response(client_socket, 200, "application/json", handle_api_config_post(post_body));
        return;
    }


    send_response(client_socket, 404, "text/plain", "404 Not Found\n");
}



std::string HttpServer::handle_api_status() {
    std::ostringstream out;
    out.imbue(std::locale::classic());
    out << "{";


    out << R"("status":"running")";
    out << R"(,"version":")" << THIRD_EYE_VERSION << "\"";
    out << R"(,"commit":")" << THIRD_EYE_GIT_COMMIT << "\"";
    out << R"(,"platform":")" << THIRD_EYE_PLATFORM << "\"";
    out << R"(,"compiler":")" << THIRD_EYE_COMPILER << "\"";


    if (agent_) {
        auto& cfg = agent_->config();
        out << R"(,"port":)" << cfg.port;
        out << R"(,"interval":)" << cfg.interval;
        out << R"(,"log_level":")" << (cfg.log_level == LogLevel::Debug ? "debug" : "info") << "\"";

        // Computed live rather than from registry snapshot
        auto agent_elapsed = std::chrono::steady_clock::now() - agent_->start_time();
        double agent_uptime = std::chrono::duration<double>(agent_elapsed).count();
        out << R"(,"agent_uptime_seconds":)" << json_double(agent_uptime);

        out << R"(,"health":")" << agent_->compute_health() << "\"";

        auto le = agent_->last_error();
        if (!le.collector.empty()) {
            out << R"(,"last_error":{"collector":")" << json_escape(le.collector)
                << R"(","timestamp":")" << json_escape(le.timestamp)
                << R"(","message":")" << json_escape(le.message)
                << "\"}";
        }
    }


    if (registry_) {
        auto snap = registry_->snapshot();
        for (const auto& m : snap) {

            std::string key = m.name;
            auto pfx = key.find("the_third_eye_");
            if (pfx == 0) key = key.substr(14);


            if (!m.labels.empty()) continue;

            // Computed live above, skip registry duplicate
            if (key == "agent_uptime_seconds") continue;

            out << ",\"" << json_escape(key) << "\":" << json_double(m.value);
        }


        out << R"(,"collector_durations":{)";
        bool first = true;
        for (const auto& m : snap) {
            if (m.name == "the_third_eye_collector_duration_seconds" && !m.labels.empty()) {

                auto start = m.labels.find("=\"");
                auto end = m.labels.find("\"}", start);
                if (start != std::string::npos && end != std::string::npos) {
                    std::string col = m.labels.substr(start + 2, end - start - 2);
                    if (!first) out << ",";
                    out << "\"" << col << "\":" << json_double(m.value);
                    first = false;
                }
            }
        }
        out << "}";


        out << R"(,"collect_errors":{)";
        first = true;
        for (const auto& m : snap) {
            if (m.name == "the_third_eye_collect_errors_total" && !m.labels.empty()) {
                auto start = m.labels.find("=\"");
                auto end = m.labels.find("\"}", start);
                if (start != std::string::npos && end != std::string::npos) {
                    std::string col = m.labels.substr(start + 2, end - start - 2);
                    if (!first) out << ",";
                    out << "\"" << col << "\":" << json_double(m.value);
                    first = false;
                }
            }
        }
        out << "}";


        out << R"(,"http_requests":{)";
        first = true;
        for (const auto& m : snap) {
            if (m.name == "the_third_eye_http_requests_total" && !m.labels.empty()) {
                if (!first) out << ",";
                out << "\"" << json_escape(m.labels) << "\":" << json_double(m.value);
                first = false;
            }
        }
        out << "}";
    }

    if (agent_) {
        auto procs = agent_->get_processes();
        out << R"(,"top_processes":[)";
        for (size_t i = 0; i < procs.size(); ++i) {
            if (i > 0) out << ",";
            out << R"({"pid":)" << procs[i].pid
                << R"(,"name":")" << json_escape(procs[i].name) << "\""
                << R"(,"cpu_percent":)" << json_double(procs[i].cpu_percent)
                << R"(,"memory_bytes":)" << procs[i].memory_bytes
                << "}";
        }
        out << "]";

        auto active = agent_->active_alerts();
        out << R"(,"active_alerts_count":)" << active.size();
    }

    out << "}";
    return out.str();
}

std::string HttpServer::handle_api_logs(const std::string& query) {
    if (!agent_) return R"({"logs":[]})";


    std::string level;
    int limit = 500;
    std::istringstream qs(query);
    std::string param;
    while (std::getline(qs, param, '&')) {
        auto eq = param.find('=');
        if (eq == std::string::npos) continue;
        std::string key = param.substr(0, eq);
        std::string val = param.substr(eq + 1);
        if (key == "level") level = val;
        else if (key == "limit") {
            try { limit = std::stoi(val); } catch (...) {}
        }
    }

    auto logs = agent_->get_logs(level, limit);

    std::ostringstream out;
    out << R"({"logs":[)";
    for (size_t i = 0; i < logs.size(); ++i) {
        if (i > 0) out << ",";
        out << R"({"timestamp":")" << json_escape(logs[i].timestamp)
            << R"(","level":")" << json_escape(logs[i].level)
            << R"(","message":")" << json_escape(logs[i].message)
            << "\"}";
    }
    out << "]}";
    return out.str();
}

std::string HttpServer::handle_api_config_post(const std::string& body) {
    if (!agent_) return R"({"ok":false,"error":"agent unavailable"})";


    int interval = -1;
    std::string log_level;

    auto find_int = [&](const std::string& key) -> int {
        auto pos = body.find("\"" + key + "\"");
        if (pos == std::string::npos) return -1;
        pos = body.find(':', pos);
        if (pos == std::string::npos) return -1;
        try { return std::stoi(body.substr(pos + 1)); } catch (...) { return -1; }
    };

    auto find_str = [&](const std::string& key) -> std::string {
        auto pos = body.find("\"" + key + "\"");
        if (pos == std::string::npos) return "";
        pos = body.find('"', body.find(':', pos) + 1);
        if (pos == std::string::npos) return "";
        auto end = body.find('"', pos + 1);
        if (end == std::string::npos) return "";
        return body.substr(pos + 1, end - pos - 1);
    };

    interval  = find_int("interval");
    log_level = find_str("log_level");

    agent_->update_config(interval, log_level);

    return R"({"ok":true})";
}

std::string HttpServer::handle_api_alerts() {
    if (!agent_) return R"({"active":[],"history":[]})";

    std::ostringstream out;
    out.imbue(std::locale::classic());

    auto all = agent_->get_alerts();
    auto active = agent_->active_alerts();

    auto write_alert = [&](const auto& a, bool first) {
        if (!first) out << ",";
        out << R"({"type":")" << json_escape(a.type) << "\""
            << R"(,"severity":")" << json_escape(a.severity) << "\""
            << R"(,"message":")" << json_escape(a.message) << "\""
            << R"(,"timestamp":")" << json_escape(a.timestamp) << "\""
            << R"(,"value":)" << json_double(a.value)
            << R"(,"threshold":)" << json_double(a.threshold)
            << R"(,"active":)" << (a.active ? "true" : "false")
            << "}";
    };

    out << R"({"active":[)";
    for (size_t i = 0; i < active.size(); ++i) {
        write_alert(active[i], i == 0);
    }
    out << R"(],"history":[)";
    for (size_t i = 0; i < all.size(); ++i) {
        write_alert(all[i], i == 0);
    }
    out << "]}";

    return out.str();
}

}
