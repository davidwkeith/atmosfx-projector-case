# Troubleshooting

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
- **Stutter on a Pi 3 or Zero 2 W:** re-encode (see [Videos](videos.md)), or add `--hwdec=v4l2m2m-copy`.
