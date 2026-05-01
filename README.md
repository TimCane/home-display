# new-home-display

ESP32 firmware that drives a 13.3" 4-color e-paper panel and exposes an HTTP push API. Clients render their own framebuffer in 2-bit-per-pixel native format and POST it; the firmware streams it to the panel.

```sh
curl -X POST \
  -H "Authorization: Bearer $EPD_TOKEN" \
  --data-binary @frame.bin \
  http://display.local/fb
```

## Repository layout

```
docs/                   Design and hardware reference
sample-code/            Vendor-supplied driver sample (reference only)
src/
  main.cpp              Entry point — wires modules together
  config/               Build flags, pin map, timing constants
  display/              Bare-metal SSD2677 driver + IPanel adapter
  app/                  FrameQueue, IPanel/IFrameSource, RefreshMachine
  net/                  WiFi association, mDNS, reconnect handling
  http/                 AsyncWebServer routes, bearer-token auth
test/                   Host-side Unity tests for state machine logic
platformio.ini          Production + native test environments
```

## Build and flash

Edit the placeholder `build_flags` in `platformio.ini` (WiFi creds, bearer token, hostname, IPs), then:

```sh
pio run -t upload          # production firmware to ESP32-L
pio test -e native         # state-machine logic tests on host
```

## Documentation

- [Design overview](docs/README.md)
- [Wire format](docs/wire-format.md)
- [API](docs/api.md)
- [Refresh contract](docs/refresh-contract.md)
- [Firmware](docs/firmware.md)
- [Out of scope](docs/out-of-scope.md)
