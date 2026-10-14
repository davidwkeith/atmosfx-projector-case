# Dashboard

This is the screen for the night itself: start and stop the show, fire a scare, change the volume, and see at a glance that everything is healthy.

## Play and Stop

**Play** switches the projector on and starts the playlist (in scare mode, the calm clip). **Stop** switches it off. Matter, the schedule and the motion sensor use the same switch, so this button always shows the real state. If playback cannot start, the reason appears above the button.

## Scare now

Shown only in scare mode while playing. It plays one scare clip, then goes back to the calm clip. A cooldown follows each scare and is counted down under the button.

## Volume

The slider and **Mute** control the speakers. During quiet hours the volume is capped, whoever asks.

## Tiles

- **Projector**: its power state and how it is switched (CEC, relay, IR or HDMI).
- **Schedule**: the next automatic on or off.
- **Network**: Ethernet, or the Wi-Fi strength.
- **Pi temperature**: the Pi's own temperature. At the critical temperature it stops playback and switches the projector off.

## Banners

- **DMX in control**: a lighting desk is sending signal, so power and volume are locked until it stops.
- A red banner lists alarms (heat, projector) and system problems (no password, clock not synced, storage).

Read more: [How it works](../../docs/how-it-works.md)
