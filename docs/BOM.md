# Bill of materials

Quantities for one case. Printed parts and filament are in [PRINTING.md](PRINTING.md); wire gauges and fuse sizing are in [WIRING.md](WIRING.md). Sizes marked "check" depend on parts you haven't bought yet.

**Buy links:** Micro Center (Santa Clara store) where they stock it, otherwise Amazon. Every link was opened on 2026-10-05; stock and prices move, so treat them as a starting point. Micro Center links carry `storeid=195` so the page shows Santa Clara stock.

## Core

| Item | Qty | Notes | Buy |
|---|---|---|---|
| Mini projector, 1/4-20 tripod socket, HDMI-CEC if possible | 1 | About 171 x 134 x 75 mm assumed; measure yours | Owned (Tkisko TO2). The [Amazon listing](https://www.amazon.com/dp/B0CKNBWDP1) was unavailable on 2026-10-05 |
| Mini ball head, rated above the projector's weight | 1 | 1/4-20 both ends; about 40 mm tall assumed | [Micro Center: Dot Line medium ball head](https://www.microcenter.com/product/504683/dot-line-medium-metal-ball-head?storeid=195) (1/4-20 both ends) or [Amazon: UTEBIT 20 mm mini ball head](https://www.amazon.com/dp/B06XKW7V14) (rated 2.5 lb) |
| 1/4-20 double-ended stud | 1 | Pedestal to ball head | [Amazon: SmallRig 828, 2-pack](https://www.amazon.com/dp/B007LTH1X2) |
| Raspberry Pi 3B/3B+, 4B, 5 or Zero 2 W | 1 | Print the matching sled | Micro Center: [Pi 5](https://www.microcenter.com/product/673712/raspberry-pi-5?storeid=195), [Pi 4B](https://www.microcenter.com/product/637834/raspberry-pi-4-model-b?storeid=195), [Pi 3B+](https://www.microcenter.com/product/601561/raspberry-pi-3-model-b?storeid=195). Zero 2 W is in-store only there, so [Amazon: Pi Zero 2 W](https://www.amazon.com/dp/B09LH5SBPS) |
| HiFiBerry Amp4 | 1 | Powers the Pi too | [HiFiBerry shop](https://www.hifiberry.com/shop/boards/hifiberry-amp4/). Not at Micro Center; the [Amazon listing](https://www.amazon.com/dp/B0CKRZZKGJ) was unavailable on 2026-10-05 |
| Stacking 2x20 GPIO header (or wires soldered under the Pi) | 1 | GPIO access under the Amp4 | [Micro Center: 52Pi 2x20 stacking header kit](https://www.microcenter.com/product/669727/52pi-2x20-40-pin-stacking-female-header-kit?storeid=195) |
| microSD card, 32 GB, high-endurance | 1 | | [Micro Center: SanDisk Max Endurance 32 GB](https://www.microcenter.com/product/651045/sandisk-32-gb-max-endurance-microsdhc-class-10-uhs-3-flash-memory-card-with-adapter?storeid=195) |
| Outdoor speakers, 4-8 ohm | 2 | Placed behind the projection | [Amazon: Dual LU43PB pair](https://www.amazon.com/dp/B00081NX5U) (Micro Center only has Bluetooth speakers) |
| 4 x 5 in (127 x 101.6 mm) clear acrylic, 1/8 in (3.2 mm) | 1 | Cut-to-size, e.g. Acme Plastics | [Acme Plastics: cut-to-size clear cast acrylic](https://www.acmeplastics.com/cut-to-size-clear-acrylic-sheet-cast), or [Amazon: 5 x 7 in, 1/8 in, 10-pack](https://www.amazon.com/dp/B0987MC6HK) and trim |
| HDMI cable, about 0.5 m, thin and flexible, + right-angle adapter | 1 | Full-size (Pi 3), micro (Pi 4/5) or mini (Zero 2 W) at the Pi end, with a straight plug no bigger than 22 x 13 mm and 45 mm long (`hdmi_plug`); right-angle at the projector. Zero 2 W: a slim plug (under 12 mm wide), because a HAT post stands beside its port | Full-size: [Micro Center: QVS thin 1.5 ft](https://www.microcenter.com/product/458970/qvs-hdmi-male-to-hdmi-male-ultrahd-4k-thin-high-speed-cable-w-ethernet-15-ft-black?storeid=195) + [QVS angle adapter 5-pack](https://www.microcenter.com/product/466128/qvs-high-speed-hdmi-ultrahd-4k-angle-adapter-%285-pack%29?storeid=195), or [Amazon: Cmple ultra-thin 1.5 ft](https://www.amazon.com/dp/B003ZVTX04) + [VCE 90/270 deg adapters](https://www.amazon.com/dp/B00Y7UT6EK). Micro: [Amazon: FEELWORLD 2.5 mm micro-HDMI 1.5 ft](https://www.amazon.com/dp/B0CGHPN53B). Mini: [Amazon: FEELWORLD 2.5 mm mini-HDMI 1.5 ft](https://www.amazon.com/dp/B0CGHRRT55) |

## Power (see WIRING.md; mains inside the box)

| Item | Qty | Notes | Buy |
|---|---|---|---|
| Outdoor cord, SJTW 18 AWG or better | 1 | 2- or 3-wire to match the brick's inlet | [Amazon: PLUGTUL 16/3 SJTW 25 ft](https://www.amazon.com/dp/B0B7JH3RHL). Micro Center's Inland cords don't state a gauge or jacket type |
| PG9 cord grip (mains-rated) | 1 | | [Amazon: uxcell PG9 IP68 nylon, 10-pack](https://www.amazon.com/dp/B01MQWU2NM) |
| Rewireable IEC connector (C7, C5 or C13 to match the brick) | 1 | Leaves the brick unmodified | [Amazon: Toptekits rewirable C13](https://www.amazon.com/dp/B002T0JMTY); search the same way for C7 or C5 once you know the brick's inlet |
| 5 x 20 mm inline fuse holder + time-delay fuse | 1 | AC live | [Amazon: uxcell inline 5 x 20 holder, 18 AWG, 5-pack](https://www.amazon.com/dp/B07SM5KYZ7) + [BOJACK 5 x 20 time-delay fuses](https://www.amazon.com/dp/B07WPW2QBF) (pick the rating from WIRING.md; Micro Center only stocks fast-blow) |
| Blade (ATO/ATC) inline fuse holder + fuse | 1-3 | Main DC, optional projector and Amp4 branches | [Amazon: SIM&NAT 16 AWG inline ATO holder, 2-pack](https://www.amazon.com/dp/B0D8XWW5HC) (comes with 10 A and 15 A fuses; buy the WIRING.md rating separately) |
| Lever-nut connectors (Wago 221, 5-way) | 2 | DC splice | [Amazon: WAGO 221-415, 10-pack](https://www.amazon.com/dp/B07W7W9J95) |
| Wire: 18, 20 and 24 AWG | a few metres | | Micro Center: [18 AWG hook-up, 25 ft](https://www.microcenter.com/product/689131/leo-sales-ltd-hook-up-wire-300vhu-18-gauge-ul1007-copper-25ft?storeid=195), [22 AWG stranded, 25 ft](https://www.microcenter.com/product/689133/leo-sales-ltd-wire-stranded-22-gauge-300v-orange-25-ft?storeid=195). Amazon: [20 AWG silicone kit](https://www.amazon.com/dp/B073RDG2J6), [24 AWG silicone kit](https://www.amazon.com/dp/B073RD76QD) |
| 16 AWG speaker wire | to suit | | [Amazon: Amazon Basics 16 AWG, 50 ft](https://www.amazon.com/dp/B006LW0WDQ) (Micro Center sells 16 AWG only by the 500 ft spool) |
| Weatherproof cord-connection box | 1 | For any extension-cord joint | [Amazon: Flemoon IP44 cord connection box](https://www.amazon.com/dp/B08696RNQL) |

## Cooling, sensors, control

| Item | Qty | Notes | Buy |
|---|---|---|---|
| 40 x 40 x 10 mm 24 V 4-pin PWM fan (e.g. Noctua NF-A4x10 24V PWM) | 2 | Runs on the 21 V rail; a 12 V fan would burn. Check its datasheet accepts 3.3 V PWM | [Amazon: Noctua NF-A4x10 24V PWM](https://www.amazon.com/dp/B0CN39MCPL) (Micro Center carries no 40 mm Noctua) |
| DS18B20 temperature sensor + 4.7 kohm resistor | 2 + 1 | One per zone, one pull-up | [Amazon: WWZMDiB waterproof DS18B20, 5-pack with 4.7 k resistors](https://www.amazon.com/dp/B0C8J77NJR). Resistors alone: [Micro Center: Inland 1/4 W assortment](https://www.microcenter.com/product/618896/inland-1-4-watt-1-resistors-610-pack?storeid=195) |
| HC-SR501 PIR motion sensor | 1 | | [Micro Center: Inland PIR module](https://www.microcenter.com/product/618776/inland-pir-motion-sensor-module?storeid=195) (HC-SR501 type) or [Amazon: HC-SR501 5-pack](https://www.amazon.com/dp/B07KBWVJMP) |
| Relay module, 5 V coil, opto-isolated, active-low | 0-1 | Only if the projector lacks CEC | [Micro Center: Inland single 5 V relay module](https://www.microcenter.com/product/659887/inland-single-5v-relay-module-for-arduino?storeid=195); confirm the trigger polarity on the board before wiring |
| 940 nm IR LED + NPN transistor + resistors | 0-1 | Only with the relay fallback | [Micro Center: Adafruit IR transceiver (940 nm emitter with driver + 38 kHz receiver)](https://www.microcenter.com/product/691617/adafruit-industries-infrared-ir-remote-transceiver-stemma-jst-ph-2mm-940nm-emitter-38khz-receiver?storeid=195) covers this row and the next. Discrete: [IR LEDs](https://www.microcenter.com/product/456455/adafruit-industries-super-bright-5mm-ir-led-940nm-25-pack?storeid=195), [NPN](https://www.microcenter.com/product/689210/leo-sales-ltd-general-purpose-transistor-npn-50v-ic-2-pack?storeid=195), [resistors](https://www.microcenter.com/product/618896/inland-1-4-watt-1-resistors-610-pack?storeid=195) |
| TSOP38238 IR receiver | 0-1 | Optional, to learn the remote's code | The Adafruit board above, or [Amazon: TSOP38238 + TSAL6200 LEDs, 5 each](https://www.amazon.com/dp/B09D3RGSHX) |

## Fasteners

| Item | Qty | Where | Buy |
|---|---|---|---|
| 3/8-16 heat-set insert | 1 | Tripod | [Amazon: E-Z LOK 3/8-16 brass insert for plastic, 25-pack](https://www.amazon.com/dp/B08P1VF4NB) |
| 1/4-20 heat-set insert | 2 | Pedestal, tripod | [Amazon: ruthex 1/4-20 heat-set inserts, 20-pack](https://www.amazon.com/dp/B09MTS6ZZQ) |
| M4 heat-set insert | 4 | Hatch studs | [Micro Center: Leo Sales heat-set insert kit (M3/M4/M5)](https://www.microcenter.com/product/675642/leo-sales-ltd-heat-set-insert-kit-%28m3-m4-m5%29?storeid=195) |
| M3 heat-set insert | 1 | Sled thumbscrew | Same kit |
| M4 x 12 button-head | 4 | Hatch keyholes | [Amazon: M4 x 12 stainless button head, 100-pack](https://www.amazon.com/dp/B01H6EZRCS) |
| M3 x 12 (security screw) | 0-1 | Optional hatch lock (`hatch_lock`), for public-facing setups | [Amazon: M3 x 12 pin-Torx button head, 100-pack](https://www.amazon.com/dp/B07KY69KDZ) |
| M3 x 12 (pan head, or pin-Torx security) | 4 | Lid, through the skirt | [Amazon: M3 stainless button-head assortment, 340 pcs](https://www.amazon.com/dp/B0742D9WDV), or the pin-Torx pack above |
| M3 x 12 | 4 | Base seam, through the divider | Same M3 assortment |
| M3 x 10 self-tapping | 4 | Pedestal to floor | [Amazon: M3 pan-head self-tapping assortment, 6-20 mm](https://www.amazon.com/dp/B07BTNDC6W) |
| M3 x 8 self-tapping | 4 | Window frame | Same assortment |
| M3 knurled thumbscrew, 8 mm | 1 | Sled | [Amazon: MECCANIXITY M3 x 8 stainless thumb screws, 10-pack](https://www.amazon.com/dp/B0FC6FS6M3) |
| Fan screws (or M3 x 16 self-tapping) | 8 | Two fans | The Noctua fans ship with screws; otherwise M3 x 16 from the self-tapping assortment |
| M2.5 x 6 self-tapping | 4 | Pi to sled | [Amazon: uxcell M2.5 x 6 stainless self-tapping, 100-pack](https://www.amazon.com/dp/B01L7PDGXO) |
| M2 x 6 self-tapping | 10 | Screen caps (8), PIR (2) | [Amazon: M1.7-M3 small self-tapping assortment](https://www.amazon.com/dp/B0GF1CHDVV) |

## Consumables

| Item | Notes | Buy |
|---|---|---|
| PETG or ASA, about 1.3 kg, "Go Away Green" | Plus a little for reprints | [Micro Center: Inland ASA Army Green](https://www.microcenter.com/product/660561/inland-175mm-army-green-asa-3d-printer-filament-1kg-spool-%2822-lbs%29?storeid=195) is the closest stock colour; [Inland PETG Green](https://www.microcenter.com/product/503782/inland-175mm-petg-3d-printer-filament-1kg-%2822-lbs%29-cardboard-spool-green?storeid=195) is brighter. Match by eye |
| Flame-retardant PETG (UL 94 V-0, e.g. Prusament PETG V0), about 0.1-0.3 kg | Recommended for `power_shelf` (and `base_rear`, if the colour works): mains and the brick sit there | [Prusa: Prusament PETG V0 Jet Black](https://www.prusa3d.com/product/prusament-petg-v0-jet-black-1kg/) or [Amazon](https://www.amazon.com/dp/B0GP79Z9WY). Not at Micro Center |
| Foam tape, 2 mm (lid rim) and 1.5 mm (hatch) | | [Amazon: EPDM 2 x 20 mm, 10 m](https://www.amazon.com/dp/B0DFXQS5BL); [Amazon: 1/16 in (1.5 mm) x 1 in, 33 ft](https://www.amazon.com/dp/B08HV48WQV) |
| Neutral-cure outdoor silicone | Base seam, pane, PIR dome | [Amazon: GE Advanced Silicone 2, clear, 2.8 oz](https://www.amazon.com/dp/B001JK5R0I) |
| Insect screen, mosquito grade (about 18 x 16 mesh) | | [Amazon: fiberglass window screen, charcoal](https://www.amazon.com/dp/B0CP2PY26C) (any hardware store roll works) |
| Matte black spray paint | Inside of the case, against light glow | [Amazon: Rust-Oleum 2X flat black](https://www.amazon.com/dp/B002BWOS7Q) |
| VHB tape, velcro strap, zip ties, foam plug for the chimney | | [Amazon: 3M VHB 5952, 1 in x 5 yd](https://www.amazon.com/dp/B007Y7H5W8); Micro Center: [8 in UV cable ties, 100](https://www.microcenter.com/product/657186/8-inch-black-uv-standard-cable-tie-100-pack?storeid=195), [VELCRO One-Wrap ties](https://www.microcenter.com/product/658953/velcro-90924-one-wrap-8-x-05-reusable-ties-black-%2850-pack%29?storeid=195) |
| 8 mm tent stakes | 4, optional | [Amazon: forged steel 10 in stakes, 40-pack](https://www.amazon.com/dp/B072QB3L8S) |

## Ordering plan (for Halloween)

Printing takes 2 to 3 days on two printers and bring-up about a week, so order everything **by about October 5**. The slow items:

| Item | Typical lead time | Order |
|---|---|---|
| HiFiBerry Amp4 | 1-2 weeks (often ships from Europe; check a local reseller) | First |
| Cut-to-size acrylic | 3-10 days | First |
| Noctua fans, DS18B20, PIR, relay/IR parts | 2-5 days | With the Amp4 |
| 3/8-16 heat-set insert | 2-5 days (a less common size) | With the fasteners |
| Filament (2 x 1 kg), fasteners, wire, fuses, silicone, screen | 1-3 days | Now |

Micro Center Santa Clara had the Pi boards, stacking header, microSD, filament, PIR, relay, IR board, insert kit, hook-up wire, thin HDMI cable and cable ties in stock on 2026-10-05, so one trip covers those.

## Rough cost (excluding the projector)

These are estimates from typical retail prices, not quotes; check current prices.

| Group | Rough USD |
|---|---|
| Pi (one board) + microSD | 50-90 |
| Amp4 + stacking header | 45-60 |
| Speakers (outdoor pair) + wire | 50-120 |
| Ball head + stud | 15-35 |
| Fans (2x Noctua) + sensors + PIR | 40-55 |
| Power parts (cord, gland, IEC, fuses, lever nuts, wire, connection box) | 35-60 |
| Acrylic pane | 10-25 |
| Inserts, screws, foam, silicone, screen, paint | 30-50 |
| Filament, about 1.3 kg | 30-60 |
| **Total** | **about 300-550** |
