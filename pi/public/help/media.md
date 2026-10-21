# Media

Everything about what plays: the mode, the loop playlist, the scare clips and the videos on the Pi.

## Mode

- `loop` plays the playlist and repeats.
- `scare` loops the calm clip and plays a scare clip on a trigger.

The section the current mode uses is marked **in use**. You can set up both and switch between them.

## Loop mode: playlist

The playlist plays top to bottom and loops. Tick **Shuffle** to play the clips in random order instead: each plays once per round, then the order is reshuffled. Untick an item to skip it without removing it. Use the arrows to reorder.

Each clip shows its length, and the line under the list gives the total for one pass through the ticked clips. Lengths are known for MP4, M4V and MOV files only. Nothing changes on the Pi until you press **Save playlist**, and saving restarts playback if it is running. Your unsaved edits stay while you look at other screens.

## Scare mode

Scare mode loops a calm clip without a gap. On a trigger, one scare clip plays, then it goes back to the calm clip.

- **Calm clip**: the clip that loops between scares.
- **Scare clips**: the clips a trigger can play. The calm clip is never offered as a scare clip.
- **Suggest from file names** picks the file with "buffer" in its name as the calm clip and the matching scare clips. Check its guess before applying.

Mode, clip and behaviour changes wait in the Apply bar until you press **Apply**.

Triggers: the **Scare** switch in your Home app, the motion sensor, a DMX signal, and **Scare now** on the Dashboard. Quiet hours can switch scares off, whoever asks.

## Motion sensor

Scares only fire when playback is on and the mode is scare. The sensor also shows up in Matter as an occupancy sensor. Choose the pin it is wired to under **PIR GPIO**; the default is GPIO17 (physical pin 11).

## Videos

These are the files on the Pi. **Add** puts one on the playlist (you can add the same file more than once). The bin deletes the file from the Pi and from the playlist.

## Uploading

Choose one or more video or audio files, or an `.m3u` playlist. The page shows how much space is free and the largest file it accepts; the limit is **Largest upload** under Settings > Web page.

Your first uploads build the playlist by themselves, in name order. Once you save the playlist yourself, new uploads wait until you add them and save.

## USB stick

Plug a USB stick with your videos into the Pi, in any folders. Its video and audio files are copied to the Pi and become the playlist, and in loop mode they start playing. The line under the upload button shows the progress. When it says the import is done, pull the stick out.

Your purchased videos are not included with VideoFX. Upload them here, or copy them to the media folder over SSH. A new Pi starts with a built-in "VideoFX" test clip (bouncing over an alignment grid); delete it once you have your own.

Read more: [Videos, playlist, scare mode](../../docs/videos.md)
