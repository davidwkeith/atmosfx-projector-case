# VideoFX: the Pi side of the projector case

Raspberry Pi software for the projector case. The sled can be a Pi 3B/3B+, 4B, 5 or Zero 2 W, each with a Raspberry Pi DigiAMP+ amplifier HAT. The Pi shows up in Apple Home (or any Matter controller) as **VideoFX-XXXX**:

- **Loop mode** plays a playlist full screen, over and over, for example the AtmosFX videos you bought.
- **Scare mode** loops a calm clip, and on a trigger plays a scare clip, then goes back to the calm clip. A trigger can be a Home automation, the PIR motion sensor, DMX or the web page.

It also:

- switches the projector over HDMI-CEC, a relay (plus IR) or the HDMI signal;
- follows a weekly schedule with "on at sunset";
- takes DMX over sACN from show software;
- watches the Pi's own temperature and switches the projector off if it overheats (the projector's fan does the case cooling).

A web page on your LAN (`http://videofx-xxxx.local/`) handles videos, the playlist, scare clips, the schedule and every setting.

**Status: untested on hardware.** The logic is unit tested (464 tests). The whole service was run on a Mac against a fake mpv, with real UDP sACN. Nothing has run on a Pi, the image has not been built, and nothing has been paired with Apple Home. See [What is verified](#what-is-verified).

## How it works

- **Names.** On first boot each Pi names itself from the last 4 hex digits of its MAC (eth0, or wlan0 on a Zero 2 W). The display name is `VideoFX-ABCD`: Matter, page title, Bonjour. The hostname is `videofx-abcd` (`videofx-abcd.local`).
- **Matter endpoints**, from [matter.js](https://github.com/matter-js/matter.js) 0.17.9 on Node 24:
  1. **Projector** (On/Off plug): the main power.
  2. **Scare** (On/Off plug): turning it on fires a scare. It stays on while the scare plays, then turns itself off. If the scare can't fire (off, not in scare mode, cooling down) it goes straight back off.
  3. **Motion** (Occupancy sensor, PIR): so Home automations can use the PIR.
  4. **Temperature** (Temperature sensor): the Pi's SoC temperature, so Home can alert on it.
- **Player.** One long-lived **mpv** with DRM/KMS output and no desktop, controlled over its JSON IPC socket (`/run/videofx/mpv.sock`). Changing videos is a playlist command, not a process restart, so there is no black gap. If mpv crashes it is restarted; after more than 5 crashes in a minute the service gives up and reports "off". Off means mpv stops (it idles and releases the screen) and the console is cleared to black. Until the Pi is paired, the console shows the pairing QR code.
- **Who controls the power.** Matter, the web page, the schedule and the restore-after-power-cut all go through one path. While a DMX source is live, only DMX may change the power (see [DMX](#dmx-sacn)). Thermal protection can always switch off.
- **Services.** `videofx-player.service` runs `/opt/videofx/src/main.js` as an ordinary user: `videofx` on the release image, your login user with `pi/config` or `install.sh`. It has the groups video, render, audio, tty and gpio, and `CAP_NET_BIND_SERVICE` for port 80. It never runs as root. `videofx-hostname.service` runs on first boot only. Avahi publishes the name and the web page.

## Supported boards

One arm64 image and one `install.sh` cover all four sleds. pi-gen installs both kernels (`linux-image-rpi-v8` and `linux-image-rpi-2712`), and the firmware picks the right one.

| Board | Projector on | DRM connector | Decoding | DigiAMP+ powering the Pi |
|---|---|---|---|---|
| Pi 3B / 3B+ | the only HDMI port | `HDMI-A-1` | H.264 in hardware up to 1080p30 (V4L2 M2M) | Raspberry Pi: "designed to work with Raspberry Pi 3 and earlier"; 5.1 V at 2.5 A over the header. Not tested here |
| Pi 4B | **HDMI0**, next to USB-C | `HDMI-A-1` | H.264 and HEVC in hardware | Raspberry Pi: on a Pi 4 "or later", use a powered USB hub so the ports add no load. Not tested here |
| Pi 5 | **HDMI0**, next to USB-C | `HDMI-A-1` | **no H.264 hardware decoder**: software (about 10-20% CPU for 1080p24 per Raspberry Pi); HEVC in hardware | 2.5 A is well under the Pi 5's 5 A budget; Raspberry Pi only promises the Pi 3. Not tested; see below |
| Zero 2 W | mini-HDMI | `HDMI-A-1` | as the Pi 3; only 512 MB RAM, so use 720p | any 40-pin board per Raspberry Pi; draws far less. Not tested. Solder a 40-pin header |

Sources: Raspberry Pi's [video playback page](https://github.com/raspberrypi/documentation/blob/master/documentation/asciidoc/computers/os/playing-audio-and-video.adoc) (connector names), its [BCM2712 page](https://github.com/raspberrypi/documentation/blob/master/documentation/asciidoc/computers/processors/bcm2712.adoc) (Pi 5 decoding) and [power supply page](https://github.com/raspberrypi/documentation/blob/master/documentation/asciidoc/computers/raspberry-pi/power-supplies.adoc); Raspberry Pi's [DigiAMP+ product brief](<https://pip-assets.raspberrypi.com/categories/765-raspberry-pi-digiamp/documents/RP-008138-DS-1-digiamp-plus-hat-product-brief.pdf>) (power, dimensions, 0-50 °C operating range), [product page](https://www.raspberrypi.com/products/digiamp-plus/) and [audio HAT docs](https://www.raspberrypi.com/documentation/accessories/audio.html) (Pi model notes, mute GPIO, overlay parameters).

- mpv is pinned to `--drm-connector=HDMI-A-1` (the **Video output** setting), so on a Pi 4B or 5 use **HDMI0**. The option name was checked against the mpv 0.40 manual.
- mpv runs with `--vo=gpu --gpu-context=drm --hwdec=auto-safe`. mpv's docs don't list the Pi's V4L2 decoder in `auto`'s whitelist. If a Pi 3 or Zero 2 W struggles, add `--hwdec=v4l2m2m-copy` under Settings > Advanced (not verified).
- **Pi 5 power is a hardware decision for you.** A Pi 5 wants 5 V/5 A over USB-C PD. The GPIO header can't negotiate PD, and the DigiAMP+ supplies 5.1 V at 2.5 A. If `vcgencmd get_throttled` isn't `0x0` or it reboots under load, use a Pi 4B sled; don't add a second 5 V supply, Raspberry Pi says not to power the Pi's own input while the DigiAMP+ is fitted. The software doesn't work around it.
- **config.txt:** the audio, IR and relay lines are the same on every board and go in `[all]`. Older installs also had overlays for the since-removed fans and temperature sensors; `setup.sh` removes that block.

## Files

```
pi/
  src/main.js          wiring: Matter endpoints, power path, player, projector, DMX, heat, web
  src/config.js        every setting: variable, default, validation, when it applies; GPIO pin checks
  src/settings.js      settings.json store: precedence, password rules, migration
  src/player.js        playback control over mpv IPC: loop, scare mode, clip select, dimmer, mirror
  src/mpv.js           mpv arguments, extra-options allow-list, JSON IPC client, supervisor
  src/display.js       HDMI connector status: playback waits for the projector to appear
  src/schedule.js      weekly schedule, NOAA sunset, scheduler
  src/projector.js     projector power: cec / relay-ir / relay / hdmi-off / none
  src/ir.js            IR codes: validate, learn (NEC decode or raw), send with ir-ctl
  src/gpio.js          relay output via gpioset
  src/pir.js           PIR input via gpiomon
  src/dmx.js           sACN (E1.31) receiver, merge, fixture map, DMX hand-over
  src/thermal.js       SoC temperature watch and over-temperature guard
  src/fsutil.js        durable atomic writes (temp, fsync, rename, fsync dir)
  src/watchdog.js      systemd READY/WATCHDOG pings
  src/system.js        clock sync, Wi-Fi link, power-cut protection status
  src/quiet.js         quiet hours: windows, volume cap, scare gate
  src/backup.js        backup / staged restore
  src/update.js, update-cli.js   version, release lookup and download for videofx-update
  src/media.js, playlist-core.js, web.js, qr.js, screen.js, volume.js
  public/              web page (plain HTML/CSS/JS)
  system/              systemd units, udev rules, avahi service, asound.conf, videofx.default, setup.sh,
                       videofx-storage (+ .service), videofx-maint, videofx-update (+ resume service),
                       NetworkManager/timesyncd/watchdog config
  tools/make-release.sh  release tarball for GitHub Releases
  image/               pi-gen build (build.sh, stage-videofx/)
  dmx/DIY-VideoFX-Player.qxf   QLC+ fixture
  tools/sacn-send.mjs  tiny sACN sender for testing; gen-default.mjs regenerates videofx.default
  test/                Vitest (464 tests), test/fixtures/fake-mpv.mjs
  install.sh, config.example
```

## Install

**Option A: the release image.** Every [release](https://github.com/davidwkeith/atmosfx-projector-case/releases) carries `videofx-<version>-arm64.img.xz` (Raspberry Pi OS Lite 64-bit with the player baked in, built by CI from `pi/image/build.sh --generic`) and `videofx-imager.json`. The image holds no password, SSH key or Wi-Fi; [Raspberry Pi Imager](https://www.raspberrypi.com/software/) (2.0 or newer) puts yours in on first boot through cloud-init, the same way it sets up Raspberry Pi OS trixie:

1. Imager > **App options** > **Content repository** > **Custom URL**: `https://github.com/davidwkeith/atmosfx-projector-case/releases/latest/download/videofx-imager.json`. Imager reloads with "VideoFX projector player" as its only OS.
2. Pick it and the card, then fill in the usual options: user and password, Wi-Fi and country, SSH, locale. The hostname field is ignored: the Pi names itself `videofx-xxxx` anyway.
3. Boot. One extra reboot (storage setup, below), then `videofx-xxxx.local` answers.

Imager's **Use custom** button offers no first-boot options for a plain image file (Imager 2.0 removed them; the repository JSON is the supported way). Without the repository, flash the `.img.xz` with **Use custom**, then edit `user-data` and `network-config` on the card's boot partition before the first boot; both carry commented examples. A Pi booted with no user set up cannot be logged into at all: no password, and the console login is off.

The service runs as the baked-in `videofx` user. Name your Imager user `videofx` to keep one account (Imager then sets its password and SSH key), or pick any other name; both get sudo.

**Option B: build the image yourself.** Your user, password, SSH key and Wi-Fi are baked in, so there is no first-boot setup. Never share this image. You need Docker ([Docker Desktop](https://docs.docker.com/desktop/) on a Mac), git, rsync, uuidgen and node.

```sh
cp pi/config.example pi/config   # user, password, SSH key, Wi-Fi, country; gitignored
pi/image/build.sh                # pi-gen arm64 pinned to one commit; image in pi/deploy/videofx-<version>-arm64.img.xz
pi/image/build.sh --generic      # the public flavour CI builds (no pi/config needed)
```

Flash it with Imager's **Use custom** (no options are offered, none are needed). pi-gen and npm are pinned; Debian and NodeSource packages are whatever is current on build day.

**Fresh card, either way.** Flash the image onto the card and let that card's first boot run: `videofx-storage` grows the root to `ROOT_SIZE_MB` and makes the data partition from the rest, and Pi OS's own grow-to-fill is disabled. Don't copy files onto an existing Pi OS card to "upgrade" it, and don't boot the freshly flashed card in another Pi first. A card whose root already fills it reports `no-space` and runs unprotected; re-flash it.

**Option C: install on stock Raspberry Pi OS Lite (64-bit).**

```sh
scp -r pi/ you@raspberrypi.local:videofx-setup
ssh you@raspberrypi.local 'cd videofx-setup && sudo ./install.sh && sudo reboot'
```

`setup.sh` does the following (both options):

- installs `mpv gpiod v4l-utils alsa-utils avahi-daemon`, plus Node 24 from NodeSource if the system Node is older than 20.19;
- installs the app, udev rules for CEC, lirc, GPIO and fb blank, and the systemd units;
- disables the tty1 login prompt;
- edits `config.txt` (see [GPIO pins](#gpio-pins-and-wiring)). It is idempotent.

## Reliability

The case lives on an outdoor extension cord that will get unplugged.

### Power-cut safety

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
- **OS updates: maintenance mode.**

  ```sh
  sudo videofx-maint on && sudo reboot      # root writable; the page shows a warning banner
  sudo apt update && sudo apt full-upgrade  # or edit /etc/default/videofx, Wi-Fi, ...
  sudo videofx-maint off && sudo reboot     # protected again
  videofx-maint status
  ```

  With the overlay on, edits to `/etc` (including `/etc/default/videofx` and NetworkManager Wi-Fi profiles) are lost at reboot. Use maintenance mode for those, or the web page, whose settings live on the data partition.
- **Logs** are kept in RAM while protected. `journalctl` works until the next reboot.

### Time (no RTC)

The Pi 3, 4 and Zero 2 W have no real-time clock, so after a power cut the clock starts wrong.

- **Gating.** The schedule and sunset don't act until `systemd-timesyncd` has synchronised (it touches `/run/systemd/timesync/synchronized`, per its man page). Until then the page says **"Time not synced"**. When sync arrives, the schedule plans from the real time and doesn't replay what it missed.
- **Monotonic clock.** timesyncd saves the time to `/var/lib/systemd/timesync/clock` and never boots behind it. That file is on the data partition, so it survives the read-only root. This is the built-in equivalent of fake-hwclock, which Pi OS Lite doesn't ship.
- **Servers.** NTP servers from DHCP come first, then `pool.ntp.org`. NetworkManager passes DHCP option 42 to a dispatcher script (`DHCP4_NTP_SERVERS`), which writes a runtime timesyncd drop-in. On UniFi, set it in the network's DHCP options under **NTP Server (Option 42)** ([UniFi DHCP Server](https://help.ui.com/hc/en-us/articles/360012097513-UniFi-DHCP-Server)). The gateway's own address works if it serves NTP.
- **Pi 5 (optional):** it has an RTC. Add the official rechargeable battery on the **J5** connector to keep time across power cuts, and enable charging with `dtparam=rtc_bbat_vchg=3000000` in config.txt ([Raspberry Pi RTC docs](https://github.com/raspberrypi/documentation/blob/master/documentation/asciidoc/computers/raspberry-pi/rtc.adoc)). Don't fit a non-rechargeable cell. The time gate still applies.

### Wi-Fi

- **Power save is off** (NetworkManager `wifi.powersave=2`); it causes latency spikes and missed mDNS/Matter traffic.
- **Ethernet is preferred** when plugged in (route metric 100 vs 600), and Wi-Fi stays up as a fallback.
- The page shows the SSID, signal (dBm and %), a verdict and the band.
- **Bands:** the Pi 3B+, 4B and 5 are dual-band (2.4/5 GHz). The **Pi 3B and Zero 2 W are 2.4 GHz only** ([Raspberry Pi specs](https://github.com/raspberrypi/documentation/blob/master/documentation/asciidoc/computers/raspberry-pi/introduction.adoc)), so the SSID must offer 2.4 GHz.
- **UniFi placement.** An outdoor case sits at ground level, often behind a wall, so give it a real AP view: an outdoor AP or a window-facing one, or Ethernet if you can. Aim for better than **-70 dBm** at the Pi. Ubiquiti's guide calls -60 to -70 acceptable and warns of drops below -80 ([WiFi Troubleshooting Guide](https://help.ui.com/hc/en-us/articles/32064585817495)). Caveats:
  - **Minimum RSSI** disconnects clients below a threshold, and some devices refuse to reconnect after being kicked repeatedly ([Minimum RSSI](https://help.ui.com/hc/en-us/articles/221321728-Understanding-and-Implementing-Minimum-RSSI), [SSID settings](https://help.ui.com/hc/en-us/articles/32065480092951-UniFi-WiFi-SSID-and-AP-Settings-Overview)). Leave it off on the APs that cover the case, or set it well below the Pi's signal.
  - **Band Steering** nudges clients from 2.4 GHz to 5 GHz with BSS transition frames. At the edge of coverage 2.4 GHz often reaches further. If a dual-band Pi keeps hopping, give it a 2.4 GHz-only SSID; a 3B or Zero 2 W ignores steering anyway.

### Hang recovery

- **Hardware watchdog:** `RuntimeWatchdogSec=14s` in `/etc/systemd/system.conf.d/`. systemd pets the Broadcom watchdog, and if the kernel or systemd hangs the board resets. 14 s stays under the chip's roughly 15 s limit.
- **Service watchdog:** `videofx-player` is `Type=notify` with `WatchdogSec=30`. It sends `READY=1` once its own start-up is done (not when Matter comes online: with the Wi-Fi down that may never happen, and systemd would restart it every 2 minutes), then `WATCHDOG=1` every 15 s from the main event loop, but only while healthy. It stops pinging if the loop was blocked for more than 5 s, and systemd then restarts it.
- Node can't write to the notify socket without a native addon, so pings go through `systemd-notify` with `NotifyAccess=all`. Crediting that short-lived helper's message to our unit needs kernel ≥ 6.5 and systemd ≥ 254, which trixie has; on older systems the pings may be lost. At most one helper runs at a time.

### Updates

VideoFX never updates itself, and the web page never touches the network. With the read-only root, updates go through maintenance mode, which `videofx-update` handles:

```sh
sudo videofx-update --check                   # asks GitHub; the page then shows "update available"
sudo videofx-update                           # latest release
sudo videofx-update --tag v0.3.0 --os         # a given release, plus apt full-upgrade
sudo videofx-update --tarball ~/videofx-pi-0.3.0.tar.gz   # no GitHub access needed: scp the tarball over first
sudo videofx-update --rollback                # back to the previous version
```

- **What it does:**
  1. If the root is protected, it records the job and any tarball on the data partition, switches maintenance mode on and reboots. `videofx-update-resume.service` picks the job up after the reboot.
  2. Downloads the release asset `videofx-pi-X.Y.Z.tar.gz` and checks it's VideoFX.
  3. Copies the running version to `/opt/videofx.prev` (with its `node_modules`, so a rollback works offline).
  4. Runs the new release's `system/setup.sh`, which does `apt-get install`, `npm ci --omit=dev`, units and config. Both need the internet, with `--tarball` too.
  5. With `--os`, runs `apt full-upgrade`.
  6. Switches maintenance off and reboots.
  7. If step 4 fails (no network, say), it puts the previous version back, switches protection back on, reboots and exits with an error. It doesn't retry.
- **Private fork:** if your copy of the repo is private, put a GitHub token with read access to its contents (a fine-grained token, "Contents: read") in `/srv/videofx/update/github-token`, mode 600, owned by root. It lives on the data partition so it survives the read-only root. Or use `--tarball`.
- **Making a release:** bump the version in `pi/package.json`, tag `vX.Y.Z` and push the tag. CI (`.github/workflows/build.yml`) attaches the STLs, `videofx-pi-X.Y.Z.tar.gz` (`pi/tools/make-release.sh`), the public image with its `.sha256`, and `videofx-imager.json` (`pi/tools/imager-json.sh`). The image job runs on GitHub's arm64 runner and takes about ten minutes. By hand: `pi/tools/make-release.sh && gh release create vX.Y.Z pi/dist/videofx-pi-X.Y.Z.tar.gz`. The page footer shows the version and sha, and "update available" when the last `--check` found a newer release.

### Backup and restore

Web page > **Backup** > **Download backup**. That's one JSON file with the settings, schedule, quiet hours, playlist, and the Matter storage (fabrics, keys). Videos aren't included; copy those yourself. The file holds the pairing keys and the password hash, so keep it private. When a password is set, downloading needs it.

**Restore:** pick the file, choose whether to include the Matter pairing, confirm. Settings and playlist apply straight away and the service restarts. A restored pairing is swapped in at that restart, and the previous one is kept as `matter.before-restore`.

- Restore the **pairing** only onto the same Pi, or onto a replacement when the old one is gone for good. Two devices with one Matter identity confuse Apple Home and both misbehave.
- To clone settings onto a second VideoFX, restore **without** the pairing and pair the new one separately.

### Guest access

With no password set, the page shows a warning: anyone on your network can control VideoFX and download its pairing keys.

- Set a password, and keep the Pi off networks that guests can reach. On UniFi that means a separate guest network with **Network Isolation** on (Settings > Networks) and, on its SSID, **Client Device Isolation**, as in Ubiquiti's [Guest WiFi best practices](https://help.ui.com/hc/en-us/articles/23948850278295-Best-Practices-Guest-WiFi). Keep VideoFX on your own network with the home hub, since it must share one with Matter.
- Once paired, the page hides the Matter pairing code (Settings > Web page > **Hide the Matter pairing code once paired**, on by default).
- "LAN only" means the usual private ranges plus anything on one of the Pi's own subnets. The second part is for IPv6: on a network with a routed prefix every device has a global address, and iPhones and Macs use it for `videofx-xxxx.local`.
- Password guessing is slowed down: five new guesses, then one a second. A tab that keeps polling with an old password doesn't use them up.
- The service can't write to the home folder apart from the media folder (`ProtectHome=read-only`). If you move the media folder elsewhere under `/home` with `VIDEOFX_MEDIA_DIR`, add a matching `ReadWritePaths=` to the unit.

### Quiet hours

Web page > **Quiet hours**: per weekday, a window (an end earlier than the start runs past midnight; start = end means all day) during which:

- **the volume is capped** at a percentage (0 mutes). The cap applies to the web slider, the saved level at start-up, and DMX (unless **DMX ignores quiet hours** is on). The mixer is re-set when a window starts or ends;
- **scares are off** (optional), whatever the trigger: Home's Scare switch, the motion sensor, the web button, and DMX unless it bypasses.

Power on/off (Home, the schedule) isn't affected. Until the clock is synchronised, quiet hours count as active if any window is set, the neighbour-friendly guess.

## Videos, playlist, scare mode

Your purchased videos are not included or downloaded. Upload them on the web page, or `scp` them to `~/media/` on the Pi.

- **Loop mode:** build the playlist on the page (order, enable/disable, save). Saving while playing reloads it in mpv.
- **Scare mode:**
  1. Upload the calm clip and the scare clips. Files named like `Ghost_Buffer.mp4` and `Ghost_Scare1.mp4` get paired by **Suggest from file names**.
  2. Pick the calm clip and the scare clips in **Scare mode**, and save.
  3. Set Settings > Playback > **Mode** to `scare`.
  4. Tune the order (sequential/random), the cooldown (default 20 s, counted from the end of a scare), and what happens to a trigger during a scare: `ignore` (default) or `queue` (one scare, played after the cooldown).
  5. Trigger with **Scare now**, the **Scare** switch in Home (for example, "when the doorbell rings, turn on Scare"), the PIR, or DMX.
- **The seam.** The calm clip loops with `loop-file=inf`. The next scare clip and the calm clip after it are already queued, so mpv's `--prefetch-playlist` opens them early. A trigger sets `loop-file=no` and sends `playlist-next`. The service measures each seam from mpv's events and logs it (`journalctl -u videofx-player | grep seam`); the page shows it too. **It has not been measured on a Pi:** the Mac test used a fake mpv, whose ~50 ms is its own simulated delay.
- **Recommended encode:** H.264 High, level 4.1 or lower, 1080p30 (720p for the Zero 2 W), 8-bit 4:2:0 MP4, AAC stereo 48 kHz. Re-encode on your computer only if a file stutters:

  ```sh
  ffmpeg -i in.mp4 -vf "scale=-2:'min(1080,ih)',format=yuv420p" -c:v libx264 -profile:v high -level:v 4.1 \
    -preset slow -crf 20 -c:a aac -b:a 160k -ac 2 -ar 48000 -movflags +faststart out.mp4
  ```

  Use `min(720,ih)` and `-level:v 4.0` for the Zero 2 W. For rear projection on a Pi 3 or Zero 2 W, pre-flip the files with `-vf "hflip,scale=..."` instead of using the Mirror setting (below).
- **Mirror** (Settings > Display): flips left-right at once through mpv IPC (`vf add @mirror:hflip`). The flip runs on the CPU, so it switches decoding to `auto-copy`. That's fine on a 4B or 5 and probably too heavy for 1080p on a 3 or Zero 2 W (not measured).

## Schedule

On the page: an on time and an off time per weekday. The on time can be **At sunset**, plus or minus an offset. An off time earlier than the on time means after midnight.

- Sunset is computed on the Pi from Settings > Schedule > Latitude/Longitude, using NOAA's general solar position equations (tested within 5 minutes of published times). Days with no sunset (polar summer or winter) get no on event.
- Times use the Pi's time zone (`sudo raspi-config` > Localisation). Tested across both DST changes: a time in the spring-forward gap fires once, at 03:30; a time in the fall-back hour fires once.
- **The schedule only acts at its event times.** Switching on or off by hand (Home, the page) holds until the next scheduled event. The page shows the next event.
- **After a power cut** the "After a power cut" setting applies first. Then, once the clock is set, an event that passed while the power was out is caught up: a cut across "on at sunset" still gets you a show. A change you made by hand after the last event is left alone.
- A Pi has no real-time clock. Events more than 5 minutes stale, for example after NTP corrects the clock at boot, are skipped rather than replayed.
- While DMX is in control the schedule is paused. When DMX lets go, the schedule's current wish is applied.

## Projector power

Setting: **Projector power** = `cec` (default) | `relay-ir` | `relay` | `hdmi-off` | `none`. The page shows the projector's state and the CEC result.

- **cec.** Uses `cec-ctl` (v4l-utils) on `/dev/cec0`, the kernel's CEC under KMS (HDMI0 on the 4B and 5; the only port on the 3 and Zero 2 W). No libcec daemon, and access is through the video group via udev.
  - On: configure as a playback device, then Image View On, Text View On and Active Source (One Touch Play), then ask for the power status. If the projector isn't "on" yet, the wake is retried once after 8 s.
  - Off: Standby.
  - If the projector never answers, the service falls back to `hdmi-off` with a notice, and tries CEC again at the next power-on. CEC is only used on power changes, never on page polls.
  - **Buying:** many mini projectors have no CEC. Look for "HDMI-CEC" in the projector's own spec. Brand names like Anynet+, SimpLink or Bravia Sync are the TV makers' CEC and don't tell you anything about a projector.
  - **Test** on the Pi: `cec-ctl -d /dev/cec0 --playback -S` shows the CEC devices. `cec-ctl -d0 --to 0 --image-view-on` should wake it.
- **hdmi-off.** Powers the HDMI signal down (fbdev blank) when stopped, once mpv has let go of the display. Many projectors drop to standby after their own no-signal timeout. **Waking may still need the remote.** Before the Pi is paired, the signal stays on so the pairing code is visible.
- **relay / relay-ir.** A relay on the projector's DC feed. Off: stop playback, then open the relay. On: close it, wait the settle time (default 3 s), then:
  - `relay`: nothing more, for projectors that power up by themselves.
  - `relay-ir`: send the IR power code (twice if "needs two presses" is set). The relay forces a known "off" first, so the IR toggle can't get out of step. A second "on" while it is already on (the schedule after you switched on by hand, say) doesn't press power again.
  - Either way, playback then waits up to 20 s for the projector to show up on HDMI, and starts again if it appears later. mpv gives a disconnected output no picture.
- **Relay safety:**
  - Use a relay module rated for the projector's DC current, with an opto-isolated input and a flyback diode (most modules have one).
  - Switch the **+ line (high side) only**. Never switch the projector's ground: the HDMI shield would carry its return current.
  - At boot the firmware drives the relay line to "open" before Linux runs (`gpio=27=op,dh` for active-low modules; use `dl` for active-high). The service keeps it open until it decides.
  - When the service stops, for any reason, the relay opens: the service does it on a clean stop, and `videofx-relay-open` (the unit's `ExecStopPost`) does it after a crash, a kill or the watchdog. A projector is never left powered with nothing watching its temperature.
  - The relay and IR pins are also in `config.txt`, written once with the defaults. If you change them in `/etc/default/videofx`, change `config.txt` by hand too.
  - Cutting power suits LED mini projectors; don't do it to a lamp projector that needs a cool-down.
- **IR** uses the `gpio-ir-tx` overlay for the LED and `gpio-ir` for a TSOP38238-style receiver, driven with `ir-ctl`.
  - On the page: **Learn power button**, then press the remote's power button at the receiver. The capture is decoded as NEC (`nec`, `necx` or `nec32`, the same scancode forms the kernel's encoder sends) or kept as raw pulse/space data.
  - Or paste a code (`nec:0x40bf`, `rc5:0x1e01`, `raw:+9000 -4500 ...`). **Send test** fires it.
  - `pwm-ir-tx` is allowed (set `VIDEOFX_IR_TX_DRIVER` and use its overlay in `config.txt`): the case has no fans, so hardware PWM0 is free.

## GPIO pins and wiring

**The DigiAMP+ uses GPIO 2 and 3 (I2C), 18-21 (I2S) and 22 (amp mute, driven by the `rpi-digiampplus` overlay)**, per Raspberry Pi's [audio HAT docs](https://www.raspberrypi.com/documentation/accessories/audio.html); [pinout.xyz](https://pinout.xyz/pinout/digiamp_plus) also lists GPIO 4 (GPCLK0), so it stays reserved. The board brings GPIO 17, 23, 24, 25 and 27 to its optional rotary-encoder and IR headers; VideoFX uses those pins, so **leave those headers empty**. GPIO 0/1 are always reserved for the ID EEPROM. That leaves 18 free GPIOs; VideoFX uses 9, so **no expander is needed**. The service refuses two roles on one pin and any DigiAMP+ pin.

| Role | GPIO | Pin | Notes |
|---|---|---|---|
| DigiAMP+ | 2, 3, 4, 18, 19, 20, 21, 22 | 3, 5, 7, 12, 35, 38, 40, 15 | reserved (22 = mute) |
| PIR in | 17 | 11 | setting (live) |
| Relay out | 27 | 13 | file only (boot level in config.txt) |
| IR LED out | 16 | 36 | file only (overlay) |
| IR receiver in | 23 | 16 | file only (overlay) |
| 5 V / 3.3 V / GND | | 2, 4 / 1, 17 / 6, 9, 14, 20, 25, 30, 34, 39 | |

**Reaching the pins.** The DigiAMP+ has a 40-pin pass-through header on top (Raspberry Pi's product page), so the leads above plug straight into it; no stacking header is needed. On the Zero 2 W, which needs a header soldered anyway, leave the pins long.

If you ever need more I/O, an I2C expander (MCP23017) can share GPIO 2/3 with the DigiAMP+'s codec.

**Wiring:**

- **PIR (HC-SR501):** VCC to 5 V (pin 2), GND (pin 9), OUT (3.3 V logic) to GPIO17 (pin 11). Use the retrigger jumper (H), a short hold time, and allow about a minute of warm-up after power-on.
- **Relay module (5 V coil, opto input):** VCC 5 V (pin 4), GND (pin 14), IN to GPIO27 (pin 13). The contacts (COM/NO) go in series with the projector's DC **+** only.
- **IR LED (940 nm):** don't drive it straight from the pin (16 mA max). Use GPIO16 (pin 36; GPIO22 is the DigiAMP+ mute line), then 1 kΩ, then an NPN transistor base (BC337/2N2222). LED plus series resistor (about 47 Ω) from 5 V to the collector; emitter to GND.
- **IR receiver (TSOP38238):** VS to 3.3 V (pin 17), GND, OUT to GPIO23 (pin 16). Powering it at 3.3 V keeps its output at 3.3 V.

## Audio

A **Raspberry Pi DigiAMP+** (TAS5756M, 2 channels) drives 4-8 Ω speakers behind the projection. It runs from the DC splice (12-24 V, through its P5 hard-wire header or the 5.5 x 2.5 mm centre-positive barrel jack) and **powers the Pi through the header** at 5.1 V / 2.5 A. Up to 35 W per channel, rated for 0-50 °C ambient ([product brief](<https://pip-assets.raspberrypi.com/categories/765-raspberry-pi-digiamp/documents/RP-008138-DS-1-digiamp-plus-hat-product-brief.pdf>)): the Pi zone has to stay under that with only a passive louver, and the brief says not to cover a case it sits in, which is what the louvers are for (bring-up logs the shelf temperature).

- **Speakers:** speaker wire from the DigiAMP+'s terminals, same polarity on both speakers; the outputs can't be bridged.
- **Power budget:** the brick must supply the projector, the Pi and the amp at once. Check its label.
- **Software:**
  - `dtoverlay=rpi-digiampplus,unmute_amp` (Raspberry Pi's overlay; the HAT EEPROM identifies the board, but the amp starts **muted** until `unmute_amp` or `auto_mute_amp` is set. `iqaudio-digiampplus` is the same overlay for the older black IQaudIO board);
  - `dtparam=audio=off` and `vc4-kms-v3d,noaudio`;
  - ALSA default pinned by card name in `/etc/asound.conf`;
  - mpv uses `--audio-device=alsa/plughw:CARD=RPiDigiAMP,DEV=0` (the card id ALSA derives from the overlay's "RPi DigiAMP+" name; check with `aplay -l`).
- **Volume:** hardware mixer `Digital` via `amixer -M`, saved in settings.json. The first boot starts at 30%.

## Cooling

The case has no fans or temperature sensors: the projector's own fan moves the air through the case's louver banks, and the projector has its own thermal cut-off. The Pi only watches **its own SoC temperature** (`/sys/class/thermal/thermal_zone0`, read every 5 s) and switches the projector off if the Pi itself overheats.

Settings > Cooling:

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

## DMX (sACN)

VideoFX is a **receive-only 8-channel fixture** over **E1.31 (sACN)**, on Wi-Fi or Ethernet (UDP 5568, unicast and optionally multicast 239.255.hi.lo). Settings > DMX sets: enable, universe (1-63999), start address (1-505), hold time (default 5 s) and accept multicast. The page shows the live sources (name, IP, priority, packet rate) and our 8 values.

| Ch | Function | Values |
|---|---|---|
| 1 | Power | 0-127 off, 128-255 on (same projector power path as Matter) |
| 2 | Mode | 0-127 loop, 128-255 scare |
| 3 | Clip select | 0 = normal (playlist or calm clip); N = playlist entry N, looped |
| 4 | Scare trigger | fires on the rise through 128; the cooldown still applies |
| 5 | Volume | 0-255 → 0-100% |
| 6 | Mute | 128-255 muted |
| 7 | Video dimmer | 0 black … 255 normal (mpv brightness) |
| 8 | Reserved | send 0 |

**Hand-over rules:**

- While any valid source for our universe is live, **DMX owns power, mode, clip, volume, mute and dimmer**.
  - Matter writes are refused, and Matter's attribute is put back to the real state.
  - The page shows "DMX in control" and disables those controls; its power and volume calls get 409.
  - The schedule pauses.
  - DMX values are not saved.
- A source is lost after 2.5 s without data (E1.31 data loss) or at once on Stream_Terminated. After the last source is lost and the hold time passes, control returns:
  - to the schedule's current wish if the schedule is on;
  - otherwise to the power state from before DMX took over.
  - Mode, volume, clip and dimmer go back to their saved settings.
- **Pacing:** power changes at most once a second, mode every 0.5 s, and clip select must hold 300 ms. Volume and dimmer are limited to 10 updates a second.
- **Merging:** highest priority wins; equal top priorities merge highest-takes-precedence per channel. Out-of-order packets are dropped, using ETC's rule: accept if newer, or 20 or more behind. Preview-flagged data and non-zero start codes are ignored.

**Where the E1.31 details come from.** Packet layout, the sequence rule, the 2.5 s timeout, the flags and the universe range were checked against ETC's open-source reference receiver ([ETCLabs/sACN](https://github.com/ETCLabs/sACN)). The ESTA PDF sits behind a terms form and was not read directly.

**Show software:**

- **QLC+:** import `dmx/DIY-VideoFX-Player.qxf` (Fixture Definition Editor, or copy it to your user fixtures folder). It validates against QLC+'s own `fixture.xsd`. Output on E1.31, **unicast** to the Pi's IP.
- **xLights:** Controllers > Add Ethernet, Protocol E1.31, the Pi's **IP address** (unicast), start universe = ours ([xLights manual](https://manual.xlights.org/xlights/chapters/chapter-four-set-up/lighting-networks/ethernet-controller)). Add a DMX model with 8 channels at the start address. The DMX model type's name wasn't verified.
- **Falcon Player:** Channel Outputs > **E1.31 / ArtNet / DDP / KiNet**, add a universe with type **E1.31 Unicast** and the Pi's IP.
- **Manual test:** `node tools/sacn-send.mjs --to <pi-ip> --universe 1 --values 255,0,0,0,76,0,255,0 --seconds 10`. Add `--pulse-trigger` for a scare. It ends with Stream_Terminated.

**Network:** multicast over Wi-Fi is unreliable (converted, rate-limited or dropped by APs), so **send unicast to the Pi's IP**; a fixed IP or DHCP reservation helps. On UniFi, sACN multicast (239.255.x.x) is outside the always-flooded 224.0.0.0/24, so **IGMP Snooping** with "Forward Unknown Multicast" set to Drop can block it, and **Multicast Enhancement** converts it per client ([Switch Settings](https://help.ui.com/hc/en-us/articles/33402927617047-UniFi-Switch-Settings), [WiFi SSID settings](https://help.ui.com/hc/en-us/articles/32065480092951-UniFi-WiFi-SSID-and-AP-Settings-Overview)). Unicast avoids all of that.

## Pair with Apple Home

1. Power on with the projector connected. Until paired, the projector and the web page show the QR code and manual code.
2. On the iPhone (same Wi-Fi as the Pi and your home hub): Home > **+ > Add Accessory**, then scan. If the camera won't read the projector, scan the page or type the 11-digit code.
3. Choose **Add Anyway** at the not-certified warning (test vendor ID 0xFFF1).
4. You get the Projector and Scare switches, a Motion sensor and a Temperature sensor. Name them, and automate, for example: sunset → Projector on; doorbell → Scare on.

To unpair: web page > Matter > **Reset Matter pairing**. Videos and settings are kept.

## Settings

Everything is on the web page under **Settings**. Each setting shows its value, where it comes from (*set here* / *from /etc/default/videofx* / *default*), its default, when it takes effect (at once / next play / after a restart), and a **Reset**.

- **Precedence:** web page (`/var/lib/videofx/settings.json`, written atomically, mode 600) > `/etc/default/videofx` > default. A corrupt settings.json is backed up to `settings.json.corrupt` and ignored, with a warning.
- **Password:** stored as a scrypt hash and never sent back. Changing it needs the current password; removing it needs the current password and a confirmation.
- **Extra mpv options (Advanced):** only `--name=value`, no shell, and only from an allow-list: decoding (`--hwdec`, `--vd-lavc-*`), DRM output (`--vo=gpu|gpu-next|drm`, `--gpu-context`, `--drm-*`, `--drm-device=/dev/dri/cardN`), sync and scaling (`--video-sync`, `--interpolation`, `--scale`, `--deband`, `--video-*`, `--panscan`, picture controls), cache (`--cache*`, `--demuxer-max-bytes`), audio timing (`--audio-delay`, `--audio-buffer`, `--volume-max`, `--alsa-*`), `--profile=fast|sw-fast|high-quality|low-latency`, `--msg-level`, and `--vf` with simple filters (`crop`, `hflip`, `vflip`, `scale`, `pad`, `format`, `fps`, `eq`, `rotate`, `transpose`, `yadif`, `bwdif`). Everything else is refused. A deny-list missed `--ao=pcm --ao-pcm-file=...`, which writes any file the service can.
- **JSON values in `/etc/default/videofx`** (scare clips, schedule, quiet hours) go in single quotes. systemd reads the file, and it drops the quotes inside an unquoted value.
- **File only** (need root, or would let the page point the service anywhere): ports, media folder, playlist path, mpv command, state folder, and the relay and IR pins. Edit `/etc/default/videofx` (every key is listed there, commented) and restart.
- **Migration from the VLC version:** `VIDEOFX_VLC*` in the file and `vlcExtraArgs` in settings.json are ignored, with a warning. VLC options don't translate to mpv; the audio card and video output settings carry over as they are.

### Web page security

- The page answers only private, link-local and ULA addresses.
- The Host header must be an IP, `localhost`, `videofx-xxxx(.local)`, the device name or an extra host name (case-insensitive). This blocks DNS rebinding.
- Every write needs an `X-VideoFX: 1` header (CSRF). The optional password uses basic auth, over plain HTTP.
- Uploads: file names are checked, the size is capped, extensions are limited, and media is never served back.

## UniFi networks

Keep the Pi, the Apple home hub and your iPhone **on the same network (VLAN)**. On the Wi-Fi, turn off **Client Device Isolation** and **Multicast and Broadcast Control** (or add exceptions). Try turning **Multicast Enhancement** off if discovery is flaky. With **IGMP Snooping** on, set **Forward Unknown Multicast Traffic** to flood. Across VLANs you need the gateway's **mDNS Proxy** (add `_matter._tcp.local` in Custom mode) *and* routable IPv6 plus firewall rules for UDP 5540. The Pi sends `videofx-xxxx` as its DHCP hostname.

Sources: [Gateway mDNS Proxy](https://help.ui.com/hc/en-us/articles/12648701398807-UniFi-Gateway-Multicast-DNS-mDNS-Proxy), [Switch Settings](https://help.ui.com/hc/en-us/articles/33402927617047-UniFi-Switch-Settings), [WiFi SSID settings](https://help.ui.com/hc/en-us/articles/32065480092951-UniFi-WiFi-SSID-and-AP-Settings-Overview), [Optimizing WiFi](https://help.ui.com/hc/en-us/articles/221029967-Optimizing-WiFi-Connectivity-and-Reducing-Latency), [Network isolation](https://help.ui.com/hc/en-us/articles/18965560820247-Implementing-Network-and-Client-Isolation-in-UniFi), [Configuring IPv6](https://help.ui.com/hc/en-us/articles/36378535649687-Configuring-IPv6-in-UniFi), [Local DNS records](https://help.ui.com/hc/en-us/articles/15179064940439-UniFi-DNS-Records-and-Local-Hostnames); Apple's [accessory troubleshooting](https://support.apple.com/en-us/126198). help.ui.com blocks scripted fetches, so these were read through its article API; they open normally in a browser.

**mDNS:** matter.js runs its own responder on UDP 5353 (`SO_REUSEADDR`) under a MAC-based name. avahi owns `videofx-xxxx.local` and the `_http._tcp` entry ("VideoFX-XXXX"). They don't share names, so they coexist. A unicast mDNS reply reaches only one of the two sockets; that case is untested.

## Troubleshooting

```sh
journalctl -u videofx-player -f        # everything: player, Matter, DMX, schedule, seams, thermal
cat /var/lib/videofx-name
kmsprint | grep Connector              # HDMI connectors (Pi 5: first card only)
cec-ctl -d /dev/cec0 --playback -S     # is there CEC?
ir-ctl -f -d /dev/lirc0                # IR devices (TX and RX may swap numbers)
aplay -l; amixer -c RPiDigiAMP sget Digital
vcgencmd get_throttled                 # under-voltage (Pi 5 on the DigiAMP+)
```

- **No picture on a 4B or 5:** use HDMI0. **No picture when the projector is powered after the Pi:** playback waits up to 20 s for the HDMI connection and starts again when it appears (`journalctl -u videofx-player | grep HDMI`). If your projector never reports itself connected, add `video=HDMI-A-1:1280x720@60D` to `cmdline.txt`.
- **mpv errors about the DRM device on a Pi 5:** add `--drm-device=/dev/dri/card1` in Settings > Advanced.
- **Stutter on a Pi 3 or Zero 2 W:** re-encode (above), or add `--hwdec=v4l2m2m-copy`.

## License

The software in `pi/` is MIT (see `pi/LICENSE`). The case design in the rest of the repository is CC BY-SA 4.0.

## Development

```sh
cd pi && npm ci && npm test             # Vitest; a few tests bind 127.0.0.1 and a Unix socket
VIDEOFX_MPV=$PWD/test/fixtures/fake-mpv.mjs VIDEOFX_CONSOLE= VIDEOFX_MEDIA_DIR=/tmp/vfx-media \
  VIDEOFX_STATE_DIR=/tmp/vfx-state RUNTIME_DIRECTORY=/tmp/vfx-run VIDEOFX_HTTP_PORT=8080 \
  VIDEOFX_PROJECTOR_POWER=none node src/main.js      # then open http://localhost:8080
node tools/gen-default.mjs > system/videofx.default   # after adding a setting
```

Node 20.19+ to run, 22.12+ for the tests. On macOS keep `RUNTIME_DIRECTORY` short: Unix socket paths are limited to 104 bytes.

## What is verified

**Verified** (Mac, Node 26, `npx vitest run` in `pi/` outside the sandbox, because some tests bind local sockets):

- **464 tests pass.** They cover:
  - the player: loop, scare arm/trigger/re-arm, sequential and random order, cooldown, ignore and queue, off during a scare, seam measurement, command ordering, mirror, clip and dimmer;
  - mpv: the allow-list, the IPC client on a real Unix socket, supervisor crash/restart/give-up;
  - schedule: sunset against published times, polar days, both DST changes, the manual-override rule, stale events, the desired state for the DMX hand-back;
  - projector: the CEC sequence, retry, fallback, relay and relay-IR timing, double press;
  - IR: code validation, NEC decoding (nec, necx, nec32), learn and timeout, send;
  - GPIO: the pin budget and conflicts, the relay holder, PIR debounce and restart;
  - DMX: packet parsing (valid and malformed), universe, preview and terminated flags, sequence wrap, priority and HTP merge, the 2.5 s timeout, hold and hand-over, channel map, pacing, rising-edge trigger, the arbiter refusing Matter writes;
  - thermal: the SoC watch (warning, critical trip, hysteresis, a missing reading), the over-temperature shutdown and resume rule;
  - settings, the web API and all earlier features.
- **matter.js API** checked against the installed 0.17.9 package: `OccupancySensorDevice` + `OccupancySensingServer.with("PassiveInfrared","OccupancyEvent")`, `TemperatureSensorDevice`, a second On/Off endpoint, runtime `server.set({basicInformation:{nodeLabel}})`.
- **mpv** options and IPC commands checked against the v0.40.0 manual source (`--drm-connector`, `--input-ipc-server`, `--prefetch-playlist`, `--audio-device=alsa/...`, `loadfile`/`loadlist`/`playlist-next`/`playlist-clear`/`stop`, `vf add/remove @label`, the `hwdec` values).
- **cec-ctl, ir-ctl and gpiomon/gpioset** options checked against the v4l-utils and libgpiod 2.2 sources. Overlay parameters and the DigiAMP+ GPIO usage checked against Raspberry Pi's overlay README (`rpi-digiampplus`: card name "RPi DigiAMP+", `unmute_amp` / `auto_mute_amp`), its audio HAT docs (mute on GPIO22) and pinout.xyz.
- **Full-service smoke run** against the fake mpv, with real UDP sACN:
  - loop and scare mode;
  - trigger, ignore during a scare, cooldown;
  - mirror through IPC;
  - schedule next-event;
  - DMX takeover (web power and volume refused with 409, live values shown), Stream_Terminated, then hand-back after the hold;
  - the page at phone width.
- The smoke run found and fixed two real bugs: interleaved mpv commands from quick reloads, and banners that ignored `hidden`.
- **Reliability:** durable writes (the call order is tested, and the files were written on disk); watchdog pinging (interval, READY once, stops while unhealthy, no pile-up); schedule gated on clock sync; Wi-Fi and storage-status parsers. Checked against the sources: raspi-config trixie (`overlayroot`), overlayroot's `recurse` option, the timesyncd `synchronized` file and drop-in dirs (systemd v257 man pages), NetworkManager's `DHCP4_*` dispatcher variables and its `ntp_servers` request, the UniFi DHCP option 42, Raspberry Pi board bands and the Pi 5 RTC battery.
- **This round:** quiet hours (windows including past midnight, cap and mute, the DMX bypass, the scare gate for every source, unsynced clock); version compare, release-asset pick and update status; backup create/validate/stage/apply on disk (path traversal and bad content refused, locks skipped, old pairing kept aside); backup and restore routes (attachment, no-store, password, big body, write header). Smoke run: quiet hours active, the scare refused, a backup downloaded, a restore with the pairing refused without confirmation, then staged, then applied on restart.
- **Review round (October):** a failed state save not blocking power-off, relay changes run in order, no second IR press when already on, the relay opening at shutdown, CEC re-configuring until it has a physical address, on-link IPv6 sources, the password guess limit, the free-space reserve and upload clean-up, the schedule's boot catch-up, mpv restarted after it gave up, the HDMI wait. The new tests were run against the old code and fail there.
- **First-boot repartitioning, the risky part:** the grow-and-add-partition block from `videofx-storage` was run as written in a Debian trixie container (parted 3.6, sfdisk 2.41) on a loop disk with partition 2 mounted. The old `parted -s ... resizepart 2` fails there with "Partition is being used" (exit 1), which would have stopped first boot. The `sfdisk` replacement grows the partition, `resize2fs` grows the mounted filesystem, the data partition is made, and both pass `e2fsck`.
- **QLC+ fixture** validates against QLC+'s `fixture.xsd`. **config.txt edits** are correct and idempotent on pi-gen's stock file. shellcheck is clean.

**Untested** (no Pi, no mpv):

- The image build, first boot on each board, and `install.sh` on Raspberry Pi OS.
- mpv on the Pi: DRM output as non-root, `HDMI-A-1`, hardware decoding per board, **the real seam times**, and mirror CPU cost.
- CEC with a real projector (including the `pwr-state:` output format), relay switching, IR send and learn, gpiomon, gpioset and gpio-ir on hardware, and the Pi 5 GPIO overlays.
- `videofx-update` end to end (GitHub download with a token, maintenance reboot and resume, rollback), `make-release.sh` from a clean checkout.
- The first-boot repartitioning (`videofx-storage`) on a real SD card and as a whole (only its partition steps ran, on a loop disk), overlayroot with `recurse=0` on a real card, maintenance mode, fsck after a real power cut, timesyncd with DHCP NTP, Wi-Fi power save and route metrics, the hardware watchdog and `systemd-notify` pings under systemd.
- The DigiAMP+ on each board and powering a Pi 5; that its unpopulated encoder/IR headers really leave GPIO 17, 23-25 and 27 floating; the fbdev blank turning HDMI off.
- From the review round: `ProtectHome=read-only` with the media bind mount, the `ExecStopPost` relay hook (`pinctrl`), the HDMI status files and how long your projector takes to report connected, CEC Active Source as a broadcast, `gpiomon -b` on libgpiod 1.x, the first-boot ordering after SSH key generation, and the `nofail` mounts.
- Apple Home pairing, the Scare switch in Home automations, the Occupancy and Temperature endpoints in Home, avahi and matter.js together, UniFi behaviour, and sACN from QLC+, xLights or FPP over Wi-Fi.
