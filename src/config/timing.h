#pragma once

namespace config {

// Cooldown enforced after every refresh, to protect panel lifespan.
constexpr unsigned long cooldown_ms = 5UL * 60UL * 1000UL;

// Hard upper bound on a single refresh. If BUSY hasn't released by then,
// we treat the panel as hung, sleep it, and force the state machine forward.
constexpr unsigned long refresh_timeout_ms = 60UL * 1000UL;

// Max time we wait for WiFi association at boot before giving up and rebooting.
constexpr unsigned long wifi_connect_timeout_ms = 30UL * 1000UL;

// SPI clock for the panel.
constexpr unsigned long spi_hz = 10UL * 1000UL * 1000UL;

}  // namespace config
