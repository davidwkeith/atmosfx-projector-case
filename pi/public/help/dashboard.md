# Dashboard

This is the screen for the night itself: start and stop the show, fire a scare, change the volume, and see at a glance that everything is healthy.

## Now-playing header

The bar at the top of every screen shows the clip on screen: a frame from it, its name, how far in it is and its length. The button on the right is the same **Play** / **Stop** switch as below. Tap anywhere else on the bar to come back here. The frame is grabbed from the clip the first time it plays and kept until the file changes; until then a plain icon stands in.

## Play and Stop

**Play** switches the projector on and starts the playlist (in scare mode, the calm clip). **Stop** switches it off. Matter, the schedule and the motion sensor use the same switch, so this button always shows the real state. If playback cannot start, the reason appears above the button.

## Scare now

Shown only in scare mode while playing. It plays one scare clip, then goes back to the calm clip. A cooldown follows each scare and is counted down under the button.

## Volume

The slider and **Mute** control the speakers. During quiet hours the volume is capped, whoever asks.

## Tiles

Tap a tile to go to where that part is set up.

- **Projector**: its power state and how it is switched (CEC, relay, IR or HDMI). Opens Settings > Projector.
- **Schedule**: the next automatic on or off. Opens the Schedule screen.
- **Network**: Ethernet, or the Wi-Fi strength. Wi-Fi is set in Raspberry Pi Imager, not on this page, so it opens the networks guide.
- **Pi temperature**: the Pi's own temperature. At the critical temperature it stops playback and switches the projector off. Opens Settings > Cooling.

## Banners

- **DMX in control**: a lighting desk is sending signal, so power and volume are locked until it stops.
- A red banner lists alarms (heat, projector) and system problems (no password, clock not synced, storage).

Read more: [How it works](../../docs/how-it-works.md)
