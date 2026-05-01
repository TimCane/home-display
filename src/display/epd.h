#pragma once
#include <Arduino.h>

namespace display {

constexpr int    WIDTH       = 960;
constexpr int    HEIGHT      = 680;
constexpr size_t FRAME_BYTES = (size_t)WIDTH * HEIGHT / 4;  // 163,200

// The 163KB framebuffer can't be allocated as a single contiguous block on
// this ESP32 (no PSRAM, and dram0_0_seg is ~124KB). The buffer is split into
// FB_SEGMENTS heap allocations; the upload path fills them in order, and
// commit_stream feeds them to the panel back-to-back through the SSD2677
// data window — the inter-segment gap is just a function call, well below
// any inter-byte timing the panel already tolerates.
constexpr size_t FB_SEGMENTS     = 2;
constexpr size_t FB_SEGMENT_BYTES = FRAME_BYTES / FB_SEGMENTS;
static_assert(FRAME_BYTES % FB_SEGMENTS == 0, "FRAME_BYTES must divide evenly");

void begin();
void begin_frame();
void write_chunk(const uint8_t* data, size_t len);
void end_frame();
// Returns true once BUSY drops (panel started refreshing), false if it
// never drops within the deadline (refresh did not begin).
bool start_refresh();
bool is_busy();
void sleep();

}  // namespace display
