# Advanced

## Extra mpv options

Extra `--name=value` options for the player, separated by spaces and added after the built-in ones, so they can override them. A common one is `--hwdec=v4l2m2m-copy` if a Pi 3 or Zero 2 W struggles with decoding.

Only decoding, DRM output, scaling, sync, cache, audio-timing and a few filter options are accepted. Everything else is refused, including anything that can read or write files. Wrong options can stop playback; clear the field and apply to go back.

## Sound card

With the Raspberry Pi DigiAMP+, the card name is `DigiAMP` and the mixer control is `Digital`. Use the card's name, never its number: numbers can change between restarts. `aplay -l` on the Pi shows the names. Volume and mute are in the bar at the top of every screen.

This group is only listed when **Show advanced settings** is on. Other advanced rows live in their own groups.

Read more: [Settings](../../docs/settings.md), [Audio](../../docs/audio.md)
