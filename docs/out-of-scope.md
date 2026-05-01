# Out of scope

These were considered during design and explicitly rejected. Documented here so future-us doesn't re-litigate them.

| Feature | Why rejected |
|---|---|
| **Partial refresh / sub-region updates** | Not supported by 4-color Spectra 3100 panels. Colored particles need full waveform cycles. |
| **Server-side rendering primitives** (text, rectangles, images) | Client renders, ESP32 blits. Keeps firmware tiny and avoids shipping fonts/graphics libraries on a constrained device. |
| **Image decoding** (PNG, BMP) | Client pre-quantizes to 2bpp. No decoder dependency, no double-buffering of compressed + decompressed image. |
| **Battery / deep-sleep operation** | A push API requires the device to be reachable on demand. Always-on USB-C only. |
| **TLS / mTLS** | LAN device, bearer token is enough. TLS would also eat scarce RAM. |
| **OTA updates** | Reflash over USB-C is acceptable for the iteration cadence. Avoids a second large endpoint and its auth surface. |
| **Captive-portal WiFi setup** | Hardcoded build flags are simpler for a single device. |
| **MQTT / fanout** | One device, one HTTP server. No multi-display story. |
| **WebSocket transport** | Overkill for one-shot full-frame pushes. HTTP POST works from anything. |
