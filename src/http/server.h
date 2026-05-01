#pragma once

namespace app {
class RefreshMachine;
}

namespace http {

// Wires up POST /fb and GET /status against the supplied state machine,
// then starts the underlying AsyncWebServer. The body of POST /fb is streamed
// directly to the panel via the machine; there is no in-RAM framebuffer.
void start(app::RefreshMachine& machine);

}  // namespace http
