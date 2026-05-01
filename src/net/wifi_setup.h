#pragma once

namespace net {

// Connects to WiFi using build-flag credentials, registers a reconnect
// handler, and starts mDNS. Blocks until association succeeds (or reboots
// the device on timeout).
void connect_and_advertise();

}  // namespace net
