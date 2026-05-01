#include "server.h"

#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <WiFi.h>
#include <esp_system.h>
#include <cstring>

#include "../app/refresh_machine.h"
#include "../config/build_config.h"
#include "../display/epd.h"
#include "auth.h"

namespace http {
namespace {

AsyncWebServer server(config::http_port);

uint8_t* const* g_segments      = nullptr;
size_t          g_segment_count = 0;
size_t          g_segment_bytes = 0;
size_t          g_total_bytes   = 0;

// All response decisions accumulate into this struct during the body callback;
// the actual req->send() call happens once in the request handler. Calling
// req->send() from inside the body callback can race with the framework still
// receiving chunks, leaving the connection closed without a response (curl 52
// "Empty reply from server"), so we never do it that way.
struct ReqState {
    enum class Status {
        OK,           // body accepted; commit on completion
        BadAuth,      // 401
        BadLength,    // 400 — Content-Length wrong
        Busy,         // 503 — another upload mid-stream
        TooLarge,     // 413 — body exceeded Content-Length
    };

    Status status      = Status::OK;
    bool   draining    = true;   // true until status flips away from OK
    bool   stream_open = false;  // begin_stream succeeded; abort_stream owed on error
    size_t received    = 0;
};

void copy_into_segments(size_t offset, const uint8_t* src, size_t len) {
    while (len > 0) {
        const size_t seg_idx = offset / g_segment_bytes;
        const size_t seg_off = offset % g_segment_bytes;
        const size_t avail   = g_segment_bytes - seg_off;
        const size_t take    = len < avail ? len : avail;
        std::memcpy(g_segments[seg_idx] + seg_off, src, take);
        src    += take;
        offset += take;
        len    -= take;
    }
}

const char* status_str(app::RefreshStatus s) {
    switch (s) {
        case app::RefreshStatus::None:        return "none";
        case app::RefreshStatus::Ok:          return "ok";
        case app::RefreshStatus::Timeout:     return "timeout";
        case app::RefreshStatus::NotStarted:  return "not_started";
    }
    return "unknown";
}

void handle_fb_complete(AsyncWebServerRequest* req,
                        app::RefreshMachine& machine) {
    auto* st = static_cast<ReqState*>(req->_tempObject);
    req->_tempObject = nullptr;
    if (!st) {
        // Should never happen — body callback always allocates the state.
        req->send(500, "text/plain", "no state\n");
        return;
    }

    const ReqState::Status status      = st->status;
    const bool             stream_open = st->stream_open;
    const size_t           received    = st->received;
    delete st;

    switch (status) {
        case ReqState::Status::BadAuth:
            req->send(401, "text/plain", "unauthorized\n");
            return;
        case ReqState::Status::BadLength:
            req->send(400, "text/plain", "bad length\n");
            return;
        case ReqState::Status::Busy:
            req->send(503, "text/plain", "busy\n");
            return;
        case ReqState::Status::TooLarge:
            if (stream_open) machine.abort_stream();
            req->send(413, "text/plain", "too large\n");
            return;
        case ReqState::Status::OK:
            break;
    }

    if (received != g_total_bytes) {
        if (stream_open) machine.abort_stream();
        req->send(400, "text/plain", "short body\n");
        return;
    }

    switch (machine.commit_stream()) {
        case app::RefreshMachine::CommitResult::Accepted:
            req->send(200, "application/json", "{\"status\":\"accepted\"}\n");
            return;
        case app::RefreshMachine::CommitResult::Queued:
            req->send(200, "application/json", "{\"status\":\"queued\"}\n");
            return;
        case app::RefreshMachine::CommitResult::Failed:
            req->send(500, "text/plain", "panel refresh did not start\n");
            return;
    }
}

void handle_fb_body(AsyncWebServerRequest* req,
                    uint8_t* data, size_t len, size_t index, size_t total,
                    app::RefreshMachine& machine) {
    if (index == 0) {
        auto* st         = new ReqState();
        req->_tempObject = st;

        // If the client TCP-disconnects mid-body, the complete handler never
        // runs. Without this we'd leak ReqState and leave the state machine
        // stuck in UPLOADING. tick()'s upload_stale_timeout_ms is the
        // backstop; this is the prompt path.
        req->onDisconnect([req, &machine]() {
            auto* leftover =
                static_cast<ReqState*>(req->_tempObject);
            req->_tempObject = nullptr;
            if (!leftover) return;
            if (leftover->stream_open) machine.abort_stream();
            delete leftover;
        });

        if (!check_bearer(req)) {
            st->status   = ReqState::Status::BadAuth;
            st->draining = false;
            return;
        }
        if (total != g_total_bytes) {
            st->status   = ReqState::Status::BadLength;
            st->draining = false;
            return;
        }
        if (machine.begin_stream() ==
            app::RefreshMachine::BeginResult::Busy) {
            st->status   = ReqState::Status::Busy;
            st->draining = false;
            return;
        }
        st->stream_open = true;
    }

    auto* st = static_cast<ReqState*>(req->_tempObject);
    if (!st || !st->draining || st->status != ReqState::Status::OK) return;

    if (index + len > g_total_bytes) {
        st->status   = ReqState::Status::TooLarge;
        st->draining = false;
        return;
    }
    copy_into_segments(index, data, len);
    st->received += len;
}

void handle_status(AsyncWebServerRequest* req,
                   app::RefreshMachine& machine) {
    if (!check_bearer(req)) {
        req->send(401, "text/plain", "unauthorized\n");
        return;
    }
    char buf[640];
    snprintf(buf, sizeof(buf),
             "{\"state\":\"%s\",\"cooldown_remaining_s\":%lu,"
             "\"last_refresh_uptime_s\":%lu,\"last_refresh_status\":\"%s\","
             "\"pending_frame\":%s,"
             "\"refresh_ok_count\":%lu,\"refresh_timeout_count\":%lu,"
             "\"refresh_not_started_count\":%lu,\"queued_count\":%lu,"
             "\"consecutive_failures\":%lu,"
             "\"uptime_s\":%lu,\"free_heap\":%u,\"min_free_heap\":%u,"
             "\"rssi\":%d}",
             machine.state() == app::State::IDLE       ? "idle"
             : machine.state() == app::State::UPLOADING ? "uploading"
             : machine.state() == app::State::REFRESHING ? "refreshing"
                                                         : "cooldown",
             machine.cooldown_remaining_s(),
             machine.last_refresh_uptime_s(),
             status_str(machine.last_refresh_status()),
             machine.pending_frame() ? "true" : "false",
             machine.refresh_ok_count(),
             machine.refresh_timeout_count(),
             machine.refresh_not_started_count(),
             machine.queued_count(),
             machine.consecutive_failures(),
             millis() / 1000UL,
             ESP.getFreeHeap(),
             (unsigned)esp_get_minimum_free_heap_size(),
             WiFi.RSSI());
    req->send(200, "application/json", buf);
}

}  // namespace

void start(app::RefreshMachine& machine,
           std::uint8_t* const*  segments,
           std::size_t           segment_count,
           std::size_t           segment_bytes) {
    g_segments      = segments;
    g_segment_count = segment_count;
    g_segment_bytes = segment_bytes;
    g_total_bytes   = segment_count * segment_bytes;

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
