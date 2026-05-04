#include "epd.h"

#include <SPI.h>
#include <esp_task_wdt.h>

#include "../config/pins.h"
#include "../config/timing.h"

namespace display {
namespace {

const SPISettings kSpiSettings(config::spi_hz, MSBFIRST, SPI_MODE0);

inline void cs(bool low)   { digitalWrite(PIN_CS,  low ? LOW : HIGH); }
inline void dc(bool data)  { digitalWrite(PIN_DC,  data ? HIGH : LOW); }
inline void rst(bool high) { digitalWrite(PIN_RST, high ? HIGH : LOW); }

inline void write_cmd(uint8_t c) {
    dc(false);
    cs(true);
    SPI.transfer(c);
    cs(false);
}

inline void write_data(uint8_t d) {
    dc(true);
    cs(true);
    SPI.transfer(d);
    cs(false);
}

// Returns true once BUSY rises, false if `timeout_ms` elapses first. Yields
// the task on each iteration so the WDT and AsyncTCP keep ticking even when
// the panel takes its full ~25 s to refresh.
bool wait_idle(unsigned long timeout_ms = 5000) {
    const unsigned long start = millis();
    while (digitalRead(PIN_BUSY) == LOW) {
        if (millis() - start >= timeout_ms) return false;
        esp_task_wdt_reset();
        vTaskDelay(1);
    }
    return true;
}

}  // namespace

void begin() {
    pinMode(PIN_BUSY, INPUT);
    pinMode(PIN_RST,  OUTPUT);
    pinMode(PIN_DC,   OUTPUT);
    pinMode(PIN_CS,   OUTPUT);
    cs(false);
    rst(true);

    SPI.begin(PIN_SCK, -1, PIN_MOSI, PIN_CS);
}

void begin_frame() {
    Serial.println("epd: begin_frame");
    SPI.beginTransaction(kSpiSettings);

    delay(100);
    rst(false); delay(10);
    rst(true);  delay(10);
    if (!wait_idle()) Serial.println("epd: WARN BUSY stuck LOW after reset");

    write_cmd(0x00); write_data(0x2F); write_data(0x29);
    write_cmd(0x01); write_data(0x07); write_data(0x00); write_data(0x20);
                     write_data(0x1E); write_data(0x78); write_data(0x20);
    write_cmd(0x03); write_data(0x00); write_data(0x00); write_data(0x00);
    write_cmd(0x06); write_data(0x0F); write_data(0x98); write_data(0xA5); write_data(0xF3);
    write_cmd(0x30); write_data(0x08);
    write_cmd(0x41); write_data(0x00);
    write_cmd(0x50); write_data(0x37);
    write_cmd(0x60); write_data(0x04); write_data(0x02);
    write_cmd(0x61); write_data(WIDTH  / 256); write_data(WIDTH  % 256);
                     write_data(HEIGHT / 256); write_data(HEIGHT % 256);
    write_cmd(0x65); write_data(0x00); write_data(0x00); write_data(0x00); write_data(0x00);
    write_cmd(0xE7); write_data(0x16);
    write_cmd(0xE3); write_data(0x65);
    write_cmd(0xE0); write_data(0x00);
    write_cmd(0xE9); write_data(0x01);
    write_cmd(0x62); write_data(0x77); write_data(0x77); write_data(0x77); write_data(0x5C);
                     write_data(0x9F); write_data(0x8C); write_data(0x77); write_data(0x63);
    write_cmd(0x04);  // power on
    if (!wait_idle()) Serial.println("epd: WARN BUSY stuck LOW after PON");

    // Open the data window: 0x10 = "send frame data"; CS held LOW, DC=data
    // until end_frame(). All write_chunk() bytes stream through this window.
    write_cmd(0x10);
    dc(true);
    cs(true);
}

void write_chunk(const uint8_t* data, size_t len) {
    SPI.writeBytes(data, len);
}

void end_frame() {
    cs(false);
    SPI.endTransaction();
}

bool start_refresh() {
    SPI.beginTransaction(kSpiSettings);
    write_cmd(0x12);
    write_data(0x00);
    SPI.endTransaction();
    // Block until BUSY drops. The ESP32 polls fast enough that without this
    // the state machine would see "not busy" before the panel reacts.
    const unsigned long start = millis();
    while (digitalRead(PIN_BUSY) == HIGH) {
        if (millis() - start >= 1000) {
            Serial.println("epd: WARN BUSY did not drop after refresh");
            return false;
        }
        esp_task_wdt_reset();
        vTaskDelay(1);
    }
    Serial.printf("epd: refresh started after %lu ms\n",
                  (unsigned long)(millis() - start));
    return true;
}

bool is_busy() {
    return digitalRead(PIN_BUSY) == LOW;
}

void sleep() {
    SPI.beginTransaction(kSpiSettings);
    write_cmd(0x02); write_data(0x00);  // power off
    if (!wait_idle()) Serial.println("epd: WARN BUSY stuck LOW after POF");
    write_cmd(0x07); write_data(0xA5);  // deep sleep
    SPI.endTransaction();
}

}  // namespace display
