# DESPI-C02 — 24-Pin E-Paper HAT Adapter Board

Source: [buyepaper.com/products/development-kit-connection-adapter-board-for-eaper-display-demo-kit](https://buyepaper.com/products/development-kit-connection-adapter-board-for-eaper-display-demo-kit)

Adapter board that connects 24-pin SPI e-paper displays (up to 13.3") to mainstream development boards.

## Basic

| Parameter | Value |
|---|---|
| SKU | DESPI-C02 |
| Outline Size | 41 x 22 mm |
| Communication Interface | SPI |
| Screen Interface | 24-pin, 0.5 mm pitch |
| Key Components | SI1308EDL, MBR0530 |
| DIP Switch | RESE resistor selection (2.2 Ω, 0.47 Ω) |
| Operating Voltage | 3.3 V |
| Operating Temperature | -20°C ~ 70°C |

## Compatibility

Works with most 24-pin SPI e-paper displays up to 13.3 inches. DIP switch supports UC, SSD and other driver IC series.

Direct connection with:
- STM32-L Series
- ESP32-L Series
- ESP8266-L Series
- Arduino UNO R4-L

## Features

- Plug & play — no wiring required with mainstream dev boards
- DIP switch for RESE resistor selection across driver IC families
- Power measurement, status detection, voltage test points

## Display Connector Pinout

| Pin | Function |
|---|---|
| BUSY | Busy status output |
| RES | External reset (low = reset) |
| D/C | Data/Command control (high = data, low = command) |
| CS | SPI chip select (active low) |
| SCK | SPI clock |
| SDI | SPI data input |
| GND | Ground |
| 3.3V | Power supply (positive) |

## Connecting a Display

1. Flip up the connector latch.
2. Insert the display facing white side up (silver side down).
3. Press the latch down to secure.

## Datasheets

- [DESPI-C02 Connector Board V1.1](despi-c02-datasheet.pdf)
- [DESPI-C02 Schematic V1.0](despi-c02-schematic.pdf)
