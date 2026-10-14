# Videos, playlist, scare mode

Your purchased videos are not included or downloaded. Upload them on the web page, or `scp` them to `~/media/` on the Pi.

- **Loop mode:** build the playlist on the page (order, enable/disable, save). Saving while playing reloads it in mpv.
- **Scare mode:**
  1. Upload the calm clip and the scare clips. Files named like `Ghost_Buffer.mp4` and `Ghost_Scare1.mp4` get paired by **Suggest from file names**.
  2. Pick the calm clip and the scare clips in **Scare mode**, and save.
  3. Set Settings > Playback > **Mode** to `scare`.
  4. Tune the order (sequential/random), the cooldown (default 20 s, counted from the end of a scare), and what happens to a trigger during a scare: `ignore` (default) or `queue` (one scare, played after the cooldown).
  5. Trigger with **Scare now**, the **Scare** switch in Home (for example, "when the doorbell rings, turn on Scare"), the PIR, or DMX.
- **The seam.** The calm clip loops with `loop-file=inf`. The next scare clip and the calm clip after it are already queued, so mpv's `--prefetch-playlist` opens them early. A trigger sets `loop-file=no` and sends `playlist-next`. The service measures each seam from mpv's events and logs it (`journalctl -u videofx-player | grep seam`); the page shows it too. **It has not been measured on a Pi:** the Mac test used a fake mpv, whose ~50 ms is its own simulated delay.
- **Recommended encode:** H.264 High, level 4.1 or lower, 1080p30 (720p for the Zero 2 W), 8-bit 4:2:0 MP4, AAC stereo 48 kHz. Re-encode on your computer only if a file stutters (see "Re-encoding a file" below).
- **Mirror** (Settings > Display): flips left-right at once through mpv IPC (`vf add @mirror:hflip`). The flip runs on the CPU, so it switches decoding to `auto-copy`. That's fine on a 4B or 5 and probably too heavy for 1080p on a 3 or Zero 2 W (not measured).

## Re-encoding a file

```sh
ffmpeg -i in.mp4 -vf "scale=-2:'min(1080,ih)',format=yuv420p" -c:v libx264 -profile:v high -level:v 4.1 \
  -preset slow -crf 20 -c:a aac -b:a 160k -ac 2 -ar 48000 -movflags +faststart out.mp4
```

Use `min(720,ih)` and `-level:v 4.0` for the Zero 2 W. For rear projection on a Pi 3 or Zero 2 W, pre-flip the files with `-vf "hflip,scale=..."` instead of using the Mirror setting.
