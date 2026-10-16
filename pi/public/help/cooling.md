# Cooling

VideoFX watches the Pi's own temperature. It does not read the projector's.

The Pi 3/4 sled fan is switched by the Pi's kernel, not by this page: on at 60 °C, off 10 °C lower. The Dashboard's Pi temperature tile shows whether it is running. Its pin and temperature are under Hardware.

## Over-temperature protection

Turn it on, then set two limits:

- **Warning temperature**: the Dashboard shows an alarm.
- **Critical temperature**: playback stops and the projector is switched off. Whether that is a real power cut depends on the projector power mode; with CEC it can only ask the projector to go to standby.

The warning must be below the critical limit, or Apply is refused.

## Resuming

**Cool-down before resuming** is how far below the critical temperature the Pi must fall before it switches back on by itself.

Read more: [Cooling](../../docs/cooling.md)
