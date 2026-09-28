# Wiring and fuses

> **Mains voltage is inside this box.** If you are not confident wiring mains, have a qualified electrician do the AC side. Nothing here has been built or tested yet; check every rating against the labels on your own parts.

This case is rain-shedding and ventilated, not waterproof, and not certified for anything.

## Overview

```mermaid
flowchart LR
  subgraph OUT["Outside"]
    GFCI["GFCI outdoor outlet<br/>(in-use cover)"]
  end
  subgraph AC["AC side of barrier (left of shelf)"]
    GLAND["PG9 cord grip<br/>+ drip loop"]
    FAC["AC fuse, time-delay<br/>on LIVE only"]
    IEC["Rewireable IEC connector<br/>(matches brick inlet)"]
    BRICK["DC brick<br/>(projector's own)"]
  end
  subgraph LV["Low-voltage side (right of barrier)"]
    FDC["Main DC fuse<br/>blade, fast"]
    TB["Lever-nut splice<br/>+ and -"]
    RELAY["Relay (fallback only)<br/>switches + line"]
    PROJ["Projector barrel plug"]
    AMP["HiFiBerry Amp4<br/>12-24 V in, powers Pi"]
    FANS["2x 12 V PWM fans"]
  end
  subgraph PI["Pi sled (below shelf)"]
    RPI["Raspberry Pi"]
    SPK["Speaker terminals"]
  end
  GFCI -- "outdoor cord SJTW 18 AWG" --> GLAND --> FAC --> IEC --> BRICK
  BRICK -- "DC +" --> FDC --> TB
  BRICK -- "DC -" --> TB
  TB -- "+ / -" --> RELAY --> PROJ
  TB -- "+ / -" --> AMP
  TB -- "+ / -" --> FANS
  AMP --- RPI
  AMP --> SPK
  SPK -- "16 AWG zip cord<br/>via floor chimney" --> SPEAKERS["Speakers behind<br/>the projection"]
  RPI -. "HDMI + CEC" .-> PROJ
  RPI -. "PWM / tach" .-> FANS
  RPI -. "GPIO" .-> RELAY
```

Solid lines carry power. Dotted lines are signals. The relay is only fitted if the projector lacks HDMI-CEC (see `pi/README.md`, "Projector power"). GPIO pin assignments for the relay, IR, PIR, fans and temperature sensors are in `pi/README.md`.

## AC side

Everything left of the barrier on the power shelf.

1. **Supply.** Plug into an outdoor GFCI outlet (US code already requires GFCI for outdoor receptacles; test it with its button). Use an outdoor-rated cord (SJTW or better, 18 AWG minimum) and an in-use weatherproof cover on the outlet.
2. **Cord entry.** The cord enters through the PG9 cord grip in the rear wall, above the shelf. Tighten the grip on the round cord jacket. Leave a drip loop outside, below the grip, so water drips off before reaching it.
3. **Leave the brick unmodified.** Most projector bricks take a detachable AC cord (IEC C7 "figure 8", C5 "cloverleaf" or C13). Fit a **rewireable** IEC connector of the same type to the end of your outdoor cord inside the case and plug it into the brick. If your brick has a captive cord instead, stop and get the AC side wired by someone qualified.
4. **AC fuse.** An inline fuse holder on the **live** (hot) conductor only, between the cord grip and the IEC connector. US polarized plugs: the live is the narrow blade, usually the smooth or black conductor.
5. **Earth.** If the brick's inlet has an earth pin (C5, C13), use a 3-wire cord and keep earth continuous. A 2-pin inlet (C7) means a double-insulated (Class II) brick; a 2-wire cord is correct.
6. **Insulate.** Every AC joint is inside a connector shell or heat-shrink. No bare metal, no tape-only joints.

## Low-voltage side

Right of the barrier, and down to the Pi sled.

| Circuit | Wire | Notes |
|---|---|---|
| Brick DC out to main fuse and splice | 18 AWG (0.75 mm²) | Check the brick's plug polarity (centre + is common, not universal) before cutting |
| Splice to projector | 18 AWG | Keep the projector's own barrel plug; splice into its cable |
| Splice to Amp4 power input | 20 AWG (0.5 mm²) | Amp4 accepts 12-24 V; it powers the Pi, so don't also power the Pi by USB |
| Splice to fans | 24 AWG | 12 V fans; PWM and tach go to the Pi |
| Relay (fallback only) | 18 AWG | Switch the **+** line to the projector. Never switch its ground: the HDMI cable would carry the return current |
| Amp4 to speakers | 16 AWG zip cord | Out through the floor chimney; red/striped to + on both ends |

Use lever-nut connectors (e.g. Wago 221) for the splice so it can be undone. Pass low-voltage wires from the shelf to the Pi through the wire slot at the back of the shelf, never across the barrier's AC side.

## Fuse sizing

Fill this in from **your** labels. The example column assumes a 12 V 5 A brick, a projector drawing 3 A and a 60 W-class brick input.

| Fuse | How to size it | Type | Example |
|---|---|---|---|
| AC fuse (live) | About 1.5x the brick's rated **input** current (the label's "Input ... A"), and no more than the cord's rating | 5 x 20 mm, **time-delay (T)**, 250 V: switch-mode bricks have an inrush surge | Label "1.2 A" gives **2 A T** |
| Main DC fuse | No more than the brick's rated **output** current, and at least 1.25x the normal total load | Automotive blade (ATO/ATC), inline holder | Brick 5 A gives **5 A** |
| Projector branch (optional) | 1.25x the projector's rated input (on its DC jack or label) | Blade | 3 A projector gives **4 A** |
| Amp4 branch (optional) | Covers the amp at full volume plus the Pi | Blade | **3 A** |

Check the total: projector + Amp4 (amp + Pi) + fans must stay under the brick's output rating with some margin. If it doesn't, you need a bigger brick; a fuse won't fix that.

## Before first power-up

1. With nothing plugged in, check continuity: live, neutral (and earth, if used) each reach only where they should, with no short between them.
2. Confirm the AC fuse sits in the **live** conductor.
3. With the brick plugged in but the splice disconnected, measure its DC output voltage and polarity at the splice.
4. Connect loads one at a time: fans, then the Amp4 (the Pi should boot), then the projector.
5. Close the lid, then test the GFCI outlet's trip button with the case running: everything must go dark.
