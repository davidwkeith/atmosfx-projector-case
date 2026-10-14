# GPIO pins and wiring

**The DigiAMP+ uses GPIO 2 and 3 (I2C), 18-21 (I2S) and 22 (amp mute, driven by the `rpi-digiampplus` overlay)**, per Raspberry Pi's [audio HAT docs](https://www.raspberrypi.com/documentation/accessories/audio.html); [pinout.xyz](https://pinout.xyz/pinout/digiamp_plus) also lists GPIO 4 (GPCLK0), so it stays reserved. The board brings GPIO 17, 23, 24, 25 and 27 to its optional rotary-encoder and IR headers; VideoFX uses those pins, so **leave those headers empty**. GPIO 0/1 are always reserved for the ID EEPROM. That leaves 18 free GPIOs; VideoFX uses 9, so **no expander is needed**. The service refuses two roles on one pin and any DigiAMP+ pin.

| Role | GPIO | Pin | Notes |
|---|---|---|---|
| DigiAMP+ | 2, 3, 4, 18, 19, 20, 21, 22 | 3, 5, 7, 12, 35, 38, 40, 15 | reserved (22 = mute) |
| PIR in | 17 | 11 | setting (live) |
| Relay out | 27 | 13 | file only (boot level in config.txt) |
| IR LED out | 16 | 36 | file only (overlay) |
| IR receiver in | 23 | 16 | file only (overlay) |
| 5 V / 3.3 V / GND | | 2, 4 / 1, 17 / 6, 9, 14, 20, 25, 30, 34, 39 | |

**Reaching the pins.** The DigiAMP+ has a 40-pin pass-through header on top (Raspberry Pi's product page), so the leads in the table plug straight into it; no stacking header is needed. On the Zero 2 W, which needs a header soldered anyway, leave the pins long.

If you ever need more I/O, an I2C expander (MCP23017) can share GPIO 2/3 with the DigiAMP+'s codec.

**Wiring:**

- **PIR (HC-SR501):** VCC to 5 V (pin 2), GND (pin 9), OUT (3.3 V logic) to GPIO17 (pin 11). Use the retrigger jumper (H), a short hold time, and allow about a minute of warm-up after power-on.
- **Relay module (5 V coil, opto input):** VCC 5 V (pin 4), GND (pin 14), IN to GPIO27 (pin 13). The contacts (COM/NO) go in series with the projector's DC **+** only.
- **IR LED (940 nm), fallback only (built only if CEC fails):** GPIO16 (pin 36; GPIO22 is the DigiAMP+ mute line) drives the LED directly through 150 Ω to GND (about 13 mA at 3.3 V, inside the pin's 16 mA limit). The Pi's default pad drive is 8 mA, so the LED may be dimmer than 13 mA suggests: raise the drive strength, or add the BC337 and 1 k as in [WIRING.md](../../docs/WIRING.md).
- **IR receiver (TSOP38238), bench-only (for learning the remote's codes):** VS to 3.3 V (pin 17), GND, OUT to GPIO23 (pin 16). Powering it at 3.3 V keeps its output at 3.3 V.
