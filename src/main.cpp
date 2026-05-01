#include <Arduino.h>

#include <esp_heap_caps.h>

#include "app/refresh_machine.h"
#include "config/timing.h"
#include "display/epd.h"
#include "display/epd_panel.h"
#include "http/server.h"
#include "net/wifi_setup.h"
#include "persist/counters.h"

namespace {
display::EpdPanel   panel;
app::RefreshMachine machine(panel,
                            []() -> unsigned long { return millis(); },
                            config::cooldown_ms,
                            config::refresh_timeout_ms,
                            config::upload_stale_timeout_ms);
}  // namespace

void setup() {
    Serial.begin(115200);
    delay(100);

    // Allocate the framebuffer first, before WiFi/AsyncTCP grab their heap.
    // The panel can't reliably load RAM from a chunked stream over WiFi
    // (network gaps abort the SSD2677 data session), so the upload path
    // buffers the full frame here and bulk-streams it on commit. The buffer
    // is split into FB_SEGMENTS chunks because the largest single contiguous
    // DRAM block on this ESP32 is smaller than FRAME_BYTES.
    static uint8_t* fb_segments[display::FB_SEGMENTS];
    for (size_t i = 0; i < display::FB_SEGMENTS; ++i) {
        fb_segments[i] = static_cast<uint8_t*>(
            heap_caps_malloc(display::FB_SEGMENT_BYTES, MALLOC_CAP_8BIT));
        if (!fb_segments[i]) {
            Serial.printf("FATAL: framebuffer segment %u alloc failed\n",
                          (unsigned)i);
            while (true) delay(1000);
        }
    }
    Serial.printf("fb: allocated %u segments of %u bytes\n",
                  (unsigned)display::FB_SEGMENTS,
                  (unsigned)display::FB_SEGMENT_BYTES);

    machine.set_segments(fb_segments, display::FB_SEGMENTS,
                         display::FB_SEGMENT_BYTES);
    persist::load(machine);
    display::begin();
    net::connect_and_advertise();
    http::start(machine, fb_segments, display::FB_SEGMENTS,
                display::FB_SEGMENT_BYTES);
    Serial.println("ready");
}

void loop() {
    machine.tick();
    persist::sync(machine);
    delay(1);
}
