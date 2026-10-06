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
| HDMI cable, about 0.5 m, thin and flexible, + right-angle adapter | 1 | Full-size (Pi 3), micro (Pi 4/5) or mini (Zero 2 W) at the Pi end, with a straight plug no bigger than 22 x 13 mm and 45 mm long (`hdmi_plug`); right-angle at the projector. Zero 2 W: a slim plug (under 12 mm wide), because a HAT post stands beside its port |

## Power (see WIRING.md; mains inside the box)

| Item | Qty | Notes |
|---|---|---|
| Outdoor cord, SJTW 18 AWG or better, 3-wire | 1 | Round jacket for the PG9 grip |
| PG9 cord grip (mains-rated) | 1 | |
| NEMA 5-15R panel-mount receptacle, snap-in, 4.8 mm tabs (Qualtek 738W-X2/01) | 2 | 26 x 22 mm cutout in a 0.8-2 mm panel; the shelf's plate is 2 mm at the cutout (`rcpt_cut`, `rcpt_t`). Check the fit on the coupon. [Digi-Key 1164208](https://www.digikey.com/en/products/detail/qualtek/738W-X2-01/1164208) |
| Second wall-wart, 24 V, 2.5-3 A, barrel plug to match the Amp4 | 1 | The Pi + Amp4 + fans rail. Up to 86 x 47 x 35 mm standing on its long edge (`wart2`); measure yours into the model |
| 4.8 mm fully insulated female quick-connects, plus piggybacks for the jumper | about 8 | 18 AWG crimp size |
| Velcro strap, 20 mm | 1-2 | Through the shelf slots, round both wall-warts |
| 5 x 20 mm inline fuse holder + time-delay fuse | 1 | AC live |
| Blade (ATO/ATC) inline fuse holder + fuse | 2 | One per DC rail |
| Lever-nut connectors (Wago 221, 5-way) | 2 | DC splice |
| Wire: 18, 20 and 24 AWG | a few metres | |
| 16 AWG speaker wire | to suit | |
| Weatherproof cord-connection box | 1 | For any extension-cord joint |

## Cooling, sensors, control

| Item | Qty | Notes |
|---|---|---|
| 40 x 40 x 10 mm 24 V 4-pin PWM fan (e.g. Noctua NF-A4x10 24V PWM) | 2 | Runs on the second wall-wart's 24 V rail; a 12 V fan would burn there. Check its datasheet accepts 3.3 V PWM |
| DS18B20 temperature sensor + 4.7 kohm resistor | 2 + 1 | One per zone, one pull-up |
| HC-SR501 PIR motion sensor | 1 | |
| Relay module, 5 V coil, opto-isolated, active-low | 0-1 | Only if the projector lacks CEC |
| 940 nm IR LED + NPN transistor + resistors | 0-1 | Only with the relay fallback |
| TSOP38238 IR receiver | 0-1 | Optional, to learn the remote's code |

## Fasteners

| Item | Qty | Where |
|---|---|---|
| 1/4-20 heat-set insert | 1 | Pedestal |
| M4 heat-set insert | 4 | Hatch studs |
| M3 heat-set insert | 1 | Sled thumbscrew |
| M4 x 12 button-head | 4 | Hatch keyholes |
| M3 x 12 (security screw) | 0-1 | Optional hatch lock (`hatch_lock`), for public-facing setups |
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
| Flame-retardant PETG (UL 94 V-0, e.g. Prusament PETG V0), about 0.1-0.3 kg | Recommended for `power_shelf` (and `base_rear`, if the colour works): the receptacles and both wall-warts sit there |
| Foam tape, 2 mm (lid rim) and 1.5 mm (hatch) | |
| Neutral-cure outdoor silicone | Base seam, pane, PIR dome |
| Insect screen, mosquito grade (about 18 x 16 mesh) | Caps and behind the fans |
| Matte black spray paint | Inside of the case, against light glow |
| VHB tape, velcro strap, zip ties, foam plug for the chimney | |
| 8 mm tent stakes | 4, optional |

## Ordering plan (for Halloween)

Printing takes 2 to 3 days on two printers and bring-up about a week, so order everything **by about October 5**. The slow items:

| Item | Typical lead time | Order |
|---|---|---|
| HiFiBerry Amp4 | 1-2 weeks (often ships from Europe; check a local reseller) | First |
| Cut-to-size acrylic | 3-10 days | First |
| Noctua fans, DS18B20, PIR, relay/IR parts | 2-5 days | With the Amp4 |
| Filament (2 x 1 kg), fasteners, wire, fuses, silicone, screen | 1-3 days | Now |

## Rough cost (excluding the projector)

These are estimates from typical retail prices, not quotes; check current prices.

| Group | Rough USD |
|---|---|
| Pi (one board) + microSD | 50-90 |
| Amp4 + stacking header | 45-60 |
| Speakers (outdoor pair) + wire | 50-120 |
| Ball head + stud | 15-35 |
| Fans (2x Noctua) + sensors + PIR | 40-55 |
| Power parts (cord, gland, 2 receptacles, second wall-wart, fuses, lever nuts, wire, connection box) | 55-90 |
| Acrylic pane | 10-25 |
| Inserts, screws, foam, silicone, screen, paint | 30-50 |
| Filament, about 1.3 kg | 30-60 |
| **Total** | **about 300-550** |
