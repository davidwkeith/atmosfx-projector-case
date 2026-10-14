# DMX (sACN)

VideoFX is a **receive-only 8-channel fixture** over **E1.31 (sACN)**, on Wi-Fi or Ethernet (UDP 5568, unicast and optionally multicast 239.255.hi.lo). Settings > DMX sets: enable, universe (1-63999), start address (1-505), hold time (default 5 s) and accept multicast. The page shows the live sources (name, IP, priority, packet rate) and our 8 values.

| Ch | Function | Values |
|---|---|---|
| 1 | Power | 0-127 off, 128-255 on (same projector power path as Matter) |
| 2 | Mode | 0-127 loop, 128-255 scare |
| 3 | Clip select | 0 = normal (playlist or calm clip); N = playlist entry N, looped |
| 4 | Scare trigger | fires on the rise through 128; the cooldown still applies |
| 5 | Volume | 0-255 → 0-100% |
| 6 | Mute | 128-255 muted |
| 7 | Video dimmer | 0 black … 255 normal (mpv brightness) |
| 8 | Reserved | send 0 |

**Hand-over rules:**

- While any valid source for our universe is live, **DMX owns power, mode, clip, volume, mute and dimmer**.
  - Matter writes are refused, and Matter's attribute is put back to the real state.
  - The page shows "DMX in control" and disables those controls; its power and volume calls get 409.
  - The schedule pauses.
  - DMX values are not saved.
- A source is lost after 2.5 s without data (E1.31 data loss) or at once on Stream_Terminated. After the last source is lost and the hold time passes, control returns:
  - to the schedule's current wish if the schedule is on;
  - otherwise to the power state from before DMX took over.
  - Mode, volume, clip and dimmer go back to their saved settings.
- **Pacing:** power changes at most once a second, mode every 0.5 s, and clip select must hold 300 ms. Volume and dimmer are limited to 10 updates a second.
- **Merging:** highest priority wins; equal top priorities merge highest-takes-precedence per channel. Out-of-order packets are dropped, using ETC's rule: accept if newer, or 20 or more behind. Preview-flagged data and non-zero start codes are ignored.

**Where the E1.31 details come from.** Packet layout, the sequence rule, the 2.5 s timeout, the flags and the universe range were checked against ETC's open-source reference receiver ([ETCLabs/sACN](https://github.com/ETCLabs/sACN)). The ESTA PDF sits behind a terms form and was not read directly.

**Show software:**

- **QLC+:** import `dmx/DIY-VideoFX-Player.qxf` (Fixture Definition Editor, or copy it to your user fixtures folder). It validates against QLC+'s own `fixture.xsd`. Output on E1.31, **unicast** to the Pi's IP.
- **xLights:** Controllers > Add Ethernet, Protocol E1.31, the Pi's **IP address** (unicast), start universe = ours ([xLights manual](https://manual.xlights.org/xlights/chapters/chapter-four-set-up/lighting-networks/ethernet-controller)). Add a DMX model with 8 channels at the start address. The DMX model type's name wasn't verified.
- **Falcon Player:** Channel Outputs > **E1.31 / ArtNet / DDP / KiNet**, add a universe with type **E1.31 Unicast** and the Pi's IP.
- **Light-O-Rama:** use LOR's **E1.31 (sACN)** output, not its native LOR network (RS-485) protocol, which VideoFX does not speak. In the LOR Sequence Editor / Show Player network configuration, add an E1.31 (Ethernet DMX) output with our universe and the Pi's **IP address** if it offers unicast. Map an 8-channel DMX fixture (or eight plain channels) to the start address. The exact LOR menu names were not verified here; check LOR's documentation for your software version.
- **Manual test:** `node tools/sacn-send.mjs --to <pi-ip> --universe 1 --values 255,0,0,0,76,0,255,0 --seconds 10`. Add `--pulse-trigger` for a scare. It ends with Stream_Terminated.

**Security:** sACN has no authentication, and while a source is live DMX overrides Matter, the web page and its password. With DMX on, any device on the Pi's network can control it; packets from outside the LAN (the same address test as the web page: private, link-local, ULA or one of the Pi's own subnets) are dropped and counted as rejected. Turn DMX on only on a network you trust (see [Security and guests](security.md)).

**Network:** multicast over Wi-Fi is unreliable (converted, rate-limited or dropped by APs), so **send unicast to the Pi's IP**; a fixed IP or DHCP reservation helps. On UniFi, sACN multicast (239.255.x.x) is outside the always-flooded 224.0.0.0/24, so **IGMP Snooping** with "Forward Unknown Multicast" set to Drop can block it, and **Multicast Enhancement** converts it per client ([Switch Settings](https://help.ui.com/hc/en-us/articles/33402927617047-UniFi-Switch-Settings), [WiFi SSID settings](https://help.ui.com/hc/en-us/articles/32065480092951-UniFi-WiFi-SSID-and-AP-Settings-Overview)). Unicast avoids all of that.
