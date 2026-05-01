#include "server.h"

#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <WiFi.h>

#include "../app/refresh_machine.h"
#include "../config/build_config.h"
#include "../display/epd.h"
#include "auth.h"

namespace http {
namespace {

AsyncWebServer server(config::http_port);

struct ReqState {
    bool   accepted = false;
    size_t received = 0;
};

void handle_fb_complete(AsyncWebServerRequest* req,
                        app::RefreshMachine& machine) {
    auto* st = static_cast<ReqState*>(req->_tempObject);
    req->_tempObject = nullptr;
    if (!st) return;
    if (!st->accepted) {
        delete st;
        return;  // response already sent from body callback
    }

    const bool ok = (st->received == display::FRAME_BYTES);
    delete st;

    if (!ok) {
        machine.abort_stream();
        req->send(400, "text/plain", "short body\n");
        return;
    }
    machine.commit_stream();
    req->send(200, "application/json", "{\"status\":\"accepted\"}\n");
}

void handle_fb_body(AsyncWebServerRequest* req,
                    uint8_t* data, size_t len, size_t index, size_t total,
                    app::RefreshMachine& machine) {
    if (index == 0) {
        auto* st         = new ReqState();
        req->_tempObject = st;

        if (!check_bearer(req)) {
            req->send(401, "text/plain", "unauthorized\n");
            return;
        }
        if (total != display::FRAME_BYTES) {
            req->send(400, "text/plain", "bad length\n");
            return;
        }
        if (machine.begin_stream() == app::RefreshMachine::StreamResult::Busy) {
            req->send(503, "text/plain", "busy\n");
            return;
        }
        st->accepted = true;
    }

    auto* st = static_cast<ReqState*>(req->_tempObject);
    if (!st || !st->accepted) return;

    if (index + len > display::FRAME_BYTES) {
        st->accepted = false;
        machine.abort_stream();
        req->send(413, "text/plain", "too large\n");
        return;
    }
    if (!machine.write_stream_chunk(data, len)) {
        st->accepted = false;
        machine.abort_stream();
        req->send(500, "text/plain", "write failed\n");
        return;
    }
    st->received += len;
}

void handle_status(AsyncWebServerRequest* req,
                   app::RefreshMachine& machine) {
    if (!check_bearer(req)) {
        req->send(401, "text/plain", "unauthorized\n");
        return;
    }
    char buf[320];
    snprintf(buf, sizeof(buf),
             "{\"busy\":%s,\"cooldown_remaining_s\":%lu,"
             "\"last_refresh_uptime_s\":%lu,\"last_refresh_timed_out\":%s,"
             "\"uptime_s\":%lu,\"free_heap\":%u,\"rssi\":%d}",
             machine.state() == app::State::REFRESHING ? "true" : "false",
             machine.cooldown_remaining_s(),
             machine.last_refresh_uptime_s(),
             machine.last_refresh_timed_out() ? "true" : "false",
             millis() / 1000UL,
             ESP.getFreeHeap(),
             WiFi.RSSI());
    req->send(200, "application/json", buf);
}

}  // namespace

void start(app::RefreshMachine& machine) {
    server.on(
        "/fb", HTTP_POST,
        [&machine](AsyncWebServerRequest* req) {
            handle_fb_complete(req, machine);
        },
        nullptr,
        [&machine](AsyncWebServerRequest* req,
                   uint8_t* data, size_t len, size_t index, size_t total) {
            handle_fb_body(req, data, len, index, total, machine);
        });

    server.on("/status", HTTP_GET,
              [&machine](AsyncWebServerRequest* req) {
                  handle_status(req, machine);
              });

    server.onNotFound([](AsyncWebServerRequest* req) {
        req->send(404, "text/plain", "not found\n");
    });

    server.begin();
}

}  // namespace http
