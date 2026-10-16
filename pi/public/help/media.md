# Media

## Playlist

The playlist plays top to bottom and loops. Tick **Shuffle** to play the clips in random order instead: each plays once per round, then the order is reshuffled. Untick an item to skip it without removing it. Use the arrows to reorder.

Each clip shows its length, and the line under the list gives the total for one pass through the ticked clips. Lengths are known for MP4, M4V and MOV files only. Nothing changes on the Pi until you press **Save playlist**, and saving restarts playback if it is running. Your unsaved edits stay while you look at other screens.

## Videos

These are the files on the Pi. **Add** puts one on the playlist (you can add the same file more than once). The bin deletes the file from the Pi and from the playlist.

## Uploading

Choose one or more video or audio files, or an `.m3u` playlist. The page shows how much space is free and the largest file it accepts; the limit is **Largest upload** under Settings > Web page.

Your first uploads build the playlist by themselves, in name order. Once you save the playlist yourself, new uploads wait until you add them and save.

## USB stick

Plug a USB stick with your videos into the Pi, in any folders. Its video and audio files are copied to the Pi and become the playlist, and in loop mode they start playing. The line under the upload button shows the progress. When it says the import is done, pull the stick out.

Your purchased videos are not included with VideoFX. Upload them here, or copy them to the media folder over SSH. A new Pi starts with a built-in "VideoFX" test clip (bouncing over an alignment grid); delete it once you have your own.

Read more: [Videos, playlist, scare mode](../../docs/videos.md)
