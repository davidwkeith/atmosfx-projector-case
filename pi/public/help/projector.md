# Projector

## Projector power

How VideoFX switches the projector on and off:

- `cec`: HDMI-CEC wake and standby. If the projector never answers, it falls back to `hdmi-off`.
- `relay-ir`: a relay on the projector's DC feed, then the projector's IR power code.
- `relay`: the relay only, for projectors that switch on by themselves.
- `hdmi-off`: turn the HDMI signal off when stopped.
- `none`: leave the projector alone.

Not every projector answers CEC. If the Dashboard says CEC has no response, try `relay-ir`.

## IR power code

Shown when the mode is `relay-ir`. Point the projector's remote at the IR receiver, press **Learn power button**, then press the remote's power button within 15 seconds. **Send test** fires the code at the projector. Press **Apply** to keep it.

## Two power presses

Tick **Projector needs two power presses** if the projector ignores a single press of its power button.

## Advanced rows

**Relay settle time** is how long to wait after power-up before sending IR and starting playback. **CEC device** is `/dev/cec0`, the only HDMI port on a Pi 3 or Zero 2 W.

Read more: [Projector power](../../docs/projector.md)
