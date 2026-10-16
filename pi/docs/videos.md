# Videos, playlist, scare mode

Your purchased videos are not included or downloaded. Put them on a USB stick, upload them on the web page, or `scp` them to `~/media/` on the Pi.

- **USB stick:** plug a stick with your videos into the Pi, in whatever folders they came in (an unzipped AtmosFX download is fine). The Pi mounts it read-only, copies every video and audio file into the media folder from any folder depth, and makes those files the playlist, in name order. In loop mode it starts playing them. macOS `._` files, hidden folders and other files are skipped, and a file name that appears in several folders is copied once. Files already on the Pi (same name and size) are not copied again, and older files stay on the Pi, off the playlist. The Media screen shows the progress; pull the stick out when it says the import is done (it is mounted read-only, so pulling it early loses nothing). If the card fills up, the import stops at that file and the playlist is left as it was. FAT32, exFAT, NTFS and ext4 sticks work.
- **First upload:** while the playlist is empty or holds only the built-in test clip, uploaded videos go onto the playlist by themselves, in name order. It stays automatic (later uploads join it) until you save the playlist by hand; after that, uploads wait for you to add them. The file marks this with a `#VIDEOFX-AUTO` line, which mpv ignores.

Until then, a fresh Pi plays a built-in test clip: "VideoFX" bouncing over a light alignment grid (also handy for focus and aiming). It is copied into the media folder as `videofx-default.mp4` and made the playlist only when no playlist file exists, so deleting it sticks. Regenerate it with `tools/make-default-video.sh`.

- **Loop mode:** build the playlist on the page (order, enable/disable, shuffle, save). Saving while playing reloads it in mpv. **Shuffle** plays the enabled clips in random order, each once per round, reshuffled every round and never the same clip twice in a row; it is saved in the playlist file as a `#VIDEOFX-SHUFFLE` line, which mpv ignores. The page shows each clip's length and the total for one pass through the enabled clips. Lengths are read from the file header of MP4, M4V and MOV files; other formats show no length.
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
