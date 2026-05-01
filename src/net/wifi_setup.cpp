#include "wifi_setup.h"

#include <ESPmDNS.h>
#include <WiFi.h>

#include "../config/build_config.h"
#include "../config/timing.h"

namespace net {
namespace {

void on_wifi_event(WiFiEvent_t event, WiFiEventInfo_t /*info*/) {
    switch (event) {
        case ARDUINO_EVENT_WIFI_STA_GOT_IP:
            Serial.print("wifi: got ip ");
            Serial.println(WiFi.localIP());
            // Tear down any prior responder before re-registering. After a
            // reconnect, the previous MDNS instance is bound to a stale
            // socket; without ::end() the new advertisement silently fails
            // and <host>.local stops resolving.
            MDNS.end();
            if (MDNS.begin(config::hostname)) {
                MDNS.addService("http", "tcp", config::http_port);
                Serial.printf("mdns: %s.local\n", config::hostname);
            } else {
                Serial.println("mdns: begin failed");
            }
            break;
        case ARDUINO_EVENT_WIFI_STA_DISCONNECTED:
            Serial.println("wifi: disconnected, reconnecting");
            WiFi.reconnect();
            break;
        default:
            break;
    }
}

}  // namespace

void connect_and_advertise() {
    IPAddress ip, gw, sn;
    ip.fromString(config::static_ip);
    gw.fromString(config::gateway);
    sn.fromString(config::subnet);

    WiFi.mode(WIFI_STA);
    WiFi.persistent(false);
    WiFi.setAutoReconnect(true);
    WiFi.config(ip, gw, sn);
    WiFi.setHostname(config::hostname);
    WiFi.onEvent(on_wifi_event);

    WiFi.begin(config::wifi_ssid, config::wifi_pass);

    Serial.print("wifi connecting");
    const unsigned long deadline = millis() + config::wifi_connect_timeout_ms;
    while (WiFi.status() != WL_CONNECTED) {
        if ((long)(millis() - deadline) > 0) {
            Serial.println("\nwifi: timeout, rebooting");
            ESP.restart();
        }
        delay(250);
        Serial.print('.');
    }
    Serial.println();
}

}  // namespace net
