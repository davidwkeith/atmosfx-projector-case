# System

## Matter

Matter lets Apple Home and other controllers switch VideoFX on and off, change the volume and fire a scare. Until it is paired, this screen shows a QR code and a manual code. In Apple Home choose **+**, **Add Accessory**, then scan the code.

**Reset pairing** removes the device from every controller. You will have to pair it again. Videos and settings are kept.

## Backup and restore

The backup file holds your settings, schedule, quiet hours, playlist and Matter pairing, but not the videos. It contains the pairing keys and the password hash, so keep it private.

When restoring, leave **Also restore the Matter pairing** off unless this is the same Pi, or the old one is gone for good. Two devices with one Matter identity confuse Apple Home. Without it, this Pi keeps its own pairing.

## Software

The page shows the installed version. VideoFX never updates itself: when an update is available, run `sudo videofx-update` on the Pi.

**Restart service** stops playback for a few seconds. It comes back by itself and restores the last state.

Read more: [Pair with Apple Home](../../docs/apple-home.md), [Backup and restore](../../docs/updates.md#backup-and-restore), [Updates](../../docs/updates.md#updates)
