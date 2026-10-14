# System

## Matter

Matter lets Apple Home and other controllers switch VideoFX on and off, change the volume and fire a scare. Until it is paired, this screen shows a QR code and a manual code. In Apple Home choose **+**, **Add Accessory**, then scan the code.

**Reset pairing** removes the device from every controller. You will have to pair it again. Videos and settings are kept.

## Backup and restore

The backup file holds your settings, schedule, quiet hours, playlist and Matter pairing, but not the videos. It contains the pairing keys and the password hash, so keep it private.

When restoring, leave **Also restore the Matter pairing** off unless this is the same Pi, or the old one is gone for good. Two devices with one Matter identity confuse Apple Home. Without it, this Pi keeps its own pairing.

## Software

The page shows the installed version. The Pi looks for a newer release on GitHub once a day; **Check now** asks right away. When one exists an **Upgrade to X.Y.Z** panel appears. If you have set a page password, you are already signed in with it and just confirm. If you have not, it asks for the Pi's login password (the one you use for SSH), because otherwise anyone on your network could press the button. Then it installs the release and reboots. The old version is kept, so `sudo videofx-update --rollback` undoes it.

**Restart service** stops playback for a few seconds. It comes back by itself and restores the last state.

Read more: [Pair with Apple Home](https://github.com/davidwkeith/atmosfx-projector-case/blob/main/pi/README.md#pair-with-apple-home), [Backup and restore](https://github.com/davidwkeith/atmosfx-projector-case/blob/main/pi/README.md#backup-and-restore), [Updates](https://github.com/davidwkeith/atmosfx-projector-case/blob/main/pi/README.md#updates)
