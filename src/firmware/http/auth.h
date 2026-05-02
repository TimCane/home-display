#pragma once

class AsyncWebServerRequest;

namespace http {

// Returns true iff the request carries `Authorization: Bearer <EPD_TOKEN>`.
bool check_bearer(AsyncWebServerRequest* req);

}  // namespace http
