# Troubleshooting

Start with the dashboard's **Setup checks** list (see below): it covers most of what goes wrong on a new build. The commands here are for what it can't tell.

```sh
journalctl -u videofx-player -f        # everything: player, Matter, DMX, schedule, seams, thermal
cat /var/lib/videofx-name
kmsprint | grep Connector              # HDMI connectors (Pi 5: first card only)
cec-ctl -d /dev/cec0 --playback -S     # is there CEC?
ir-ctl -f -d /dev/lirc0                # IR devices (TX and RX may swap numbers)
aplay -l; amixer -c DigiAMP sget Digital
vcgencmd get_throttled                 # under-voltage (Pi 5 on the DigiAMP+)
```

- **No picture on a 4B or 5:** use HDMI0. **No picture when the projector is powered after the Pi:** playback waits up to 20 s for the HDMI connection and starts again when it appears (`journalctl -u videofx-player | grep HDMI`). If your projector never reports itself connected, add `video=HDMI-A-1:1280x720@60D` to `cmdline.txt`.
- **mpv errors about the DRM device on a Pi 5:** add `--drm-device=/dev/dri/card1` in Settings > Advanced.
- **Stutter on a Pi 3 or Zero 2 W:** re-encode (see [Videos](videos.md)), or add `--hwdec=v4l2m2m-copy`.

## Setup checks

The dashboard runs these about 30 seconds after start-up and whenever you press **Run checks**. Each is OK, a problem, not sure yet (the Pi can't tell, for example when a tool is missing) or not used.

| Check | What it looks at | Usual fix for a problem |
|---|---|---|
| Raspberry Pi | The board model (`/proc/device-tree/model`) | A board VideoFX does not know: see [Supported boards](boards.md) |
| Amplifier | The ALSA card named in Settings > Audio (`/proc/asound/cards`) | Seat the DigiAMP+, power it from its barrel jack, check `config.txt` |
| Projector on HDMI | The connector status and the EDID: name and preferred resolution | Use HDMI0 on a 4B or 5 and switch the projector on |
| Projector control (CEC) | One power-status request with `cec-ctl` (only in the CEC and hdmi-off modes; it wakes nothing) | Switch the projector on and check again; if it never answers, use hdmi-off or the relay ([Projector power](projector.md)) |
| Motion sensor | Whether the PIR input has changed since start-up | Walk past it; if nothing, check the pin and wiring ([GPIO pins and wiring](wiring.md)) |
| Power supply | `vcgencmd get_throttled`: under-voltage now or since start-up | A steadier 5 V supply and a shorter, thicker cable |
| Pi temperature | The SoC temperature against the warning level | Sled fan and vents ([Cooling](cooling.md)) |
| Network | Ethernet, or the Wi-Fi link and its signal | Wi-Fi is set in Raspberry Pi Imager ([UniFi networks](networks.md) for mesh setups) |
| Network time | Whether NTP has synced; the schedule and sunset wait for it | Internet access for the Pi |
| Videos | The same check as **Play**: something enabled to play in the current mode | Upload and enable clips ([Videos](videos.md)) |

A problem is also written to the health log (System > Health log), so a check that failed at start-up and passed later still shows.
