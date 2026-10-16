# VideoFX: the Pi side of the projector case

Raspberry Pi software for the projector case. The sled can be a Pi 3B/3B+, 4B, 5 or Zero 2 W, each with a Raspberry Pi DigiAMP+ amplifier HAT. The Pi shows up in Apple Home (or any Matter controller) as **VideoFX-XXXX**:

- **Loop mode** plays a playlist full screen, over and over, for example the AtmosFX videos you bought.
- **Scare mode** loops a calm clip, and on a trigger plays a scare clip, then goes back to the calm clip. A trigger can be a Home automation, the PIR motion sensor, DMX or the web page.

It also:

- switches the projector over HDMI-CEC, a relay (plus IR) or the HDMI signal;
- follows a weekly schedule with "on at sunset";
- takes DMX over sACN from show software;
- watches the Pi's own temperature and switches the projector off if it overheats; the Pi 3/4 sled fan is switched by the kernel (the projector's fan does the case cooling).

A web page on your LAN (`http://videofx-xxxx.local/`) handles videos, the playlist, scare clips, the schedule and every setting. It has six screens (Dashboard, Media, Scares, Schedule, Settings, System), and every screen has a **?** button with help for that screen. A bar at the top of every screen shows the clip playing (a frame from it, elapsed time and length) with a Play/Pause button (pause freezes the picture, projector still on); tapping it goes back to the Dashboard.

**Status: untested on hardware.** The logic is unit tested (534 tests). The whole service was run on a Mac against a fake mpv, with real UDP sACN. Nothing has run on a Pi, the image has not been built, and nothing has been paired with Apple Home. See [What is verified](#what-is-verified).


## Documentation

The user guides live in [`docs/`](docs/index.md). The web page shows the same files (Docs link, top right).

- Get started: [How it works](docs/how-it-works.md), [Supported boards](docs/boards.md), [Install](docs/install.md), [Pair with Apple Home](docs/apple-home.md)
- Daily use: [Videos, playlist, scare mode](docs/videos.md), [Schedule and quiet hours](docs/schedule.md), [Settings](docs/settings.md), [Projector power](docs/projector.md), [DMX (sACN)](docs/dmx.md)
- Hardware: [GPIO pins and wiring](docs/wiring.md), [Audio](docs/audio.md), [Cooling](docs/cooling.md)
- Keeping it running: [Reliability](docs/reliability.md), [Updates and backup](docs/updates.md), [Security and guests](docs/security.md), [UniFi networks](docs/networks.md), [Troubleshooting](docs/troubleshooting.md)

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
  public/              web page (plain HTML/CSS/JS); public/help/ holds the in-page help, one Markdown file per screen and settings group
  system/              systemd units, udev rules, avahi service, asound.conf, videofx.default, setup.sh,
                       videofx-storage (+ .service), videofx-maint, videofx-update (+ resume service),
                       videofx-verify-release (checks a release's GitHub attestation, src/verify-release.js),
                       NetworkManager/timesyncd/watchdog config
  tools/make-release.sh  release tarball for GitHub Releases
  image/               pi-gen build (build.sh, stage-videofx/)
  dmx/DIY-VideoFX-Player.qxf   QLC+ fixture
  tools/sacn-send.mjs  tiny sACN sender for testing; gen-default.mjs regenerates videofx.default
  test/                Vitest (534 tests), test/fixtures/fake-mpv.mjs
  install.sh, config.example
```


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

- **534 tests pass.** They cover:
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
