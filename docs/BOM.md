# Bill of materials

Quantities for one case. Printed parts and filament are in [PRINTING.md](PRINTING.md); wire gauges and fuse sizing are in [WIRING.md](WIRING.md). Sizes marked "check" depend on parts you haven't bought yet.

**Buy links:** Micro Center (Santa Clara store) where they stock it, otherwise Amazon; acrylic from TAP Plastics. Every link was opened on 2026-10-05; stock and prices move, so treat them as a starting point. Micro Center links carry `storeid=195` so the page shows Santa Clara stock.

## Order status (2026-10-06)

Amazon cart placed or about to be: 12 SKUs, $145.32 with tax (checkout PDF). Rows below say **Ordered** or **Not ordered**.

**Still to buy**
- Safety-critical: [3 A time-delay fuses](https://www.amazon.com/BOJACK-T3AL250V-5x20mm-Fuses-Time-delay/dp/B07X1KC272) (the 1 A ones in the cart are too small), the SJTW outdoor cord, the PG9 cord grip, the weatherproof connection box, and real WAGO 221s for the AC jumper.
- Fasteners: M4 x 12 bolts, the M3 knurled thumbscrew, and (unless the hot-shoe slot works) the 1/4-20 insert and stud.
- Everything else outside the cart: the Pi, DigiAMP+, microSD, PIR, speakers and wire, HDMI cable and right-angle adapter, the 3.5 x 5 in frame, foam tape, silicone, screen, paint, filament.

## Core

| Item | Qty | Notes | Buy |
|---|---|---|---|
| Mini projector, 1/4-20 tripod socket, HDMI-CEC if possible | 1 | 165 x 130 x 66 mm (depth measured, width and height from the manual) | Owned (Tkisko TO2). The [Amazon listing](https://www.amazon.com/dp/B0CKNBWDP1) was unavailable on 2026-10-05 |
| Mini ball head, rated above the projector's weight | 1 | Chosen: UTEBIT 20 mm (male 1/4-20 on top into the projector, female 1/4-20 underneath; 58 mm overall, 32 mm base, Amazon rates it 2.5 lb / 1.1 kg (other listings say 2.5 kg), against the projector's 0.72 kg, so confirm it holds the aim; the hot-shoe adapter in the box is not used) **Ordered 2026-10-06** ($7.99). | [Amazon: UTEBIT 20 mm mini ball head](https://www.amazon.com/dp/B06XKW7V14) |
| 1/4-20 double-ended stud | 1 | Pedestal insert to the head's bottom hole (both female) **Not ordered**: needed unless the hot-shoe slot on the coupon works; at about $5 it is cheap insurance. | [Amazon: SmallRig 828, 2-pack](https://www.amazon.com/dp/B007LTH1X2) |
| Raspberry Pi 3B/3B+, 4B, 5 or Zero 2 W | 1 | Print the matching sled | Micro Center: [Pi 5](https://www.microcenter.com/product/673712/raspberry-pi-5?storeid=195), [Pi 4B](https://www.microcenter.com/product/637834/raspberry-pi-4-model-b?storeid=195), [Pi 3B+](https://www.microcenter.com/product/601561/raspberry-pi-3-model-b?storeid=195). Zero 2 W is in-store only there, so [Amazon: Pi Zero 2 W](https://www.amazon.com/dp/B09LH5SBPS) |
| Raspberry Pi DigiAMP+ (SC2076) | 1 | 2 x 35 W class D, 12-24 V in (5.5 x 2.5 mm barrel or P5 hard-wire), powers the Pi at 5.1 V / 2.5 A; 40-pin pass-through header; 0-50 °C ([product brief](<https://pip-assets.raspberrypi.com/categories/765-raspberry-pi-digiamp/documents/RP-008138-DS-1-digiamp-plus-hat-product-brief.pdf>)) | [Micro Center: Raspberry Pi DigiAMP+](https://www.microcenter.com/product/631851/raspberry-pi-digiamp?storeid=195) (chosen over the HiFiBerry Amp4: same TAS5756M, half the price, in stock locally) |
| 2x20 GPIO header | 0-1 | Zero 2 W only (it ships without one); the DigiAMP+ passes the other pins through | [Micro Center: 52Pi 2x20 stacking header kit](https://www.microcenter.com/product/669727/52pi-2x20-40-pin-stacking-female-header-kit?storeid=195) |
| microSD card, 32 GB, high-endurance | 1 | | [Micro Center: SanDisk Max Endurance 32 GB](https://www.microcenter.com/product/651045/sandisk-32-gb-max-endurance-microsdhc-class-10-uhs-3-flash-memory-card-with-adapter?storeid=195) |
| Outdoor speakers, 4-8 ohm | 2 | Placed behind the projection | [Amazon: Dual LU43PB pair](https://www.amazon.com/dp/B00081NX5U) (Micro Center only has Bluetooth speakers) |
| 3.5 x 5 in (127 x 88.9 mm) picture frame with acrylic (not glass) glazing, about 2 mm | 1 | Any 3.5 x 5 in frame; use only the glazing. Check the listing says acrylic/plastic, and measure the thickness (`pane_t`) | [Amazon: 3.5 x 5 in picture frames](https://www.amazon.com/s?k=3.5x5+picture+frame+acrylic). Fallback: 127 x 88.9 mm, 2 mm clear acrylic cut to size at [TAP Plastics](https://www.tapplastics.com/product/plastics/cut_to_size_plastic/acrylic_sheets_clear/508) |
| HDMI cable, about 0.5 m, thin and flexible, + right-angle adapter | 1 | Full-size (Pi 3), micro (Pi 4/5) or mini (Zero 2 W) at the Pi end, with a straight plug no bigger than 22 x 13 mm and 45 mm long (`hdmi_plug`); right-angle, low profile at the projector. The port is horizontal on a vertical right face and the cable must leave REARWARD along that face, so buy a left/right-turn (side-exit) adapter or a side-exit molded cable, not an up/down one. Keep-out: 16 mm along Y, 15 mm off the face (`side_port_depth`), cable run 8 mm (`side_cable_d`); measure your plug into `side_port_*`. Zero 2 W: a slim plug (under 12 mm wide), because a HAT post stands beside its port | Full-size: [Micro Center: QVS thin 1.5 ft](https://www.microcenter.com/product/458970/qvs-hdmi-male-to-hdmi-male-ultrahd-4k-thin-high-speed-cable-w-ethernet-15-ft-black?storeid=195) + [QVS angle adapter 5-pack](https://www.microcenter.com/product/466128/qvs-high-speed-hdmi-ultrahd-4k-angle-adapter-%285-pack%29?storeid=195), or [Amazon: Cmple ultra-thin 1.5 ft](https://www.amazon.com/dp/B003ZVTX04) + [VCE 90/270 deg adapters](https://www.amazon.com/dp/B00Y7UT6EK) (check these are the left/right-exit type before buying). Micro: [Amazon: FEELWORLD 2.5 mm micro-HDMI 1.5 ft](https://www.amazon.com/dp/B0CGHPN53B). Mini: [Amazon: FEELWORLD 2.5 mm mini-HDMI 1.5 ft](https://www.amazon.com/dp/B0CGHRRT55) |

## Power (see WIRING.md; mains inside the box)

| Item | Qty | Notes | Buy |
|---|---|---|---|
| Outdoor cord, SJTW 18 AWG or better, 3-wire | 1 | Round jacket for the PG9 grip | [Amazon: PLUGTUL 16/3 SJTW 25 ft](https://www.amazon.com/dp/B0B7JH3RHL). Micro Center's Inland cords don't state a gauge or jacket type |
| PG9 cord grip (mains-rated) | 1 | | [Amazon: uxcell PG9 IP68 nylon, 10-pack](https://www.amazon.com/dp/B01MQWU2NM) |
| NEMA 5-15R panel-mount receptacle, snap-in (SS-6B, 15 A 125 V, 2-pack) | 2 | Chosen 2026-10-06. Drawing: 24 x 24 mm cutout, 27 x 27 mm flange, 1.5 mm panel gap, body 20.6 + terminals to 30.6 mm behind the panel (`rcpt_cut`, `rcpt_t`, `rcpt_back` 40). **Not confirmed from the listing: UL/ETL listing and the tab width** (the drawing says only "2-2.2x7", which looks like the blade slots), so check the labels and match the quick-connects to the real tabs before wiring. Check the fit on the coupon **Ordered** (SS-6B 2-pack, $18.78, seller YSYAMZ; no certification seen on the listing). | [Amazon: SS-6B 2-pack](https://www.amazon.com/dp/B0HBXKKJ35). Fallback, a listed part with the old 26 x 22 cutout: [Digi-Key: Qualtek 738W-X2/01](https://www.digikey.com/en/products/detail/qualtek/738W-X2-01/1164208) |
| Second wall-wart, 12-24 V, 2.5-3 A, 5.5 x 2.5 mm centre-positive barrel (the DigiAMP+'s jack) | 1 | The Pi + DigiAMP+ rail (12-24 V is the DigiAMP+'s range; higher gives it more power). Up to 86 x 47 x 35 mm standing on its long edge (`wart2`); measure yours into the model **Ordered** Facmogu 24 V 3 A 72 W ($14.89). The cart photo shows a desktop brick with an AC cord, not a plug-in wart: check its size against `wart2` before it arrives; a larger brick would sit on the shelf on its cord and needs a clash re-check. | [Amazon: Facmogu 24 V 3 A, 5.5 x 2.5 mm](https://www.amazon.com/dp/B07TB3L72F) (claims UL; confirm it is the plug-in style and fits `wart2`). Micro Center has no 24 V barrel supplies |
| Right-angle DC barrel adapter, 5.5 x 2.5 mm male to 5.5 x 2.5 mm female | 1 | The projector's jack is 5.5 mm OD x 2.5 mm ID (owner, 2026-10-06), so the stock plug is the same size. The male end goes into the jack (stands out about 15 mm, `port_depth`) and the stock plug or its stub goes into the elbow's female end, so the stock cable's 45 mm bend runs along the rear face. A straight plug would need about 45 mm behind the rear face, which the rear tile can't take. Do not use the 2.1 mm variants **Ordered** (5-pack, $8.99). | [Amazon: GINTOOYUN 5.5 x 2.5 mm male-to-female, 5-pack](https://www.amazon.com/dp/B0BQGM4NBS) |
| 4.8 mm fully insulated female quick-connects, plus piggybacks for the jumper | about 8 | 18 AWG crimp size **Ordered** (BAOMAIN 100-pack, $6.79). | [Amazon: BAOMAIN 0.187 in fully insulated spade kit, 22-16 AWG](https://www.amazon.com/dp/B01MYV3BS0) (no piggybacks: jumper with a short lead and the lever nuts instead) |
| Velcro strap, 20 mm | 1-2 | Through the shelf slots, round both wall-warts | [Micro Center: VELCRO One-Wrap roll, 3/4 in x 4 ft](https://www.microcenter.com/product/657584/velcro-90302-one-wrap-roll-4%e2%80%99-x-075-black-%281-roll%29?storeid=195) |
| 5 x 20 mm inline fuse holder + time-delay fuse | 1 | AC live **Ordered** uxcell holders (5-pack, $6.29) and BOJACK T1AL250V 1 A fuses ($6.99). **1 A is too small**: WIRING.md sizes the AC fuse at 3 A T, so also buy [BOJACK T3AL250V](https://www.amazon.com/BOJACK-T3AL250V-5x20mm-Fuses-Time-delay/dp/B07X1KC272). | [Amazon: uxcell inline 5 x 20 holder, 18 AWG, 5-pack](https://www.amazon.com/dp/B07SM5KYZ7) + [BOJACK 5 x 20 time-delay fuses](https://www.amazon.com/dp/B07WPW2QBF) (pick the rating from WIRING.md, sized for both wall-warts; Micro Center only stocks fast-blow) |
| Blade (ATO/ATC) inline fuse holder + fuse | 2 | One per DC rail | [Amazon: SIM&NAT 16 AWG inline ATO holder, 2-pack](https://www.amazon.com/dp/B0D8XWW5HC) (comes with 10 A and 15 A fuses; buy the WIRING.md rating separately) |
| Lever-nut connectors (Wago 221, 5-way) | 2 | DC splice **Ordered** generic 5-conductor lever connectors, 25 pcs ($20.97, Yueshenglong): fine for the DC splices. The AC jumper should use real WAGO 221s (UL listed), **not ordered**. | [Amazon: WAGO 221-415, 10-pack](https://www.amazon.com/dp/B07W7W9J95) |
| Wire: 18, 20 and 24 AWG | a few metres | | Micro Center: [18 AWG hook-up, 25 ft](https://www.microcenter.com/product/689131/leo-sales-ltd-hook-up-wire-300vhu-18-gauge-ul1007-copper-25ft?storeid=195), [22 AWG stranded, 25 ft](https://www.microcenter.com/product/689133/leo-sales-ltd-wire-stranded-22-gauge-300v-orange-25-ft?storeid=195). Amazon: [20 AWG silicone kit](https://www.amazon.com/dp/B073RDG2J6), [24 AWG silicone kit](https://www.amazon.com/dp/B073RD76QD) |
| 16 AWG speaker wire | to suit | | [Amazon: Amazon Basics 16 AWG, 50 ft](https://www.amazon.com/dp/B006LW0WDQ) (Micro Center sells 16 AWG only by the 500 ft spool) |
| Weatherproof cord-connection box | 1 | For any extension-cord joint | [Amazon: Flemoon IP44 cord connection box](https://www.amazon.com/dp/B08696RNQL) |

## Sensors, control

| Item | Qty | Notes | Buy |
|---|---|---|---|
| HC-SR501 PIR motion sensor | 1 | | [Micro Center: Inland PIR module](https://www.microcenter.com/product/618776/inland-pir-motion-sensor-module?storeid=195) (HC-SR501 type) or [Amazon: HC-SR501 5-pack](https://www.amazon.com/dp/B07KBWVJMP) |
| Relay module, 5 V coil, opto-isolated, active-low | 0-1 | Only if the projector lacks CEC | [Micro Center: Inland single 5 V relay module](https://www.microcenter.com/product/659887/inland-single-5v-relay-module-for-arduino?storeid=195); confirm the trigger polarity on the board before wiring |
| 940 nm IR LED + NPN transistor + resistors | 0-1 | Only with the relay fallback | [Micro Center: Adafruit IR transceiver (940 nm emitter with driver + 38 kHz receiver)](https://www.microcenter.com/product/691617/adafruit-industries-infrared-ir-remote-transceiver-stemma-jst-ph-2mm-940nm-emitter-38khz-receiver?storeid=195) covers this row and the next. Discrete: [IR LEDs](https://www.microcenter.com/product/456455/adafruit-industries-super-bright-5mm-ir-led-940nm-25-pack?storeid=195), [NPN](https://www.microcenter.com/product/689210/leo-sales-ltd-general-purpose-transistor-npn-50v-ic-2-pack?storeid=195), [resistors](https://www.microcenter.com/product/618896/inland-1-4-watt-1-resistors-610-pack?storeid=195) |
| TSOP38238 IR receiver | 0-1 | Optional, to learn the remote's code | The Adafruit board above, or [Amazon: TSOP38238 + TSAL6200 LEDs, 5 each](https://www.amazon.com/dp/B09D3RGSHX) |

## Fasteners

| Item | Qty | Where | Buy |
|---|---|---|---|
| 1/4-20 heat-set insert | 1 | Pedestal **Not ordered**: the Ktehloy kit is metric only. | [Amazon: ruthex 1/4-20 heat-set inserts, 20-pack](https://www.amazon.com/dp/B09MTS6ZZQ) |
| M4 heat-set insert | 4 | Hatch studs **Ordered** (Ktehloy 400-pc metric kit M2-M6, $15.97); check the hole sizes on the coupon. | [Micro Center: Leo Sales heat-set insert kit (M3/M4/M5)](https://www.microcenter.com/product/675642/leo-sales-ltd-heat-set-insert-kit-%28m3-m4-m5%29?storeid=195) |
| M3 heat-set insert | 1 | Sled thumbscrew Same Ktehloy kit. | Same kit |
| M4 x 12 button-head | 4 | Hatch keyholes **Not ordered.** | [Amazon: M4 x 12 stainless button head, 100-pack](https://www.amazon.com/dp/B01H6EZRCS) |
| M3 x 12 (security screw) | 0-1 | Optional hatch lock (`hatch_lock`), for public-facing setups | [Amazon: M3 x 12 pin-Torx button head, 100-pack](https://www.amazon.com/dp/B07KY69KDZ) |
| M3 x 12 (pan head, or pin-Torx security) | 4 | Lid, through the skirt **Ordered**: 340-pc 304 stainless M3 x 5-20 mm button-head kit ($12.27, nineone). | [Amazon: M3 stainless button-head assortment, 340 pcs](https://www.amazon.com/dp/B0742D9WDV), or the pin-Torx pack above |
| M3 x 12 | 4 | Base seam, through the divider Same M3 kit. | Same M3 assortment |
| M3 x 10 self-tapping | 4 | Pedestal to floor **Ordered**: Mikniri 750-pc M1.7-M3 assortment ($7.99); the M3 lengths are unconfirmed. | [Amazon: M3 pan-head self-tapping assortment, 6-20 mm](https://www.amazon.com/dp/B07BTNDC6W) |
| M3 x 8 self-tapping | 4 | Window frame Same Mikniri assortment. | Same assortment |
| M3 knurled thumbscrew, 8 mm | 1 | Sled **Not ordered.** | [Amazon: MECCANIXITY M3 x 8 stainless thumb screws, 10-pack](https://www.amazon.com/dp/B0FC6FS6M3) |
| M2.5 x 6 self-tapping | 4 | Pi to sled Same Mikniri assortment (lengths unconfirmed). | [Amazon: uxcell M2.5 x 6 stainless self-tapping, 100-pack](https://www.amazon.com/dp/B01L7PDGXO) |
| M2 x 6 self-tapping | 10 | Screen caps (6), PIR (2) Same Mikniri assortment (lengths unconfirmed). | [Amazon: M1.7-M3 small self-tapping assortment](https://www.amazon.com/dp/B0GF1CHDVV) |

## Consumables

| Item | Notes | Buy |
|---|---|---|
| PETG or ASA, about 1.3 kg, "Go Away Green" | Plus a little for reprints | [Micro Center: Inland ASA Army Green](https://www.microcenter.com/product/660561/inland-175mm-army-green-asa-3d-printer-filament-1kg-spool-%2822-lbs%29?storeid=195) is the closest stock colour; [Inland PETG Green](https://www.microcenter.com/product/503782/inland-175mm-petg-3d-printer-filament-1kg-%2822-lbs%29-cardboard-spool-green?storeid=195) is brighter. Match by eye |
| Flame-retardant PETG (UL 94 V-0, e.g. Prusament PETG V0), about 0.1-0.3 kg | Recommended for `power_shelf` (and `base_rear`, if the colour works): the receptacles and both wall-warts sit there | [Prusa: Prusament PETG V0 Jet Black](https://www.prusa3d.com/product/prusament-petg-v0-jet-black-1kg/) or [Amazon](https://www.amazon.com/dp/B0GP79Z9WY). Not at Micro Center |
| Foam tape, 2 mm (lid rim) and 1.5 mm (hatch) | | [Amazon: EPDM 2 x 20 mm, 10 m](https://www.amazon.com/dp/B0DFXQS5BL); [Amazon: 1/16 in (1.5 mm) x 1 in, 33 ft](https://www.amazon.com/dp/B08HV48WQV) |
| Neutral-cure outdoor silicone | Base seam, pane, PIR dome | [Amazon: GE Advanced Silicone 2, clear, 2.8 oz](https://www.amazon.com/dp/B001JK5R0I) |
| Insect screen, mosquito grade (about 18 x 16 mesh) | Caps | [Amazon: fiberglass window screen, charcoal](https://www.amazon.com/dp/B0CP2PY26C) (any hardware store roll works) |
| Matte black spray paint | Inside of the case, against light glow | [Amazon: Rust-Oleum 2X flat black](https://www.amazon.com/dp/B002BWOS7Q) |
| VHB tape, velcro strap, zip ties, foam plug for the chimney | | [Amazon: 3M VHB 5952, 1 in x 5 yd](https://www.amazon.com/dp/B007Y7H5W8); Micro Center: [8 in UV cable ties, 100](https://www.microcenter.com/product/657186/8-inch-black-uv-standard-cable-tie-100-pack?storeid=195), [VELCRO One-Wrap ties](https://www.microcenter.com/product/658953/velcro-90924-one-wrap-8-x-05-reusable-ties-black-%2850-pack%29?storeid=195) |
| 8 mm tent stakes | 4, optional | [Amazon: forged steel 10 in stakes, 40-pack](https://www.amazon.com/dp/B072QB3L8S) |

## Ordering plan (for Halloween)

Printing takes 2 to 3 days on two printers and bring-up about a week, so order everything **now**: as of 2026-10-06 that leaves about three weeks to Halloween. The slow items:

| Item | Typical lead time | Order |
|---|---|---|
| Picture frame (glazing) | Same day at a craft or discount store, or a few days from Amazon | Any time |
| Zero 2 W (if used) | 2-5 days | Now |
| Filament (2 x 1 kg), fasteners, wire, fuses, silicone, screen | 1-3 days | Now |

Micro Center Santa Clara had the Pi boards, DigiAMP+, microSD, filament, PIR, relay, IR board, insert kit, hook-up wire, thin HDMI cable and cable ties in stock on 2026-10-05, so one trip covers those.

## Rough cost (excluding the projector)

These are estimates from typical retail prices, not quotes; check current prices.

| Group | Rough USD |
|---|---|
| Pi (one board) + microSD | 50-90 |
| DigiAMP+ | 30 |
| Speakers (outdoor pair) + wire | 50-120 |
| Ball head + stud | 15-35 |
| PIR | 5-10 |
| Power parts (cord, gland, 2 receptacles, second wall-wart, fuses, lever nuts, wire, connection box) | 55-90 |
| Acrylic pane | 10-25 |
| Inserts, screws, foam, silicone, screen, paint | 30-50 |
| Filament, about 1.3 kg | 30-60 |
| **Total** | **about 270-505** |
