# Wiring and fuses

> **Mains voltage is inside this box.** If you are not confident wiring mains, have a qualified electrician do the AC side. Nothing here has been built or tested yet; check every rating against the labels on your own parts.

This case is rain-shedding and ventilated, not waterproof, and not certified for anything.

## Overview

One diagram per side of the barrier on the power shelf: [high voltage](#high-voltage-ac-side) (mains, left of the barrier: the receptacle plate with both wall-warts) and [low voltage](#low-voltage-side) (right of the barrier and down to the sled, drawn as the two DC rails and then the Pi's signals). Each comes twice: a schematic (`docs/wiring-*.svg`, drawn by `scripts/render_wiring.py` with [Schemdraw](https://schemdraw.readthedocs.io/); click one for full size) and a flowchart of the same connections. Red is live or +, grey is neutral or -, green is earth, blue is a signal. Pin numbers are the Pi header's physical pins; GPIO assignments and the reasoning behind them are in `pi/README.md` ("GPIO pins and wiring"). The fuse values on the schematics are the examples from "Fuse sizing" below; size yours from your own labels.

## High voltage: AC side

Everything left of the barrier on the power shelf. Nothing but the two wall-warts' DC cords crosses the barrier, through the notch at its foot.

![AC side schematic: GFCI outlet, outdoor cord through the PG9 cord grip, live-only time-delay fuse, two NEMA 5-15R receptacles with insulated quick-connects, the stock 21 V wall-wart and the second 24 V one plugged in unmodified, their DC cords out through the barrier notch](wiring-hv.svg)

```mermaid
flowchart LR
  subgraph OUT["Outside the case"]
    direction LR
    GFCI["Outdoor GFCI outlet<br/>in-use cover; test its button"]
    BOX["Weatherproof connection box<br/>(only if you join an extension cord)"]
    LOOP["Drip loop<br/>below the gland"]
  end
  subgraph WALL["Rear wall, rear-left corner of the Pi zone"]
    GLAND["PG9 cord grip<br/>level with the lower receptacle's tabs"]
  end
  subgraph ACS["Power shelf, AC side (left of the barrier): the receptacle plate"]
    FAC["5 x 20 mm inline holder<br/>time-delay fuse<br/>LIVE ONLY"]
    R1["Lower NEMA 5-15R<br/>brass / silver / green tabs<br/>fully insulated quick-connects"]
    R2["Upper NEMA 5-15R<br/>jumpered from the lower<br/>(piggyback quick-connects)"]
    W1["Stock wall-wart, unmodified<br/>21 V 2.28 A, 2-pin"]
    W2["Second wall-wart, unmodified<br/>24 V, 2.5-3 A, 2-pin"]
  end
  NOTCH["Notch at the barrier foot<br/>DC cords only cross here"]
  GFCI -- "SJTW 18 AWG, 3-wire" --> BOX --> LOOP --> GLAND
  GLAND -- "L: black / smooth (narrow blade)" --> FAC
  FAC -- "L to the brass (narrow-slot) tab" --> R1
  GLAND -- "N: white / ribbed (wide blade), to the silver tab" --> R1
  GLAND -. "E: green, to the green tab (nothing uses it)" .-> R1
  R1 -- "L / N / E jumper" --> R2
  R1 --> W1
  R2 --> W2
  W1 -- "21 V DC cord" --> NOTCH
  W2 -- "24 V DC cord" --> NOTCH
  linkStyle 3,4 stroke:#c62828,stroke-width:2px
  linkStyle 5 stroke:#9e9e9e,stroke-width:2px
  linkStyle 6 stroke:#2e7d32,stroke-width:2px
```

1. **Supply.** Keep every plug-and-socket joint off the ground and out of puddles: put any extension-cord joint in a weatherproof connection box (a clamshell "cord connection" cover) and raise it off the lawn. Plug into an outdoor GFCI outlet (US code already requires GFCI for outdoor receptacles; test it with its button). Use an outdoor-rated cord (SJTW or better, 18 AWG minimum) and an in-use weatherproof cover on the outlet.
2. **Cord entry.** The cord enters through the PG9 cord grip in the rear wall, above the shelf. Tighten the grip on the round cord jacket. Leave a drip loop outside, below the grip, so water drips off before reaching it.
3. **Receptacles.** The projector's stock supply is a wall-wart (MX48CC-210228US: AC 100-240 V 1.0 A in, 21 V 2.28 A / 48 W out, centre-positive, 2-pin non-polarized prongs, captive DC cord), so the shelf's plate carries two panel-mount NEMA 5-15R snap-in receptacles facing the divider: the stock wall-wart plugs into the lower one and stands on the shelf on its long edge; the second wall-wart (the 24 V rail for the Pi, Amp4 and fans) plugs into the upper one and rests on the first. Both hang on their prongs; a velcro strap through the shelf slots round both keeps them seated. Wire the receptacles' 4.8 mm tabs with **fully insulated** female quick-connects: live from the fuse to the brass (narrow-slot) tab, neutral from the cord to the silver (wide-slot) tab, earth to the green tab. Jumper the second receptacle from the first with piggyback quick-connects, or two crimps per tab. Leave the wall-warts unmodified on the AC side.
4. **AC fuse.** An inline fuse holder on the **live** (hot) conductor only, between the cord grip and the first receptacle. US polarized plugs: the live is the narrow blade, usually the smooth or black conductor.
5. **Earth.** The wall-warts are 2-pin Class II, so nothing uses the earth contact. Use a 3-wire cord and land its green on both receptacles' earth tabs anyway: it costs nothing and covers anything 3-pin that is ever plugged in there.
6. **Insulate.** Every AC joint is inside a connector shell or heat-shrink. No bare metal, no tape-only joints. The spade terminals sit behind the plate, in the corner with the gland, away from the low-voltage side.
7. **Cord drop.** The cord comes through the gland in the rear-left corner, level with the lower receptacle's terminals, and runs behind the plate to them: 30 mm of room, no bend tighter than the cord's own radius.

## Low-voltage side

Right of the barrier, and down to the Pi sled.

### DC rails

![DC rails schematic: the stock wall-wart's 21 V cord fused and switched by the relay contact into the projector's barrel plug, the second wall-wart's 24 V cord fused into a Wago + rail feeding the Amp4 (which powers the Pi and the speakers) and both fans, and one Wago - rail joining both minuses](wiring-lv-power.svg)

```mermaid
flowchart TB
  W1["Stock wall-wart DC cord, 21 V<br/>cut a hand's width from the barrel plug; confirm centre + with a meter"]
  W2["Second wall-wart DC cord, 24 V<br/>same treatment"]
  F1["21 V fuse<br/>blade, 3 A"]
  F2["24 V fuse<br/>blade, 2.5 A"]
  WN(["Wago 221, - rail<br/>both minuses joined"])
  WP(["Wago 221, 24 V + rail"])
  subgraph PJ["Projector (21 V)"]
    RELAY["Relay module, fallback only<br/>COM / NO in the + line"]
    PROJ["Projector barrel plug<br/>its own cable, spliced back"]
  end
  subgraph PIZ["Pi sled, below the shelf (24 V)"]
    AMP["HiFiBerry Amp4<br/>12-24 V in"]
    PI["Raspberry Pi<br/>5 V from the Amp4 via the header<br/>no USB power"]
    SPK["Speakers behind the projection<br/>16 AWG zip cord, stripe to +<br/>out through the floor chimney"]
  end
  subgraph FANS["Right wall fans, 40 mm 24 V 4-pin PWM"]
    FAN1["Fan 1: projector zone"]
    FAN2["Fan 2: Pi / power zone"]
  end
  W1 -- "+ 18 AWG" --> F1 --> RELAY -- "+" --> PROJ
  W1 -- "- 18 AWG" --> WN
  WN -- "- never switched" --> PROJ
  W2 -- "+ 18 AWG" --> F2 --> WP
  W2 -- "- 18 AWG" --> WN
  WP -- "20 AWG" --> AMP
  WN -- "20 AWG" --> AMP
  AMP --> PI
  AMP --> SPK
  WP -- "24 AWG" --> FAN1
  WP -- "24 AWG" --> FAN2
  WN -- "24 AWG" --> FAN1
  WN -- "24 AWG" --> FAN2
  linkStyle 0,1,2,5,6,8,12,13 stroke:#c62828,stroke-width:2px
  linkStyle 3,4,7,9,14,15 stroke:#424242,stroke-width:2px
```

Both rails share one - rail: the projector's HDMI shield ties its ground to the Pi's anyway, and without the joint that shield would be the only return path between the rails. The relay is only needed if the projector lacks HDMI-CEC (see `pi/README.md`, "Projector power"). It is also the only way the Pi can cut the projector's power on over-temperature: with CEC alone it can only ask for standby, so consider fitting it anyway (see `pi/README.md`, "Cooling"). The relay opens whenever the Pi's service stops. Use an **active-low** module: the Pi holds GPIO 27 high (relay open, projector off) from boot.

| Circuit | Wire | Notes |
|---|---|---|
| Stock wall-wart DC lead to the 21 V fuse and the projector | 18 AWG (0.75 mm²) | Cut the lead a hand's width from its barrel plug, fuse the **+** conductor (the label's symbol says centre +; confirm with a meter before cutting) and splice it back with lever nuts, so the projector keeps its own plug. The relay, if fitted, goes in this + line |
| Second wall-wart DC lead to the 24 V fuse and splice | 18 AWG | Same treatment: fuse the +, lever-nut splice. 24 V keeps the fans on their rated voltage and the Amp4 inside its 12-24 V range; 12-24 V works if the fans match |
| Both rails' **minus** conductors | 18 AWG | Join them at the splice. The projector's HDMI shield ties its ground to the Pi's; without this joint that shield would be the only return path between the rails |
| Splice to Amp4 power input | 20 AWG (0.5 mm²) | Amp4 accepts 12-24 V; it powers the Pi, so don't also power the Pi by USB |
| Splice to fans | 24 AWG | Fans must match the second rail's voltage (24 V fans on a 24 V wall-wart); PWM and tach go to the Pi. With Cooling off in the settings, or the service stopped, the fans run at full speed |
| Relay (fallback only) | 18 AWG | Switch the **+** line to the projector. Never switch its ground: the HDMI cable would carry the return current. Use an **active-low** module: the Pi holds GPIO 27 high (relay open, projector off) from boot |
| Amp4 to speakers | 16 AWG zip cord | Out through the floor chimney; red/striped to + on both ends |

Use lever-nut connectors (e.g. Wago 221) for the splice so it can be undone. Pass low-voltage wires from the shelf to the Pi through the wire slot at the back of the shelf, never across the barrier's AC side.

### Pi header signals

![Pi header schematic: the 40-pin header with the PIR, relay coil, IR LED driver, 1-wire bus and the two fans' PWM and tach lines on their GPIO pins, with pull-ups and the transistor](wiring-lv-signals.svg)

```mermaid
flowchart LR
  subgraph IN["Inputs"]
    PIR["HC-SR501 PIR, rear wall<br/>VCC 5 V pin 2, GND pin 9"]
    T1["DS18B20, projector zone<br/>VDD 3.3 V, GND"]
    T2["DS18B20, Pi / brick zone<br/>VDD 3.3 V, GND"]
    TACH1["Fan 1 tach (green)<br/>10 kΩ pull-up to 3.3 V"]
    TACH2["Fan 2 tach (green)<br/>10 kΩ pull-up to 3.3 V"]
    IRRX["TSOP38238 IR receiver, optional<br/>VS 3.3 V pin 17, GND"]
  end
  PI["Raspberry Pi header<br/>(stacking header under the Amp4;<br/>GPIO 2-4 and 18-21 belong to the Amp4)"]
  subgraph OUTS["Outputs"]
    PWM1["Fan 1 PWM (blue)"]
    PWM2["Fan 2 PWM (blue)"]
    RELAY["Relay module IN, active-low<br/>VCC 5 V pin 4, GND pin 14"]
    Q1["BC337 NPN<br/>emitter to GND"]
    IRLED["940 nm IR LED in ir_holder<br/>5 V, LED, 47 Ω, collector"]
    PROJ["Projector HDMI input"]
  end
  PIR -- "OUT to GPIO17, pin 11" --> PI
  T1 -- "DQ" --> T2
  T2 -- "DQ, one bus, to GPIO26, pin 37<br/>one 4.7 kΩ to 3.3 V" --> PI
  TACH1 -- "GPIO24, pin 18" --> PI
  TACH2 -- "GPIO25, pin 22" --> PI
  IRRX -- "OUT to GPIO23, pin 16" --> PI
  PI -- "GPIO12, pin 32, via 1 kΩ (PWM0)" --> PWM1
  PI -- "GPIO13, pin 33, via 1 kΩ (PWM1)" --> PWM2
  PI -- "GPIO27, pin 13" --> RELAY
  PI -- "GPIO22, pin 15, via 1 kΩ to the base" --> Q1 --> IRLED
  PI -. "HDMI (CEC power control)" .-> PROJ
```

The Amp4 covers the header, so fit a stacking header or solder leads under the Pi. Every tach and 1-wire pull-up goes to **3.3 V**, never to a DC rail or 5 V. The fans and the Pi must share a ground. The IR LED needs the transistor: a GPIO pin can only source 16 mA.

## Cords outdoors

Trick-or-treaters walk through the yard in the dark. Run the power cord and speaker wires along edges, not across paths. Where they must cross a path, use a rubber cord cover (cable ramp), or bury or stake them flat. Keep every plug joint in a weatherproof connection box, off the ground.

## Fuse sizing

Fill this in from **your** labels. The stock wall-wart reads 1.0 A in and 21 V 2.28 A (48 W) out; the TO2's own label says DC 21 V 3 A, so the supply has no headroom beyond the projector. The example column assumes that wall-wart plus a 24 V 2.5 A second one with a 0.8 A input rating.

| Fuse | How to size it | Type | Example |
|---|---|---|---|
| AC fuse (live) | About 1.5x the **sum** of both wall-warts' rated input currents (the labels' "Input ... A"), and no more than the cord's rating | 5 x 20 mm, **time-delay (T)**, 250 V: switch-mode supplies have an inrush surge | 1.0 + 0.8 = 1.8 A gives **3 A T** (2.5 A T if you can get it) |
| 21 V rail (stock wall-wart) | The wall-wart's rated output is 2.28 A and the projector can draw all of it, so a fuse at that rating would run at its limit. Use the next size up: it protects the 18 AWG lead (good for far more), and the wall-wart has its own overload protection | Automotive blade (ATO/ATC), inline holder | **3 A** |
| 24 V rail (second wall-wart) | No more than its rated output, and at least 1.25x the Amp4 + Pi + fans load | Blade | 2.5 A wall-wart gives **2.5 A** (or 3 A) |

Check the second rail's total: Amp4 at your volume + the Pi + two fans must stay under that wall-wart's output rating with some margin. If it doesn't, buy a bigger wall-wart; a fuse won't fix that.

## Before first power-up

1. With nothing plugged in, check continuity: live, neutral (and earth, if used) each reach only where they should, with no short between them.
2. Confirm the AC fuse sits in the **live** conductor.
3. With both wall-warts plugged in but the splices open, measure each rail's DC voltage and polarity at its fuse. The stock wall-wart's label symbol says centre-positive; confirm it with the meter anyway.
4. Connect loads one at a time: fans, then the Amp4 (the Pi should boot), then the projector.
5. Close the lid, then test the GFCI outlet's trip button with the case running: everything must go dark.
