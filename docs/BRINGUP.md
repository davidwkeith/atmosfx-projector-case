# Hardware bring-up checklist

Everything below has only been tested in software. Work through it on the bench before the case goes outside, and record results in the design log. Each line has a pass criterion. If one fails, the "if not" column says what changes.

## Before the big prints

| # | Test | Pass | If not |
|---|---|---|---|
| 1 | `fit_coupon`: heat-set inserts (3/8, 1/4, M4, M3), screws in the M3/M2.5/M2 pilots, M4 bolt in the keyhole, acrylic in the slot | Each fits snug, with no cracking and no slop | Adjust `insert38_d`, `insert_d`, `m4_insert_d`, `m3_insert_d`, `clearance`, re-export |
| 2 | Measure the projector into `docs/measurements.xlsx`: width and height (depth is done: 130.0), lens height and left/right offset, tripod socket position, vents, **where the HDMI and power ports are** | Within a few mm of `proj_w/d/h`, `lens_z`, `lens_x`, `mount_x/y`, `port_band` | Update the flagged parameters, run `scripts/check_clash.sh` |
| 3 | Throw ratio and offset: project onto a wall from a measured distance, and measure image width and how far the bottom edge sits above the lens | Throw ratio about 1.4, offset recorded | Set `throw_ratio`, `lens_offset`; check the `light-cone` result |
| 4 | Brick label: volts, amps, polarity, input current, inlet type (C7/C5/C13). The projector's label reads DC 21 V 3 A | 12-24 V and enough amps for projector + Amp4 + fans (the stock 3 A brick covers the projector alone) | 21 V brick of 5 A or more; fill in the fuse table in WIRING.md |
| 5 | Ball head height and where the lock knob sits | Knob reachable through the hatch diamond | Change `ball_head_h`; move the hatch (`hatch_zc`) |

## Pi on the bench (before it goes in the case)

| # | Test | Pass | If not |
|---|---|---|---|
| 6 | Flash the image onto a fresh card (release image through Imager's repository JSON, or your own build; or `install.sh`), first boot | One extra reboot, then `videofx-xxxx.local` answers, the name shows as VideoFX-XXXX and your user can log in. `videofx-maint status` says protected, `lsblk` shows three partitions, and `ssh` doesn't warn about a changed host key after a second reboot | `journalctl -b -u videofx-storage` (and `-u cloud-final` on the release image); see `pi/README.md` Install and troubleshooting |
| 7 | Storage protection: `videofx-maint status`, then pull the power mid-upload | Overlay on, data partition mounted, settings intact after the cut | Leave protection off for Halloween; report it |
| 8 | Amp4 powers the Pi (especially a **Pi 5**) at full volume | No undervoltage warnings (`vcgencmd get_throttled` = 0x0) | Use a Pi 4B sled, or a separate 5 V supply |
| 9 | HDMI-CEC with your projector: power on/off from the web page | Projector wakes and sleeps; page says "CEC supported" | Use `relay-ir` (relay + IR LED), learn the remote's code |
| 9a | Projector powered after the Pi: with playback on, pull the projector's power for 10 s and restore it (or use relay mode and switch off and on) | The picture comes back by itself; the journal says "HDMI display connected" | Add the `video=` line from the README's troubleshooting |
| 9b | Relay mode only: `sudo systemctl stop videofx-player`, then `sudo systemctl kill -s KILL videofx-player` while playing | The relay opens (projector off) both times | Check `videofx-relay-open` and that `pinctrl` is installed |
| 10 | Scare seam: calm clip to scare and back, then `journalctl -u videofx-player \| grep seam` | No visible black frame (log shows under about 100 ms) | Re-encode per the README; try `--hwdec=v4l2m2m-copy` on Pi 3 / Zero 2 W |
| 11 | Video decode: your AtmosFX files at their native resolution | Smooth, CPU under about 70% | Transcode with the README's ffmpeg commands |
| 12 | PIR: walk toward it from the street side | Triggers at the distance you want, not from passing cars | Adjust the sensor's sensitivity/time pots; aim the case |
| 13 | Fans and sensors: page shows both RPMs and both DS18B20 temperatures; unplug a fan | RPM readings, fan-failure alarm fires | Check wiring against the pin table |
| 13a | Over-temperature: set the critical temperature just above the room's (Settings > Cooling) and warm the projector-zone sensor in your hand | Playback stops, the projector goes off by your power mode, the fans go to full, and it resumes after cooling | Report it; do not run unattended |
| 13b | Lost sensor: unplug the projector-zone DS18B20 while playing | A warning at once; after 60 s playback stops with "no temperature reading". Plug it back in: it resumes | Report it |
| 13c | Cooling off, and service stopped (`sudo systemctl stop videofx-player`) | Both fans at full speed in both cases | Check the PWM wiring; a fan that stops at 0% needs Cooling on |
| 14 | Pairing: add to Apple Home ("Add Anyway"), toggle power, fire a scare from an automation | All four endpoints appear and work | See `pi/README.md` Matter notes |
| 14a | Boot with the Wi-Fi access point off, state "on" | It plays, and `systemctl status videofx-player` stays "active (running)" for 5 minutes with no restarts | Report it |
| 14b | Schedule catch-up: with "on at 18:00" set, pull the Pi's power at 17:55 and restore it at 18:05 | It switches on within a minute of boot (once the clock is set) | Set "After a power cut" to on for the night |
| 14c | Open `http://videofx-xxxx.local/` from an iPhone on the same Wi-Fi | The page loads (not "LAN only") | Report the phone's and the Pi's addresses |
| 15 | DMX: send from QLC+/xLights/FPP (unicast) to the Pi's universe | Page shows the source; power, clip and volume follow | Check universe/address and UniFi multicast settings |
| 16 | Update and rollback: `videofx-update --tarball` with the release tarball, then `--rollback` | Both complete and the page shows the right version | Report it |

## In the case

| # | Test | Pass | If not |
|---|---|---|---|
| 17 | Wiring checklist in WIRING.md, then power up | Everything in its "Before first power-up" list passes; the GFCI trips cleanly | Stop and fix before continuing |
| 18 | Heat: run for 2 hours with the lid on, on a warm evening | Projector zone under about 45 C, no throttling, fans below full speed | Check airflow and screens; lower the fan curve thresholds |
| 19 | Aim: full range per AIMING.md | Image clears the window at your aim; nothing rubs | Tilt the case (tripod or shim) instead |
| 20 | Rain: 10 minutes of garden hose "rain" from above and the sides, running | Nothing wet inside beyond a few drops at the louvers | Silicone the leaks; do not run in heavy rain until fixed |
| 21 | Night check from the street | No glow from the vents; cords routed away from paths or covered | Paint the inside black; reroute the cords |
