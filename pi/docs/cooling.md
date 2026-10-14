# Cooling

The case has no fans or temperature sensors: the projector's own fan moves the air through the case's louver banks, and the projector has its own thermal cut-off. The Pi only watches **its own SoC temperature** (`/sys/class/thermal/thermal_zone0`, read every 5 s) and switches the projector off if the Pi itself overheats.

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
