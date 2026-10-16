# Dashboard

This is the screen for the night itself: start and stop the show, fire a scare, change the volume, and see at a glance that everything is healthy.

## Now-playing header

The bar at the top of every screen shows the clip on screen: a frame from it, its name, how far in it is and its length. The button on the right is **Play** while everything is off (it switches on, like the button below) and **Pause** while a clip plays: pause freezes the picture with the projector still on, and **Resume** carries on from there. Scares wait while paused, and switching off, a power cut or a DMX desk taking over always resumes. Use **Stop** below to switch off. Tap anywhere else on the bar to come back here. The frame is grabbed from the clip the first time it plays and kept until the file changes; until then a plain icon stands in.

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

## Setup checks

A list of what works and what doesn't: the Pi, the amplifier, the projector on HDMI (with the name and resolution it reports), whether the projector answers CEC, the motion sensor, the power supply, the temperature, the network, the time and the videos. They run by themselves about 30 seconds after the Pi starts; **Run checks** runs them again, for example after plugging something in.

- **✓ OK** works.
- **✕ Problem** needs fixing: the row says how, and **Go there** opens the setting or guide.
- **? Not sure yet** can't be told yet. The motion sensor stays here until it has seen someone walk past.
- **– Not used** is switched off in Settings, or not needed for how the projector is powered.

A problem also puts a red dot on Dashboard and a line in the health log.

## Banners

- **DMX in control**: a lighting desk is sending signal, so power and volume are locked until it stops.
- A red banner lists alarms (heat, projector) and system problems (no password, clock not synced, storage).

Read more: [How it works](../../docs/how-it-works.md), [Troubleshooting](../../docs/troubleshooting.md#setup-checks)
