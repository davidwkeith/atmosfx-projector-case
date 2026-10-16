# Reliability

The case lives on an outdoor extension cord that will get unplugged.

## Power-cut safety

- **Read-only root.** The system partition runs read-only under an overlay. Changes go to RAM and vanish at reboot, so a power cut can't corrupt the OS.
  - It uses Debian's `overlayroot`, the same mechanism as `raspi-config nonint do_overlayfs` on trixie. That was checked in raspi-config's trixie source.
  - The kernel flag is `overlayroot=tmpfs:recurse=0`. raspi-config uses the default `recurse=1`, which would also make the data partition read-only, so writes to it would vanish at reboot (checked in overlayroot's docs).
  - The overlay needs at least 512 MB of RAM (raspi-config's own limit), so the Zero 2 W just qualifies.
- **Data partition.** `/srv/videofx` is ext4, labelled `videofx-data`. It holds everything that must persist, through bind mounts:
  - `/var/lib/videofx`: settings, Matter pairing, last power state;
  - `~/media`: videos and the playlist;
  - `/var/lib/systemd/timesync`: the saved clock.
- **Mount options:** `noatime,commit=5,errors=remount-ro` in the default `data=ordered` mode, with fsck at boot (fstab pass 2; `fsck.repair=yes` is already on `cmdline.txt`).
  - Why not `data=journal`? Every write here, from us, matter.js or timesyncd, is write-temp-then-rename. `data=ordered` plus ext4's `auto_da_alloc` puts the data on disk before the rename is committed, so a power cut leaves the old file or the new one.
  - `data=journal` would write every multi-GB video upload twice (slower, more SD wear) without adding safety for that pattern.
  - `commit=5` bounds loss to 5 s for anything not fsynced; `errors=remount-ro` stops writing on corruption.
- **Our own writes** (settings.json, player state, playlists, uploads) all go: temp file, fsync, rename, fsync of the folder (`src/fsutil.js`).
- **Sizes.** On first boot `videofx-storage` grows the root partition to `ROOT_SIZE_MB`, makes the data partition from the rest of the card (at least `DATA_MIN_MB`), turns the overlay on and reboots once. Both sizes are in `pi/config`; defaults 6144 and 1024. The image disables Pi OS's own "grow root over the whole card" (`resize` / `rpi-resize`).
- **install.sh on an existing Pi:** Pi OS has usually already grown root over the whole card, and a mounted root can't shrink, so the page reports "no-space" and protection stays off. Fix: flash a fresh card, and before its first boot remove the word ` resize` from `cmdline.txt` on the boot partition. Then run install.sh.
- **OS updates** need maintenance mode (the last section on this page).
- **Logs** are kept in RAM while protected. `journalctl` works until the next reboot. The health log (below) is the part that survives.

## Health log

The journal is gone after a power cut, so the service keeps its own record of how the Pi is doing in `/var/lib/videofx/health.jsonl` on the data partition. System > Health log shows the last 24 hours as a chart with the recent events, and **Download CSV** gives every sample for a spreadsheet.

- **Every minute, one sample:**
  - the hottest SoC reading of that minute;
  - whether the sled fan is on;
  - the firmware's throttle flags (`vcgencmd get_throttled`: under-voltage, frequency capped, throttled, soft temperature limit);
  - the Wi-Fi signal;
  - whether VideoFX is on.
- **Events, when something changes:**
  - Pi started (uptime under 5 minutes: power-up, power cut or reboot), service restarted, service stopped;
  - under-voltage or throttling started or ended, plus any of them already flagged since boot when the service starts;
  - temperature warning, over-temperature cut-off, back to normal;
  - Wi-Fi lost or back, HDMI display lost or back;
  - the video player crashed, playback stopped, the event loop blocked.
- **Reading it.** "Pi started" with no "Service stopped" before it means the power was cut (or the Pi hung and the hardware watchdog reset it). Under-voltage means the 5 V rail sagged: check the DigiAMP+'s supply and its barrel plug before anything else.
- **Temperature needs the protection on.** The SoC is read by the over-temperature check (Settings > Cooling); with it switched off, samples have no temperature.
- **Clock.** Before NTP has synced, times can be off; those samples are marked (`clock_synced` 0 in the CSV).
- **Size.** About 60 bytes a minute. Past 3 MB the file moves to `health.jsonl.1` and a new one starts, so the last month or so is kept and it never passes 6 MB.
- **Power cuts.** Lines are appended without fsync; the data partition commits every 5 s, and a line cut short is skipped when reading.

## Time (no RTC)

The Pi 3, 4 and Zero 2 W have no real-time clock, so after a power cut the clock starts wrong.

- **Gating.** The schedule and sunset don't act until `systemd-timesyncd` has synchronised (it touches `/run/systemd/timesync/synchronized`, per its man page). Until then the page says **"Time not synced"**. When sync arrives, the schedule plans from the real time and doesn't replay what it missed.
- **Monotonic clock.** timesyncd saves the time to `/var/lib/systemd/timesync/clock` and never boots behind it. That file is on the data partition, so it survives the read-only root. This is the built-in equivalent of fake-hwclock, which Pi OS Lite doesn't ship.
- **Servers.** NTP servers from DHCP come first, then `pool.ntp.org`. NetworkManager passes DHCP option 42 to a dispatcher script (`DHCP4_NTP_SERVERS`), which writes a runtime timesyncd drop-in. On UniFi, set it in the network's DHCP options under **NTP Server (Option 42)** ([UniFi DHCP Server](https://help.ui.com/hc/en-us/articles/360012097513-UniFi-DHCP-Server)). The gateway's own address works if it serves NTP.
- **Pi 5 (optional):** it has an RTC. Add the official rechargeable battery on the **J5** connector to keep time across power cuts, and enable charging with `dtparam=rtc_bbat_vchg=3000000` in config.txt ([Raspberry Pi RTC docs](https://github.com/raspberrypi/documentation/blob/master/documentation/asciidoc/computers/raspberry-pi/rtc.adoc)). Don't fit a non-rechargeable cell. The time gate still applies.

## Wi-Fi

- **Power save is off** (NetworkManager `wifi.powersave=2`); it causes latency spikes and missed mDNS/Matter traffic.
- **Ethernet is preferred** when plugged in (route metric 100 vs 600), and Wi-Fi stays up as a fallback.
- The page shows the SSID, signal (dBm and %), a verdict and the band.
- **Bands:** the Pi 3B+, 4B and 5 are dual-band (2.4/5 GHz). The **Pi 3B and Zero 2 W are 2.4 GHz only** ([Raspberry Pi specs](https://github.com/raspberrypi/documentation/blob/master/documentation/asciidoc/computers/raspberry-pi/introduction.adoc)), so the SSID must offer 2.4 GHz.
- **UniFi placement.** An outdoor case sits at ground level, often behind a wall, so give it a real AP view: an outdoor AP or a window-facing one, or Ethernet if you can. Aim for better than **-70 dBm** at the Pi. Ubiquiti's guide calls -60 to -70 acceptable and warns of drops below -80 ([WiFi Troubleshooting Guide](https://help.ui.com/hc/en-us/articles/32064585817495)). Caveats:
  - **Minimum RSSI** disconnects clients below a threshold, and some devices refuse to reconnect after being kicked repeatedly ([Minimum RSSI](https://help.ui.com/hc/en-us/articles/221321728-Understanding-and-Implementing-Minimum-RSSI), [SSID settings](https://help.ui.com/hc/en-us/articles/32065480092951-UniFi-WiFi-SSID-and-AP-Settings-Overview)). Leave it off on the APs that cover the case, or set it well below the Pi's signal.
  - **Band Steering** nudges clients from 2.4 GHz to 5 GHz with BSS transition frames. At the edge of coverage 2.4 GHz often reaches further. If a dual-band Pi keeps hopping, give it a 2.4 GHz-only SSID; a 3B or Zero 2 W ignores steering anyway.

## Hang recovery

- **Hardware watchdog:** `RuntimeWatchdogSec=14s` in `/etc/systemd/system.conf.d/`. systemd pets the Broadcom watchdog, and if the kernel or systemd hangs the board resets. 14 s stays under the chip's roughly 15 s limit.
- **Service watchdog:** `videofx-player` is `Type=notify` with `WatchdogSec=30`. It sends `READY=1` once its own start-up is done (not when Matter comes online: with the Wi-Fi down that may never happen, and systemd would restart it every 2 minutes), then `WATCHDOG=1` every 15 s from the main event loop, but only while healthy. It stops pinging if the loop was blocked for more than 5 s, and systemd then restarts it.
- Node can't write to the notify socket without a native addon, so pings go through `systemd-notify` with `NotifyAccess=all`. Crediting that short-lived helper's message to our unit needs kernel ≥ 6.5 and systemd ≥ 254, which trixie has; on older systems the pings may be lost. At most one helper runs at a time.

## Maintenance mode

```sh
sudo videofx-maint on && sudo reboot      # root writable; the page shows a warning banner
sudo apt update && sudo apt full-upgrade  # or edit /etc/default/videofx, Wi-Fi, ...
sudo videofx-maint off && sudo reboot     # protected again
videofx-maint status
```

With the overlay on, edits to `/etc` (including `/etc/default/videofx` and NetworkManager Wi-Fi profiles) are lost at reboot. Use maintenance mode for those, or the web page, whose settings live on the data partition.
