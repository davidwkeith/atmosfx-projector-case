# Projector power

Setting: **Projector power** = `cec` (default) | `relay-ir` | `relay` | `hdmi-off` | `none`. The page shows the projector's state and the CEC result.

- **cec.** Uses `cec-ctl` (v4l-utils) on `/dev/cec0`, the kernel's CEC under KMS (HDMI0 on the 4B and 5; the only port on the 3 and Zero 2 W). No libcec daemon, and access is through the video group via udev.
  - On: configure as a playback device, then Image View On, Text View On and Active Source (One Touch Play), then ask for the power status. If the projector isn't "on" yet, the wake is retried once after 8 s.
  - Off: Standby.
  - If the projector never answers, the service falls back to `hdmi-off` with a notice, and tries CEC again at the next power-on. CEC is only used on power changes, never on page polls.
  - **Buying:** many mini projectors have no CEC. Look for "HDMI-CEC" in the projector's own spec. Brand names like Anynet+, SimpLink or Bravia Sync are the TV makers' CEC and don't tell you anything about a projector.
  - **Test** on the Pi: `cec-ctl -d /dev/cec0 --playback -S` shows the CEC devices. `cec-ctl -d0 --to 0 --image-view-on` should wake it.
- **hdmi-off.** Powers the HDMI signal down (fbdev blank) when stopped, once mpv has let go of the display. Many projectors drop to standby after their own no-signal timeout. **Waking may still need the remote.** Before the Pi is paired, the signal stays on so the pairing code is visible.
- **relay / relay-ir.** Fallbacks, built only if CEC fails ([BRINGUP](../../docs/BRINGUP.md) row 9). A relay on the projector's DC feed. Off: stop playback, then open the relay. On: close it, wait the settle time (default 3 s), then:
  - `relay`: nothing more, for projectors that power up by themselves.
  - `relay-ir`: send the IR power code (twice if "needs two presses" is set). The relay forces a known "off" first, so the IR toggle can't get out of step. A second "on" while it is already on (the schedule after you switched on by hand, say) doesn't press power again.
  - Either way, playback then waits up to 20 s for the projector to show up on HDMI, and starts again if it appears later. mpv gives a disconnected output no picture.
- **Relay safety:**
  - Use a relay module rated for the projector's DC current, with an opto-isolated input and a flyback diode (most modules have one).
  - Switch the **+ line (high side) only**, and only on the projector's leg. Never switch the projector's ground: the HDMI shield would carry its return current.
  - At boot the firmware drives the relay line to "open" before Linux runs (`gpio=27=op,dh` for active-low modules; use `dl` for active-high). The service keeps it open until it decides.
  - When the service stops, for any reason, the relay opens: the service does it on a clean stop, and `videofx-relay-open` (the unit's `ExecStopPost`) does it after a crash, a kill or the watchdog. The relay never stays closed once the service is gone (the service only watches the Pi's own SoC; the projector has its own thermal cut-off).
  - The relay and IR pins are also in `config.txt`, written once with the defaults. If you change them in `/etc/default/videofx`, change `config.txt` by hand too.
  - Cutting power suits LED mini projectors; don't do it to a lamp projector that needs a cool-down.
- **IR** uses the `gpio-ir-tx` overlay for the LED and `gpio-ir` for a TSOP38238-style receiver, driven with `ir-ctl`.
  - On the page (Settings > Projector, with **Projector power** set to `relay-ir`): **Learn power button**, then press the remote's power button at the receiver. The capture is decoded as NEC (`nec`, `necx` or `nec32`, the same scancode forms the kernel's encoder sends) or kept as raw pulse/space data.
  - Or paste a code (`nec:0x40bf`, `rc5:0x1e01`, `raw:+9000 -4500 ...`). **Send test** fires it.
  - `pwm-ir-tx` is allowed (set `VIDEOFX_IR_TX_DRIVER` and use its overlay in `config.txt`): the case has no fans, so hardware PWM0 is free.
