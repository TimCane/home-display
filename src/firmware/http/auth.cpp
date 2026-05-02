#include "auth.h"

#include <ESPAsyncWebServer.h>

#include "../config/build_config.h"

namespace http {

bool check_bearer(AsyncWebServerRequest* req) {
    if (!req->hasHeader("Authorization")) return false;
    static const String expected = String("Bearer ") + config::token;
    return req->header("Authorization") == expected;
}

}  // namespace http
