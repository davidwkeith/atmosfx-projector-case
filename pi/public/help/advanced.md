# Advanced

## Extra mpv options

Extra `--name=value` options for the player, separated by spaces and added after the built-in ones, so they can override them. A common one is `--hwdec=v4l2m2m-copy` if a Pi 3 or Zero 2 W struggles with decoding.

Only decoding, DRM output, scaling, sync, cache, audio-timing and a few filter options are accepted. Everything else is refused, including anything that can read or write files. Wrong options can stop playback; clear the field and apply to go back.

This group is only listed when **Show advanced settings** is on. Other advanced rows live in their own groups.

Read more: [Settings](https://github.com/davidwkeith/atmosfx-projector-case/blob/main/pi/README.md#settings)
