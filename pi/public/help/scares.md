# Scares

Scare mode loops a calm clip without a gap. On a trigger, one scare clip plays, then it goes back to the calm clip.

## Turn it on

Set **Mode** to `scare` under Settings > Playback. Until then this screen only prepares the clips.

## Clips

- **Calm clip**: the clip that loops between scares.
- **Scare clips**: the clips a trigger can play. The calm clip is never offered as a scare clip.
- **Suggest from file names** picks the file with "buffer" in its name as the calm clip and the matching scare clips. Check its guess before applying.

Clip changes wait in the Apply bar until you press **Apply**.

## What triggers a scare

The **Scare** switch in your Home app, the motion sensor, a DMX signal, and **Scare now** on the Dashboard. Quiet hours can switch scares off, whoever asks.

## Motion sensor

Scares only fire when playback is on and the mode is scare. The sensor also shows up in Matter as an occupancy sensor. Choose the pin it is wired to under **PIR GPIO**; the default is GPIO17 (physical pin 11).

Read more: [Videos, playlist, scare mode](../../docs/videos.md)
