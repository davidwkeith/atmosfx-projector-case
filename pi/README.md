# Pi player

Raspberry Pi software for the projector case (Pi 3B/3B+, 4B, 5 or Zero 2 W sled, each with a HiFiBerry Amp4). The Pi shows up as a **Matter on/off plug**. Switched on, it loops a playlist full screen on HDMI with VLC (for example the AtmosFX videos you bought). Switched off, the projector shows black. A small **web page** on the LAN manages the videos, the playlist and every setting, and shows the pairing code.

**Status: untested on hardware.** The logic is unit tested and the service was run on a Mac against a fake VLC. It has not been run on a Pi, the image has not been built, and it has not been paired with Apple Home. See [What is verified](#what-is-verified).

## How it works

- **Name.** Each Pi names itself `VideoFX-XXXX` on first boot, where XXXX is the last 4 hex digits of its eth0 MAC (wlan0 if there is no eth0). That name is used for the hostname, `videofx-xxxx.local`, the Bonjour entry, the Matter device name and the web page title.
- **Matter.** [matter.js](https://github.com/matter-js/matter.js) (0.17.9, Node 24) exposes one On/Off Plug-in Unit over Wi-Fi or Ethernet. Pairing state lives in `/var/lib/videofx/matter`. The pairing passcode is random per device and is kept there.
- **Playback.** On: `cvlc --fullscreen --loop --no-osd --no-video-title-show --drm-vout-display=HDMI-A-1 <playlist>`, with audio sent to the HiFiBerry Amp4 (ALSA `plughw:CARD=sndrpihifiberry,DEV=0`) and video via DRM/KMS (there is no desktop). If VLC crashes while on, it is restarted after 2 s. After more than 5 crashes in a minute the player gives up and reports **off** to Matter. Off: VLC is stopped and tty1 is cleared to black. Before the Pi is paired, tty1 shows the pairing QR code and web address instead.
- **Accurate state.** The web page's Play/Stop writes the Matter on/off attribute, so Apple Home and the page always agree. Playing with an empty or missing playlist is refused, and Matter goes back to off.
- **After a reboot or power cut** the last state is restored (`VIDEOFX_RESTORE=last`). It can be set to always `on` or always `off`.
- **Web UI** at `http://videofx-xxxx.local/`. It lists, uploads and deletes videos, lets you reorder and enable or disable playlist entries, and has Play/Stop, a speaker volume slider with mute, **Settings** for everything in `/etc/default/videofx`, the pairing QR code, and a guarded "Reset Matter pairing". It is plain HTML, CSS and JS served by the same Node process and works on a phone. Saving the playlist while it plays restarts VLC so the change takes effect.
- **Services.** `videofx-player.service` runs `/opt/videofx/src/main.js` as your login user, with the `video render audio tty` groups and `CAP_NET_BIND_SERVICE` for port 80. `videofx-hostname.service` runs on first boot only. Avahi publishes the name and the web page.

### mDNS: matter.js and avahi side by side

matter.js runs its own mDNS responder. It cannot use avahi. It binds UDP 5353 with `SO_REUSEADDR` (`reuseAddress: true` in `@matter/general` `UdpMulticastServer`) and publishes its records under a MAC-based host name, `<MAC>0000.local` (`MdnsAdvertisement.js`). avahi (installed by default on Raspberry Pi OS) owns `videofx-xxxx.local` and publishes the web page from a static service file, `/etc/avahi/services/videofx.service` (`_http._tcp`, port 80, name = hostname). The two responders never publish the same name, and Linux delivers multicast to both sockets, so they don't conflict. The known limitation: a unicast mDNS reply sent to port 5353 reaches only one of the two sockets. Controllers query by multicast, and this setup is common for matter.js on Raspberry Pi OS, but it has not been tested here with Apple Home.

## Files

```
pi/
  src/main.js          Matter node + player + web server wiring
  src/player.js        playback state machine (on/off, crash restart, restore)
  src/config.js        every setting: env name, default, validation, when it applies
  src/settings.js      settings.json store: precedence, password rules, migration
  src/media.js         media folder and playlist file access (path checks, upload limits)
  src/playlist-core.js playlist format and file-name rules (shared with the browser)
  src/web.js           HTTP server: LAN-only, Host check, basic auth, CSRF header
  src/qr.js            pairing QR code as SVG
  src/screen.js        tty1: black screen / pairing code
  src/volume.js        amp volume: clamp, persist, apply with amixer
  public/              web UI (index.html, app.css, app.js)
  system/              videofx-player.service, videofx-hostname(.service), videofx.avahi.service, videofx.default, asound.conf, setup.sh
  image/build.sh       pi-gen image build
  image/stage-videofx/      pi-gen custom stage
  install.sh           set up a stock Raspberry Pi OS Lite instead of building an image
  config.example       image build settings; copy to pi/config (gitignored)
  test/                Vitest
```

## Supported boards

One arm64 image and one `install.sh` cover all four sleds. pi-gen's arm64 build installs both kernels (`linux-image-rpi-v8` for the Pi 3, 4 and Zero 2 W; `linux-image-rpi-2712` for the Pi 5), and the firmware picks the right one at boot.

| Board | HDMI port for the projector | DRM name | Video decode | Amp4 powering the Pi |
|---|---|---|---|---|
| Pi 3B / 3B+ | the only HDMI port | `HDMI-A-1` | H.264 in hardware, up to 1080p30 | HiFiBerry says it's fine ("any Pi up to the Pi4B"). Not tested here |
| Pi 4B | **HDMI0**, next to USB-C | `HDMI-A-1` | H.264 and HEVC in hardware | HiFiBerry says it's fine ("up to the Pi4B"). Not tested here |
| Pi 5 | **HDMI0**, next to USB-C | `HDMI-A-1` | **no H.264 hardware decoder**: H.264 is decoded in software (Raspberry Pi quotes about 10-20% CPU for 1080p24); HEVC in hardware | HiFiBerry says it's fine for "the Pi5 alone" but publishes no 5 V current rating. Not tested here; see below |
| Zero 2 W | mini-HDMI (adapter or cable) | `HDMI-A-1` | H.264 in hardware (same VideoCore IV as the Pi 3); only 512 MB RAM | covered by HiFiBerry's "up to the Pi4B" and draws far less than a Pi 4. Not tested here. Needs a 40-pin header soldered on |

Sources: Raspberry Pi's [video playback guide](https://github.com/raspberrypi/documentation/blob/master/documentation/asciidoc/computers/os/playing-audio-and-video.adoc) (`HDMI-A-1` is the only HDMI port on the Pi 3 and Zero, and HDMI0 on the Pi 4B and later), the [BCM2712 page](https://github.com/raspberrypi/documentation/blob/master/documentation/asciidoc/computers/processors/bcm2712.adoc) (Pi 5 decode), the [Amp4 datasheet](https://www.hifiberry.com/docs/data-sheets/datasheet-amp4/) and HiFiBerry's [Pi 5 compatibility post](https://www.hifiberry.com/blog/pi5-compatibility-with-hifiberry-products/).

- **Video output.** VLC is pinned to `HDMI-A-1` (`VIDEOFX_VIDEO_OUTPUT`, also in the web page), so on a Pi 4B or 5 the projector must be on **HDMI0**, the port next to USB-C. Leave HDMI1 empty. VLC's defaults use hardware decode where the board has it and fall back to software, so the Pi 5 needs nothing special.
- **config.txt is the same on every board.** `setup.sh` only changes `dtparam=audio=off`, `vc4-kms-v3d,noaudio` and adds `dtoverlay=hifiberry-dacplus-std` in an `[all]` section. None of these differ by model: the Pi 5 firmware uses the same `vc4-kms-v3d` line, and `dtparam=audio=off` is harmless on boards without an analogue jack (Pi 5, Zero 2 W). So no `[pi3]`/`[pi4]`/`[pi5]`/`[pi02]` sections are needed, and none are added.
- **Pi 5 power, a hardware decision for you.** A Pi 5 wants 5 V at 5 A from a USB-C PD supply. HiFiBerry says the Amp4 powers "the Pi5 alone" but gives no current figure, and power through the GPIO header can't negotiate USB-PD. Raspberry Pi's [power supply page](https://github.com/raspberrypi/documentation/blob/master/documentation/asciidoc/computers/raspberry-pi/power-supplies.adoc) says a Pi 5 without a 5 A supply limits its USB ports to 600 mA in total. For this build that's fine: nothing needs USB. If a Pi 5 shows under-voltage warnings (`vcgencmd get_throttled` other than `0x0`) or reboots under load, the Amp4 can't carry it in this setup. Use a Pi 4B sled, or give the Pi 5 its own 5 A USB-C supply; HiFiBerry's docs don't say whether that is safe alongside the Amp4, so ask them first. The software makes no attempt to work around this (for example with `usb_max_current_enable`).
- **Zero 2 W:** 512 MB is enough for this service and VLC with hardware decode. Use 720p files (see below), and expect uploads through the web page to be slower. It has no Ethernet, so the name comes from the wlan0 MAC.
- **Detected model:** the web page shows it under Settings > Fixed (from `/proc/device-tree/model`).

## Option A: build an image

You need Docker (Docker Desktop on a Mac: <https://docs.docker.com/desktop/>), git, rsync and uuidgen. The build uses [pi-gen](https://github.com/RPi-Distro/pi-gen/tree/arm64) (arm64 branch, pinned to one commit in `image/build.sh`), which produces Raspberry Pi OS Lite, Debian trixie, 64-bit.

```sh
cp pi/config.example pi/config    # fill in user, password, SSH key, Wi-Fi, country
pi/image/build.sh                 # 30-60+ min; image lands in pi/deploy/*-videofx.img.xz
```

`pi/config` is gitignored. Secrets are only written under `pi/.build/` (also gitignored). There is no `make` target, so the command above is the whole interface.

Flash with [Raspberry Pi Imager](https://github.com/raspberrypi/rpi-imager): **Choose OS > Use custom**, then pick the `.img.xz`. Skip Imager's OS customisation, because the image already has your user, SSH key and Wi-Fi. Every Pi flashed from the same image picks its own `VideoFX-XXXX` name on first boot.

Reproducibility: pi-gen and the npm dependencies are pinned (`package-lock.json`). Debian and NodeSource packages are whatever is current on build day.

## Option B: install on a stock Raspberry Pi OS Lite

1. Flash **Raspberry Pi OS Lite (64-bit)** with Raspberry Pi Imager. In its settings, set a user, SSH key and Wi-Fi.
2. Copy this folder over and run the installer:
   ```sh
   scp -r pi/ you@raspberrypi.local:videofx-setup
   ssh you@raspberrypi.local 'cd videofx-setup && sudo ./install.sh'
   ssh you@raspberrypi.local 'sudo reboot'
   ```
   The installer adds NodeSource's Node 24 repo if the system Node is older than 20.19, installs VLC (no GUI), avahi and the app, sets up the Amp4 (see Audio), disables the tty1 login prompt, adds `consoleblank=0 logo.nologo vt.global_cursor_default=0` to `cmdline.txt`, and renames the Pi to `VideoFX-XXXX`. It prints the new name. Run it again to update the app. Your settings in `/etc/default/videofx` are kept.

## Videos and playlist

The videos are your purchased files. None are included or downloaded.

- **Easiest:** open `http://videofx-xxxx.local/`, upload the videos, add them to the playlist, then **Save playlist**.
- **Or copy them yourself:** `scp *.mp4 you@videofx-xxxx.local:media/`. They go in `~/media/` of the login user, next to the playlist `~/media/playlist.m3u`. The playlist is a plain `.m3u` with one file name per line. The web UI marks disabled entries as `#VIDEOFX-DISABLED:name.mp4`, which VLC skips as a comment. You can also upload a `.m3u` through the page; it replaces the playlist after the file names are checked.
- Accepted files: `.mp4 .m4v .mov .mkv .webm .avi .mpg .mpeg .ts .wmv .mp3 .m4a .aac .wav .ogg .oga .flac`, and `.m3u`/`.m3u8` for the playlist. Uploads are capped at `VIDEOFX_MAX_UPLOAD_MB` (default 4096).

### Recommended encode

H.264 plays on every board: in hardware on the 3, 4 and Zero 2 W, and in software on the 5, which is fast enough. Use:

- **Pi 3 / 4 / 5:** H.264 High profile, level 4.1 or lower, 1080p, 30 fps or less, 8-bit 4:2:0, in `.mp4`, with AAC stereo 48 kHz audio.
- **Zero 2 W:** the same at **720p**, which is easy on its 512 MB and decoder.

Most AtmosFX downloads are already H.264 MP4. Only re-encode files that stutter or won't play. Do that on your computer with [ffmpeg](https://ffmpeg.org/); the Pi never transcodes on its own:

```sh
# 1080p (Pi 3 / 4 / 5). Keeps the frame rate; add -r 30 only if the source is above 30 fps.
ffmpeg -i in.mp4 -vf "scale=-2:'min(1080,ih)',format=yuv420p" \
  -c:v libx264 -profile:v high -level:v 4.1 -preset slow -crf 20 \
  -c:a aac -b:a 160k -ac 2 -ar 48000 -movflags +faststart out-1080p.mp4

# 720p (Zero 2 W)
ffmpeg -i in.mp4 -vf "scale=-2:'min(720,ih)',format=yuv420p" \
  -c:v libx264 -profile:v high -level:v 4.0 -preset slow -crf 21 \
  -c:a aac -b:a 160k -ac 2 -ar 48000 -movflags +faststart out-720p.mp4
```

## Audio

Sound comes from a **HiFiBerry Amp4** HAT on the Pi (TAS5756M, 2 channels) driving speakers behind the projection. The Amp4 is powered at 12-24 V (HiFiBerry recommends 12-20 V; 24 V is the absolute maximum) from the DC brick splice, **and it powers the Pi through the GPIO header**. There is no buck converter and no micro-USB supply. Per the [Amp4 datasheet](https://www.hifiberry.com/docs/data-sheets/datasheet-amp4/), it delivers about 14 W per channel into 4 Ω or 8 W into 8 Ω at 12 V, and more at higher voltage.

- **Speakers:** 4-8 Ω passive speakers, one per channel. Run ordinary speaker wire from the Amp4's screw terminals to each speaker: L+ to the left speaker's +, L- to its -, and the same for R. Keep the polarity the same on both speakers; the marked or ridged conductor goes to +. Swapped polarity on one speaker thins out the bass. The outputs **can't be bridged**. Never connect a speaker lead to ground or to the other channel.
- **Power budget:** the brick must supply the projector, the Pi and the amp at the same time. The amp draws most at high volume. Check the brick's label (volts and amps) against the projector's input, plus the Pi (at 5 V: roughly 1-1.5 A for a Pi 3, up to 3 A for a Pi 4, up to 5 A for a Pi 5, well under 1 A for a Zero 2 W, all before conversion losses in the Amp4), plus the amp's share at the volume you use. See [Supported boards](#supported-boards) for the Pi 5 caveat. If the Pi reboots on loud passages, the supply is short. See the case README's safety notes for the mains side.
- **Software (done by `setup.sh`):** `config.txt` gets `dtoverlay=hifiberry-dacplus-std` (HiFiBerry's [current overlay](https://www.hifiberry.com/docs/software/configuring-linux-3-18-x/) for the Amp4 on kernel 6.1.77 and newer; the datasheet's older `hifiberry-dacplus` is for earlier kernels), `dtparam=audio=off` (onboard audio off) and `vc4-kms-v3d,noaudio` (HDMI audio off). `/etc/asound.conf` pins the ALSA default to the card by name (`sndrpihifiberry`), and VLC is pointed at it explicitly.
- **Volume** uses the amp's hardware mixer, the `Digital` control, set through `amixer -M`. The web UI's slider and **Mute** save to `/var/lib/videofx/settings.json` and are reapplied at every start. An older `volume.json` is moved into it automatically. First boot starts at **30%**, because outdoor speakers can be loud. By default the kernel caps `Digital` at 0 dB, so 100% can't clip digitally.

## Pair with Apple Home

1. Power on with the projector connected. Until the Pi is paired, the projector shows a QR code, the manual code and `http://videofx-xxxx.local/`. The web page shows the same code, and so does `journalctl -u videofx-player -b | grep -A25 uncommissioned`.
2. iPhone (on the same Wi-Fi as the Pi and your home hub): **Home > + > Add Accessory**, then scan the code. If the camera won't read the white-on-black code on the projector, scan the one on the web page or choose **More options** and type the 11-digit code.
3. Home warns that the accessory is **not certified**, because it uses the Matter test vendor ID 0xFFF1. Choose **Add Anyway**.
4. It appears as a plug named `VideoFX-XXXX`. Rename it, put it in a room, and automate it (for example on at sunset, off at 11 pm).

To unpair from everything: web page > **Matter > Reset Matter pairing** (type `reset` to confirm). This does a Matter factory reset. Videos and the playlist are kept, the service restarts, and a new pairing code appears. You can also run `sudo systemctl stop videofx-player && sudo rm -rf /var/lib/videofx/matter && sudo systemctl start videofx-player`. Remove the old tile from Apple Home as well.

## Settings

Everything can be changed on the web page under **Settings**, so you don't need SSH for day-to-day use. Each setting shows its current value, where it comes from (*set here*, *from /etc/default/videofx*, or *default*), its default, and a **Reset** button that drops the web value.

- **Precedence:** web page (`/var/lib/videofx/settings.json`) > `/etc/default/videofx` > built-in default. The web page validates with the same rules as the file and rejects bad values with a message. `settings.json` is written to a temp file and renamed into place (mode 600). If it is ever corrupt, the service logs a warning, keeps a copy as `settings.json.corrupt`, and uses the file values and defaults.
- **Web password:** set it on the page (stored as a scrypt hash, never shown back; the page only says *set* or *not set*). Changing it needs the current password. Removing it needs the current password and a confirmation. Reset goes back to the password in `/etc/default/videofx`, if there is one.
- **Advanced:** extra VLC arguments. They go to VLC directly with no shell, and anything that opens a network, control or scripting interface is refused: `--extraintf`, `--intf`/`-I`, `--control`, `--lua-*`, `--http-*`, `--telnet-*`, `--rc-*`, `--cli-*`, `--sout*`, `--config`, `--plugin(s)-path`, `--daemon`, and any `://` URL.
- **Restart service** is on the page too. It uses the same clean exit as the Matter reset, and systemd starts the service again.

`/etc/default/videofx` is root-only (mode 600, because it may hold the password). Run `sudo systemctl restart videofx-player` after editing it.

| Key | Default | Takes effect | |
|---|---|---|---|
| `VIDEOFX_NAME` | hostname (`videofx-xxxx`) | at once (Matter node label updated live; Apple Home keeps any name you gave it) | Matter and web name |
| `VIDEOFX_RESTORE` | `last` | at once | state after power loss: `last`, `on`, `off` |
| `VIDEOFX_WEB_PASSWORD` | empty | at once | basic-auth password (any user name). Also settable in `pi/config` |
| `VIDEOFX_WEB_HOSTS` | | at once | extra host names the page answers to (e.g. a UniFi local DNS name) |
| `VIDEOFX_MAX_UPLOAD_MB` | 4096 | at once | upload cap |
| `VIDEOFX_VOLUME_DEFAULT` | 30 | at once | starting speaker volume; the slider saves its own value |
| `VIDEOFX_AUDIO_CARD`, `VIDEOFX_MIXER_CONTROL` | `sndrpihifiberry`, `Digital` | next play | ALSA card name and mixer control |
| `VIDEOFX_VIDEO_OUTPUT` | `HDMI-A-1` | next play | DRM connector; empty lets VLC choose |
| `VIDEOFX_VLC_EXTRA_ARGS` | `--aout=alsa --alsa-audio-device=plughw:CARD=<card>,DEV=0` | next play | Advanced; replaces the audio args |
| `VIDEOFX_CONSOLE` | `/dev/tty1` | service restart | empty disables the black/pairing screen |
| `VIDEOFX_HTTP_PORT` | 80 | file only | also change `<port>` in `/etc/avahi/services/videofx.service` |
| `VIDEOFX_MATTER_PORT` | 5540 | file only | |
| `VIDEOFX_MEDIA_DIR`, `VIDEOFX_PLAYLIST` | `~/media`, `~/media/playlist.m3u` | file only | |
| `VIDEOFX_VLC` | `cvlc` | file only | |

The ports, paths and VLC command are **file only** on purpose. Changing the ports needs root (the port-80 capability and the avahi file), and letting the web page change paths or the VLC command would let it point the service at anything the user can reach. The service does not run as root just to allow that.

### Web page security

- The page answers only requests from private, link-local, loopback or ULA addresses (10/8, 172.16/12, 192.168/16, 169.254/16, 127/8, fc00::/7, fe80::/10). A port forward from the internet gets 403. Do not forward port 80 anyway.
- It only accepts `Host:` values that are an IP, `localhost`, `videofx-xxxx`, `videofx-xxxx.local`, the device name or `VIDEOFX_WEB_HOSTS`. This blocks DNS rebinding.
- Every write needs an `X-VideoFX: 1` header, so another web site can't post to it from your browser (CSRF). The optional password uses HTTP basic auth. It is plain HTTP on your LAN, not HTTPS.
- File names must be plain names directly in the media folder: no `/`, `\`, leading `.` or control characters, resolved and re-checked against the folder. Symlinks are not listed or deleted. Media files are never served back. Only the four UI files are served from disk. Uploads go to a temp file and are renamed into place, and they are limited by size and by extension.

## UniFi networks

Checked against Ubiquiti's help articles as of September 2026 (UniFi Network 9.x/10.x). UniFi renames menus often; if a name doesn't match what you see, search for the setting in the UI.

**Short version:** put the Pi, the Apple home hub (HomePod or Apple TV) and the iPhone you pair with on **the same network (VLAN)**, then check the Wi-Fi settings below.

**Same network, no IoT VLAN (recommended)**
- Matter finds devices over mDNS (`_matterc._udp` while pairing, `_matter._tcp` afterwards) and talks over IPv6. On one Layer 2 network, IPv6 link-local (`fe80::`) addresses work with no router setup. Apple says to keep iPhone, accessories and home hubs on the same Wi-Fi network ([Apple](https://support.apple.com/en-us/126198)). A matter.js-based project makes the same point about VLANs ([HAMH connectivity guide](https://riddix.github.io/home-assistant-matter-hub/guides/connectivity-issues)).
- Leave **Network Isolation** off for that network: Settings > Networks > *network* ([Ubiquiti: Network and Client Isolation](https://help.ui.com/hc/en-us/articles/18965560820247-Implementing-Network-and-Client-Isolation-in-UniFi)).

**If the Pi has to be on another VLAN**
- The gateway's **mDNS Proxy** (Settings > Networks) repeats mDNS between networks, in **Auto / Off / Custom** mode. In Custom mode you pick the VLANs and services and can add your own `_service._protocol.local` ([Ubiquiti: Gateway mDNS Proxy](https://help.ui.com/hc/en-us/articles/12648701398807-UniFi-Gateway-Multicast-DNS-mDNS-Proxy)). Ubiquiti's Auto list includes Matter `_matterc._udp`/`_matterd._udp` and Web Servers `_http._tcp`, but **not `_matter._tcp`** ([Ubiquiti: Switch Settings](https://help.ui.com/hc/en-us/articles/33402927617047-UniFi-Switch-Settings)). In Custom mode, add `_matter._tcp.local` yourself. One of Ubiquiti's articles names the modes All/Auto/Custom instead, so check the UI.
- mDNS repeating is not enough on its own. Link-local IPv6 doesn't cross VLANs, so both networks need routable IPv6 (a ULA `fd00::/8` or a global prefix) and firewall rules that allow UDP 5540 and its replies between them ([Ubiquiti: Configuring IPv6](https://help.ui.com/hc/en-us/articles/36378535649687-Configuring-IPv6-in-UniFi)). This is why one network is simpler.

**IPv6**
- Matter uses IPv6 for its operational traffic ([Google Matter primer](https://developers.home.google.com/matter/primer/thread-and-ipv6)). Don't disable IPv6 on the Pi; Raspberry Pi OS leaves it on. On one flat network, link-local is enough even if the UniFi network has no IPv6 prefix configured. That is reasoning from how link-local works (it stays at Layer 2 and never reaches the gateway); Ubiquiti doesn't document it.

**Wi-Fi** (Settings > WiFi > *SSID*; names from [Ubiquiti: WiFi SSID and AP Settings](https://help.ui.com/hc/en-us/articles/32065480092951-UniFi-WiFi-SSID-and-AP-Settings-Overview))
- **Client Device Isolation**: off.
- **Multicast and Broadcast Control**: off, or add the Pi, the home hub and the iPhone as exceptions. It limits mDNS to listed clients.
- **Multicast Enhancement** (multicast to unicast): try off if discovery is flaky. Ubiquiti notes that some smart home devices need it disabled ([Ubiquiti: Optimizing WiFi](https://help.ui.com/hc/en-us/articles/221029967-Optimizing-WiFi-Connectivity-and-Reducing-Latency)).
- **Proxy ARP** answers ARP/NDP on clients' behalf. If you have trouble, try turning it off. This is a guess; no source ties it to Matter.

**Switches** (Settings > Networks > *network*)
- **IGMP Snooping**: if it is on, set **Forward Unknown Multicast Traffic** to flood, or turn snooping off. The default is Drop. Only 224.0.0.0/24, which includes IPv4 mDNS, is always flooded; IPv6 mDNS `ff02::fb` is not covered by that note ([Switch Settings](https://help.ui.com/hc/en-us/articles/33402927617047-UniFi-Switch-Settings)).

**Name in the client list and DNS**
- The Pi sends its hostname (`videofx-xxxx`) in DHCP. The image's Wi-Fi profile sets `dhcp-send-hostname=true`, and NetworkManager's default does the same for `install.sh`. UniFi normally lists clients by that name. That is expected behaviour, not confirmed in Ubiquiti's docs. Reboot after `install.sh` so the new name goes out in DHCP.
- `videofx-xxxx.local` works on the same network, or across VLANs with the mDNS Proxy (Auto includes `_http._tcp`). For a name that doesn't use mDNS: Client Devices > *the Pi* > Settings > **Fixed IP Address** + **Local DNS Record** ([Ubiquiti: DNS Records and Local Hostnames](https://help.ui.com/hc/en-us/articles/15179064940439-UniFi-DNS-Records-and-Local-Hostnames)). Add that name to `VIDEOFX_WEB_HOSTS`.

(help.ui.com blocks scripted fetches with a bot check. The pages open in a browser; they were read through the help centre's article API.)

## Troubleshooting

```sh
journalctl -u videofx-player -f          # player, Matter and web logs
systemctl status videofx-player
cat /var/lib/videofx-name                # this Pi's name
aplay -l                            # should list sndrpihifiberry and nothing else
amixer -c sndrpihifiberry sget Digital
```

- **No picture when the projector is powered after the Pi:** KMS may not see the HDMI display. Add `video=HDMI-A-1:1280x720@60D` (use the projector's native mode) to `/boot/firmware/cmdline.txt` and reboot.
- **No picture on a Pi 4B / 5:** the projector must be on HDMI0, next to USB-C. `kmsprint | grep Connector` lists the connectors; on a Pi 5, `kmsprint` only shows the first card.
- **VLC says no video output:** add `--vout=drm_vout` to the extra VLC arguments, or `sudo apt install vlc` (the full package) in case a plugin is missing.
- **Pi 5 reboots or is throttled:** `vcgencmd get_throttled` should say `0x0`. See the Pi 5 power note under [Supported boards](#supported-boards).
- **No sound:** `aplay -l` must show `sndrpihifiberry`. If it doesn't, check the `dtoverlay=hifiberry-dacplus-std` line in `/boot/firmware/config.txt` (on a kernel older than 6.1.77 use `hifiberry-dacplus`) and reboot. Test with `speaker-test -c2 -t wav` at low volume. Check the web UI isn't muted.
- **Apple Home can't find it:** make sure the iPhone and home hub are on the same network as the Pi (see UniFi above), and check the journal for "uncommissioned".

## Development

```sh
cd pi
npm ci
npm test        # Vitest. The web tests open a local port: run outside a sandbox that blocks binding
VIDEOFX_VLC=/bin/cat VIDEOFX_CONSOLE= VIDEOFX_MEDIA_DIR=/tmp/videofx-media VIDEOFX_STATE_DIR=/tmp/videofx-state \
  VIDEOFX_HTTP_PORT=8080 VIDEOFX_NAME=VideoFX-TEST node src/main.js   # then open http://localhost:8080
```

Needs Node 20.19+ to run and Node 22.12+ for the tests (Vitest 5).

## What is verified

Verified on a Mac (Node 26, `npx vitest run` in `pi/`, run outside the sandbox because the web tests bind 127.0.0.1):
- `npm install` of `@matter/main` 0.17.9 and `vitest` 5.0.2, pinned in `package-lock.json`. Production dependencies are pure JS.
- The matter.js API used here was checked against the installed package, not written from memory: `ServerNode.create`, `OnOffPlugInUnitDevice`, `endpoint.set({ onOff: { onOff } })`, `server.set({ basicInformation: { nodeLabel } })` at runtime, `events.onOff.onOff$Changed`, `lifecycle.{online,commissioned,decommissioned,isCommissioned}`, `state.commissioning.{pairingCodes,fabrics}`, `server.erase()`, the `storage.path` variable and `QrCode.get`.
- 217 Vitest tests pass. They cover:
  - the player state machine
  - the playlist, media store and path traversal
  - the web server guards
  - volume
  - QR-to-SVG
  - settings: precedence and source reporting, validation for every field, the VLC deny-list, the password set/change/clear/reset rules and hashing, the `volume.json` migration, atomic writes and write failure, a corrupt or partly invalid `settings.json`
  - the settings HTTP API
- The full service ran against a fake `cvlc`. Upload, save, play, restart-on-save, stop, delete, volume, the Matter reset and SIGTERM all worked. Settings were changed over HTTP: the device name updated the Matter node label live, a bad VLC argument was refused, a console change flagged "restart needed", and an existing `volume.json` was migrated at startup.
- The web UI was checked in a browser at phone size, including Settings.
- `image/build.sh` was run up to the Docker step. shellcheck passes on all scripts. The `config.txt` edits were run twice on a copy of pi-gen's stock `config.txt`: the result is correct and the second run changes nothing.
- The board facts in [Supported boards](#supported-boards) come from Raspberry Pi's and HiFiBerry's docs (linked there), not from hardware.

Untested (no Pi, no Docker here):
- The image build itself, first boot on each of the four boards, and `videofx-hostname` (including skipping the eth0 wait on a Zero 2 W).
- `install.sh` and `setup.sh` on Raspberry Pi OS: package names `vlc-bin vlc-plugin-base vlc-plugin-video-output`, NodeSource on arm64, `npm ci` on the Pi.
- VLC on each board: DRM/KMS output as a non-root user, `--drm-vout-display=HDMI-A-1`, hardware decode on the 3 / 4 / Zero 2 W, software H.264 on the 5, looping.
- The Amp4 on each board: overlay, card name `sndrpihifiberry` (taken from the kernel driver source, not seen on a device), the `Digital` control, and the Amp4 powering the Pi (above all the Pi 5).
- tty1 blanking and pairing screen (which HDMI port the console uses on a Pi 4 / 5), and the QR code being readable on the projector.
- Commissioning with Apple Home, avahi and matter.js together on 5353, and the UniFi behaviour described above.
