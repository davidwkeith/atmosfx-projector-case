# DMX

VideoFX can be driven by a lighting desk over the network (sACN, also called E1.31). No DMX cable is involved.

## How it takes over

While a source is sending, DMX overrides Matter, this page and the schedule. The Dashboard shows "DMX in control" and locks power and volume. When the signal stops, control goes back after the data-loss timeout plus **Hold after the signal stops**.

## Addressing

Set **Universe** and **Start address**. VideoFX reads eight channels from the start address: Power, Mode, Clip, Trigger, Volume, Mute, Dimmer and a reserved one.

## Wi-Fi

**Accept multicast** off means unicast only: send to this Pi's IP address. That is the better choice on Wi-Fi.

## Live status

Below the settings, the live block shows whether a signal is present, who is sending, and the eight values being received.

Read more: [DMX (sACN)](https://github.com/davidwkeith/atmosfx-projector-case/blob/main/pi/README.md#dmx-sacn)
