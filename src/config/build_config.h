#pragma once

// All values are injected at compile time via platformio.ini build_flags.
// This header centralises the validation so a missing flag fails the build
// here instead of producing a confusing error elsewhere.

#ifndef WIFI_SSID
#error "WIFI_SSID build flag is required"
#endif
#ifndef WIFI_PASS
#error "WIFI_PASS build flag is required"
#endif
#ifndef EPD_TOKEN
#error "EPD_TOKEN build flag is required"
#endif
#ifndef EPD_HOSTNAME
#error "EPD_HOSTNAME build flag is required"
#endif
#ifndef EPD_STATIC_IP
#error "EPD_STATIC_IP build flag is required"
#endif
#ifndef EPD_GATEWAY
#error "EPD_GATEWAY build flag is required"
#endif
#ifndef EPD_SUBNET
#error "EPD_SUBNET build flag is required"
#endif

namespace config {

constexpr const char* wifi_ssid  = WIFI_SSID;
constexpr const char* wifi_pass  = WIFI_PASS;
constexpr const char* token      = EPD_TOKEN;
constexpr const char* hostname   = EPD_HOSTNAME;
constexpr const char* static_ip  = EPD_STATIC_IP;
constexpr const char* gateway    = EPD_GATEWAY;
constexpr const char* subnet     = EPD_SUBNET;

constexpr unsigned int  http_port   = 80;

}  // namespace config
