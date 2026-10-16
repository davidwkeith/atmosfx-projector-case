# System

## Matter

Matter lets Apple Home and other controllers switch VideoFX on and off, change the volume and fire a scare. Until it is paired, this screen shows a QR code and a manual code. In Apple Home choose **+**, **Add Accessory**, then scan the code.

**Reset pairing** removes the device from every controller. You will have to pair it again. Videos and settings are kept.

## Health log

A chart of the Pi's SoC temperature over the last 24 hours, written once a minute to the data partition so it survives power cuts. The dashed lines are the warning and cut-off temperatures (Settings > Cooling). The green bar underneath shows when the fan ran. Red marks are under-voltage (the 5 V supply sagged) and amber marks are throttling. Below the chart are the latest events: starts and stops, under-voltage, temperature alarms, Wi-Fi and HDMI drops, and player crashes.

**Pi started** with no **Service stopped** before it means the power was cut. **Download CSV** has every sample from about the last month.

## Backup and restore

The backup file holds your settings, schedule, quiet hours, playlist and Matter pairing, but not the videos. It contains the pairing keys and the password hash, so keep it private.

When restoring, leave **Also restore the Matter pairing** off unless this is the same Pi, or the old one is gone for good. Two devices with one Matter identity confuse Apple Home. Without it, this Pi keeps its own pairing.

## Software

The page shows the installed version. The Pi looks for a newer release on GitHub once a day; **Check now** asks right away. When one exists an **Upgrade to X.Y.Z** panel appears. Upgrading from the page needs a page password (Settings > Web page), because otherwise anyone on your network could press the button; without one, run `sudo videofx-update` on the Pi instead. You are already signed in with it, so you just confirm. Then it installs the release and reboots. The old version is kept, so `sudo videofx-update --rollback` undoes it.

After an update, a line under the version says how the last run went: finished, nothing to do, stopped early (nothing installed) or failed (the previous version put back). If it stopped or failed, **End of the update log** shows its last lines, so you can see why without SSH. The full log is `/srv/videofx/update/last.log` on the Pi (the run before is `last.log.1`), and the login banner shows the same summary.

**Restart service** stops playback for a few seconds. It comes back by itself and restores the last state.

Read more: [Health log](../../docs/reliability.md#health-log), [Pair with Apple Home](../../docs/apple-home.md), [Backup and restore](../../docs/updates.md#backup-and-restore), [Updates](../../docs/updates.md#updates)
