#pragma once
#include <Arduino.h>

namespace display {

constexpr int    WIDTH       = 960;
constexpr int    HEIGHT      = 680;
constexpr size_t FRAME_BYTES = (size_t)WIDTH * HEIGHT / 4;  // 163,200

void begin();
void begin_frame();
void write_chunk(const uint8_t* data, size_t len);
void end_frame();
void start_refresh();
bool is_busy();
void sleep();

}  // namespace display
