# Supported boards

One arm64 image and one `install.sh` cover all four sleds. pi-gen installs both kernels (`linux-image-rpi-v8` and `linux-image-rpi-2712`), and the firmware picks the right one.

| Board | Projector on | DRM connector | Decoding | DigiAMP+ powering the Pi |
|---|---|---|---|---|
| Pi 3B / 3B+ | the only HDMI port | `HDMI-A-1` | H.264 in hardware up to 1080p30 (V4L2 M2M) | Raspberry Pi: "designed to work with Raspberry Pi 3 and earlier"; 5.1 V at 2.5 A over the header. Not tested here |
| Pi 4B | **HDMI0**, next to USB-C | `HDMI-A-1` | H.264 and HEVC in hardware | Raspberry Pi: on a Pi 4 "or later", use a powered USB hub so the ports add no load. Not tested here |
| Pi 5 | **HDMI0**, next to USB-C | `HDMI-A-1` | **no H.264 hardware decoder**: software (about 10-20% CPU for 1080p24 per Raspberry Pi); HEVC in hardware | 2.5 A is well under the Pi 5's 5 A budget; Raspberry Pi only promises the Pi 3. Not tested; see below |
| Zero 2 W | mini-HDMI | `HDMI-A-1` | as the Pi 3; only 512 MB RAM, so use 720p | any 40-pin board per Raspberry Pi; draws far less. Not tested. Solder a 40-pin header |

Sources: Raspberry Pi's [video playback page](https://github.com/raspberrypi/documentation/blob/master/documentation/asciidoc/computers/os/playing-audio-and-video.adoc) (connector names), its [BCM2712 page](https://github.com/raspberrypi/documentation/blob/master/documentation/asciidoc/computers/processors/bcm2712.adoc) (Pi 5 decoding) and [power supply page](https://github.com/raspberrypi/documentation/blob/master/documentation/asciidoc/computers/raspberry-pi/power-supplies.adoc); Raspberry Pi's [DigiAMP+ product brief](https://pip-assets.raspberrypi.com/categories/765-raspberry-pi-digiamp/documents/RP-008138-DS-1-digiamp-plus-hat-product-brief.pdf) (power, dimensions, 0-50 °C operating range), [product page](https://www.raspberrypi.com/products/digiamp-plus/) and [audio HAT docs](https://www.raspberrypi.com/documentation/accessories/audio.html) (Pi model notes, mute GPIO, overlay parameters).

- mpv is pinned to `--drm-connector=HDMI-A-1` (the **Video output** setting), so on a Pi 4B or 5 use **HDMI0**. The option name was checked against the mpv 0.40 manual.
- mpv runs with `--vo=gpu --gpu-context=drm --hwdec=auto-safe`. mpv's docs don't list the Pi's V4L2 decoder in `auto`'s whitelist. If a Pi 3 or Zero 2 W struggles, add `--hwdec=v4l2m2m-copy` under Settings > Advanced (switch on **Show advanced settings** first; not verified).
- **Pi 5 power is a hardware decision for you.** A Pi 5 wants 5 V/5 A over USB-C PD. The GPIO header can't negotiate PD, and the DigiAMP+ supplies 5.1 V at 2.5 A. If `vcgencmd get_throttled` isn't `0x0` or it reboots under load, use a Pi 4B sled; don't add a second 5 V supply, Raspberry Pi says not to power the Pi's own input while the DigiAMP+ is fitted. The software doesn't work around it.
- **config.txt:** the audio, IR and relay lines are the same on every board and go in `[all]`. Older installs also had overlays for the since-removed fans and temperature sensors; `setup.sh` removes that block.
