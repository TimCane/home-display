#include <Arduino.h>

#include "app/refresh_machine.h"
#include "config/timing.h"
#include "display/epd.h"
#include "display/epd_panel.h"
#include "http/server.h"
#include "net/wifi_setup.h"

namespace {
display::EpdPanel   panel;
app::RefreshMachine machine(panel,
                            []() -> unsigned long { return millis(); },
                            config::cooldown_ms,
                            config::refresh_timeout_ms);
}  // namespace

void setup() {
    Serial.begin(115200);
    delay(100);

    display::begin();
    net::connect_and_advertise();
    http::start(machine);
    Serial.println("ready");
}

void loop() {
    machine.tick();
    delay(1);
}
