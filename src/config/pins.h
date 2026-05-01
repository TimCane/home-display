#pragma once

// ESP32-L ↔ DESPI-C02 pin map (from ESP32-L schematic, P5 EPD DRIVE connector)
constexpr int PIN_BUSY = 13;
constexpr int PIN_RST  = 12;
constexpr int PIN_DC   = 14;
constexpr int PIN_CS   = 27;
constexpr int PIN_SCK  = 18;
constexpr int PIN_MOSI = 23;
