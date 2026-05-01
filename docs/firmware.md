# Firmware

- **Framework:** PlatformIO + Arduino
- **Driver:** bare-metal SPI, derived from the GoodDisplay sample (`Display_EPD_W21.cpp/.h`). No graphics library.
- **WiFi credentials:** compile-time only, via `platformio.ini` build flags. No captive portal, no provisioning.
- **OTA:** not shipped. Reflash over USB-C.

## Build flags

All configuration is set at compile time in `platformio.ini`.

| Flag | Purpose |
|---|---|
| `WIFI_SSID` | Network SSID |
| `WIFI_PASS` | Network password |
| `EPD_TOKEN` | Bearer token required by every API endpoint |
| `EPD_HOSTNAME` | mDNS hostname, advertised as `<hostname>.local` |
| `EPD_STATIC_IP` | Requested static IP (e.g. `192.168.1.42`) |
| `EPD_GATEWAY` | Default gateway for the static config |
| `EPD_SUBNET` | Subnet mask |

## Network discovery

The firmware advertises itself two ways, so a client can use whichever works:

1. **mDNS** — `<EPD_HOSTNAME>.local` resolves on macOS/Linux/Windows 10+ networks that pass multicast.
2. **Static IP** — `WiFi.config()` is called with `EPD_STATIC_IP`/`EPD_GATEWAY`/`EPD_SUBNET` before associating, so the device asks for its preferred address.

Multicast-blocked or IP-conflicted networks degrade gracefully: one of the two will work.

## Memory budget

ESP32-WROOM-32D has 520 KB SRAM, of which roughly 250 KB is usable heap after the WiFi stack, HTTP server, and TCP buffers.

| Allocation | Size |
|---|---|
| Pending framebuffer (always allocated) | 163,200 B |
| HTTP request buffers | ~16 KB |
| Misc | ~10 KB |
| **Headroom** | ~60 KB |

The active push does not need a second framebuffer — when the panel is `IDLE`, the body streams directly to SPI in chunks. Only the pending-during-busy path needs RAM.

## Driver

Reused, not rewritten. The vendor sample in [`sample-code/`](../sample-code/) already exercises the exact panel we have:

- `Display_EPD_W21.cpp` — init sequence, sleep, full-screen color fills, image blit
- `Display_EPD_W21_spi.cpp` — pin macros and SPI byte wrappers
- `GDEY133F91_Arduino.ino` — example usage

Changes from the sample:

- Pin macros rewritten for the actual ESP32-L ↔ DESPI-C02 wiring (the sample uses `A14`–`A17` placeholders that aren't valid on this board — the real GPIOs need to be read off the [ESP32-L schematic](hardware/board/esp32-l-schematic.pdf) before first compile).
- The `PIC_display` color-remap loop is removed — the wire format is already in panel-native bit values, so the body bytes go straight to SPI without per-pixel translation.

## DESPI-C02 DIP switch

The adapter has a DIP switch for RESE resistor selection between UC-series and SSD-series driver ICs. The GDEY133F91 uses an **SSD2677**, so the switch must be set to the **0.47 Ω** position. Wrong setting will cause incorrect waveform timing or panel damage.
