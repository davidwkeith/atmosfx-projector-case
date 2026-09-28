# Bill of materials

Quantities for one case. Printed parts and filament are in [PRINTING.md](PRINTING.md); wire gauges and fuse sizing are in [WIRING.md](WIRING.md). Sizes marked "check" depend on parts you haven't bought yet.

## Core

| Item | Qty | Notes |
|---|---|---|
| Mini projector, 1/4-20 tripod socket, HDMI-CEC if possible | 1 | About 171 x 134 x 75 mm assumed; measure yours |
| Mini ball head, rated above the projector's weight | 1 | 1/4-20 both ends; about 40 mm tall assumed |
| 1/4-20 double-ended stud | 1 | Pedestal to ball head |
| Raspberry Pi 3B/3B+, 4B, 5 or Zero 2 W | 1 | Print the matching sled |
| HiFiBerry Amp4 | 1 | Powers the Pi too |
| Stacking 2x20 GPIO header (or wires soldered under the Pi) | 1 | GPIO access under the Amp4 |
| microSD card, 32 GB, high-endurance | 1 | |
| Outdoor speakers, 4-8 ohm | 2 | Placed behind the projection |
| 4 x 5 in (127 x 101.6 mm) clear acrylic, 1/8 in (3.2 mm) | 1 | Cut-to-size, e.g. Acme Plastics |
| Short HDMI cable + right-angle adapter | 1 | Full-size (Pi 3), micro (Pi 4/5) or mini (Zero 2 W) at the Pi end; right-angle at the projector |

## Power (see WIRING.md; mains inside the box)

| Item | Qty | Notes |
|---|---|---|
| Outdoor cord, SJTW 18 AWG or better | 1 | 2- or 3-wire to match the brick's inlet |
| PG9 cord grip (mains-rated) | 1 | |
| Rewireable IEC connector (C7, C5 or C13 to match the brick) | 1 | Leaves the brick unmodified |
| 5 x 20 mm inline fuse holder + time-delay fuse | 1 | AC live |
| Blade (ATO/ATC) inline fuse holder + fuse | 1-3 | Main DC, optional projector and Amp4 branches |
| Lever-nut connectors (Wago 221, 5-way) | 2 | DC splice |
| Wire: 18, 20 and 24 AWG | a few metres | |
| 16 AWG speaker wire | to suit | |
| Weatherproof cord-connection box | 1 | For any extension-cord joint |

## Cooling, sensors, control

| Item | Qty | Notes |
|---|---|---|
| 40 x 40 x 10 mm 12 V 4-pin PWM fan (e.g. Noctua NF-A4x10 PWM) | 2 | Check its datasheet accepts 3.3 V PWM |
| DS18B20 temperature sensor + 4.7 kohm resistor | 2 + 1 | One per zone, one pull-up |
| HC-SR501 PIR motion sensor | 1 | |
| Relay module, 5 V coil, opto-isolated, active-low | 0-1 | Only if the projector lacks CEC |
| 940 nm IR LED + NPN transistor + resistors | 0-1 | Only with the relay fallback |
| TSOP38238 IR receiver | 0-1 | Optional, to learn the remote's code |

## Fasteners

| Item | Qty | Where |
|---|---|---|
| 3/8-16 heat-set insert | 1 | Tripod |
| 1/4-20 heat-set insert | 2 | Pedestal, tripod |
| M4 heat-set insert | 4 | Hatch studs |
| M3 heat-set insert | 1 | Sled thumbscrew |
| M4 x 12 button-head | 4 | Hatch keyholes |
| M3 x 12 (pan head, or pin-Torx security) | 4 | Lid, through the skirt |
| M3 x 12 | 4 | Base seam, through the divider |
| M3 x 10 self-tapping | 4 | Pedestal to floor |
| M3 x 8 self-tapping | 4 | Window frame |
| M3 knurled thumbscrew, 8 mm | 1 | Sled |
| Fan screws (or M3 x 16 self-tapping) | 8 | Two fans |
| M2.5 x 6 self-tapping | 4 | Pi to sled |
| M2 x 6 self-tapping | 10 | Screen caps (8), PIR (2) |

## Consumables

| Item | Notes |
|---|---|
| PETG or ASA, about 1.3 kg, "Go Away Green" | Plus a little for reprints |
| Foam tape, 2 mm (lid rim) and 1.5 mm (hatch) | |
| Neutral-cure outdoor silicone | Base seam, pane, PIR dome |
| Insect screen, mosquito grade (about 18 x 16 mesh) | Caps and behind the fans |
| Matte black spray paint | Inside of the case, against light glow |
| VHB tape, velcro strap, zip ties, foam plug for the chimney | |
| 8 mm tent stakes | 4, optional |
