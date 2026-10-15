# Cooling

The projector's own fan moves the case air through the louver banks, and the projector has its own thermal cut-off. The Pi has two layers of its own:

1. **The sled fan** (Pi 3 and Pi 4 sleds): a 30 mm 5 V fan blowing into the gap between the Pi and the DigiAMP+, with a heatsink on the SoC. The kernel's `gpio-fan` overlay switches it through a transistor on GPIO 26: on at 60 °C, off at 50 °C. The service does not drive it, so it keeps working if the service stops; the Dashboard's Pi temperature tile shows "fan on" or "fan off". The Pi 5 has its own Active Cooler; the Zero 2 W sled has no fan mount. Wiring: [GPIO pins and wiring](wiring.md).
2. **Over-temperature protection**: the service watches **the SoC temperature** (`/sys/class/thermal/thermal_zone0`, read every 5 s) and switches the projector off if the Pi overheats anyway.

The fan's pin and temperature are file-only (`VIDEOFX_FAN_GPIO`, `VIDEOFX_FAN_ON_C`, shown under Settings > Hardware), because they live in `config.txt`. Change both places, and keep the fan's temperature below the warning temperature (the service refuses otherwise).

Without a fan, the Pi tripped the over-temperature protection on a warm day, running outside the case (owner, 2026-10-15).

Settings > Cooling:

_Upgrade note: `tempWarnC` / `tempCritC` now refer to the Pi's SoC. A saved `tempCritC` of 55 (the old projector-zone default) would trip during normal operation, so delete the old saved values or set them to 70 / 80._

- **Pi over-temperature protection** (on by default). When off, nothing is checked and nothing is protected.
- **Warning** (default 70 °C, 40-90): banner on the page.
- **Critical** (default 80 °C, 50-95):
  - stops playback and switches the projector off through its configured path, even under DMX;
  - blocks switching on;
  - it switches back on (only if it was on) once the SoC is below critical by the hysteresis.
- **Cool-down before resuming** (default 5 °C, 1-20).
- **What the cut-off can do depends on the projector power mode.** With `relay` or `relay-ir` it cuts the projector's power. With `cec` it asks for standby, which a hung projector can ignore; with `hdmi-off` it only drops the signal; with `none` it only stops playback. The relay is the only way the Pi can really cut the projector's power on over-temperature.
- **A missing reading** (the sysfs file unreadable) changes nothing: no trip, no clear.
- **Matter:** the SoC temperature is endpoint 4.
