# Passive airflow: drop the fans, channel the projector's own

Date: 2026-10-06. Status: spec, awaiting owner review. Scope: SCAD model, Pi software, wiring/BOM/docs, clash checks.

## Goal

The projector's own fan moves the air. The case only has to give it a clean path in and out, rain-shedding and insect-screened. The Pi is cooled passively. Nothing else is cooled. Everything that exists only for active cooling goes.

## Owner-supplied facts (2026-10-06)

- **Exhaust:** projector's right face, the first 40 mm from the front, full height (66 mm).
- **Intake:** projector's rear face, 40 x 40 mm square, 15 mm from the right edge and 15 mm from the top. Confirmed on the rear face. Z span above the projector underside: 11 to 51.
- **Ports:** the DC barrel jack is on the rear face just above and to the right of the intake, so in the 15 mm top-right corner band (Z 51-66, X within 15 mm of the right edge). HDMI, USB and the AV mini-jacks are on a panel at the top of the **right face**, not the rear.
- **Duty:** the effect runs at night only; the projector is off by day.

### Read off the owner's photos (IMG_8913-8918, speed square for scale; about +/-2 mm)

- **Right face, exhaust grille:** slots from about 10 to 42 mm behind the front face, full height, plus a front fabric strip. The 40 mm figure holds.
- **Right face, I/O pocket:** a recessed strip along the top, about 18 mm tall, from about 41 to 118 mm behind the front. Centres from the front: HDMI 56, USB 80, AV 99, headphone 109; HDMI is about 9 mm below the top edge. Only HDMI is used.
- **Rear face, right intake:** grille 37 x 38 mm, about 16 mm from the right edge and 17 mm below the top (Z 12-49 above the underside). Matches the owner's 40 mm, 15 / 15.
- **Rear face, DC jack:** centre about 15 mm from the right edge and 13 mm below the top (Z 53), directly above the intake's right half. A barrel plug body (about 11 mm) overlaps the top 3 mm of the intake patch; acceptable. A Type-C port 50 mm from the right edge is unused.
- **Rear face, second grille:** a speaker (owner, 2026-10-06), on the lens lobe, X about -67 to -33, Z 12-46. Not an air path. It faces the rear gap, so nothing may block it (the inlet bank and baffle are on the right, clear of it); its sound just reflects off the divider.
- **Front face, IR receiver (owner, 2026-10-06):** centred above the Tkisko logo, which sits on the right lobe. From the photo that puts it near X +35 (right of centre) and Z about 50 above the underside; confirm with calipers. It lies in the front gap behind the acrylic pane (the window spans X -83 to +43) and outside the light cone, so the `ir_holder` and its LED fit there.
- **Left face:** plain, no vents or ports. **Top:** buttons and a slot on the lens lobe, a diamond texture on the other; no vents.

## Airflow design

Air path: outside, right-wall inlet bank, rear gap, projector intake (rear face), projector fan, exhaust (right face, front), right-wall exhaust bank, outside.

1. **Exhaust bank (right wall, front).** 45 deg rain louvers over an opening spanning the exhaust patch plus aim margin: Y = 40 + 2 x `air_margin`, Z = 66 + 2 x `air_margin_z`, starting at the projector's front face. Margins give partial cover of the pan/tilt sweep (at the extremes some exhaust leaves into the side gap, which is the plenum; a rigid duct cannot follow the ball head). A `screen_cap` covers it (part `vent_cap`).
2. **Inlet bank (right wall, rear).** Louvers over the rear gap, centred on the intake's height (z_pj + 31). The rear gap (`rear_gap` 34 mm) is the plenum: no printed duct, since the projector moves. A `screen_cap` covers it (part `intake_cap`, now wall-mounted).
3. **Baffle.** One vertical rib on the right wall's inside face between the two banks (`baffle_d` deep, full inner height), so exhaust that stays inside the case does not creep back to the rear inlet along the side gap. Depth is capped by the aim sweep: `baffle_d <= side_air - swing`, asserted and checked in `aim-sweep`. It is a lip, not a seal.
4. **One passive Pi-zone louver.** Right wall, over the shelf's low-voltage side, high (the existing `vents` entry at `shelf_zz + 26`, 26 x 42 opening, part `vent_cap` unchanged). Warm air leaves here; make-up air arrives through the open divider pass-through. The effect only runs at night, so there is no solar load on the Pi zone while the electronics are working.
5. **Everything else closes.** Removed: both 40 mm fan seats and their bosses, the other two louver banks, the floor intake slots and cap, the shelf's heat-rise slots.

Three screen caps remain (was five): `exhaust_cap` (new), `intake_cap` (now the rear inlet, wall-mounted), `vent_cap` (Pi zone, unchanged). The floor no longer takes splash and nothing is mounted proud of the right wall.

## Cables

- **DC barrel (rear, top-right corner):** a right-angle barrel plug points back and clears the intake patch (it is above Z 51). Keep-out stays in `projector_ports` with `port_band` moved to Z 51-66 and X right 0-15 from the edge. The wall-wart's DC cord reaches it through the rear gap.
- **HDMI / USB / AV (right face, top):** plugs now stick out into the right side gap, which is `side_air` 25 mm minus the pan swing, so right-angle HDMI (and no USB or AV cables left plugged in) is required. New keep-out `projector_side_ports` (from the photos: the HDMI plug at 56 mm from the front, top 18 mm of the right face, right-angle, cable pointing rearward, `side_port_depth` 15). The HDMI cable runs back along the side gap above the baffle to the Pi's pass-through, so the baffle's top stops below the I/O strip (`baffle_gap` 22 mm under the top edge; the rib blocks the lower 44 mm of the gap, and exhaust leaking over it is accepted). The HDMI plug at 56 mm sits just behind the exhaust opening (which ends near 50 mm with its aim margin), so the baffle itself stands at about 50 mm and the plug passes over it and the HDMI keep-out joins the `aim-sweep` check.

## Pi software

Remove: fan PWM (`SysfsPwm`), tach, `ThermalControl` and fan curves, DS18B20 reading, the sensor-loss shutoff, the Cooling settings group (`fan1/2Curve`, `fanMinDuty`, `fanCooldownSec`, sensor IDs, `thermalEnabled`), fan/tach/1-wire GPIO entries (GPIO 12, 13, 24, 25, 26), the `setup.sh` PWM and w1 overlay block, and the matching tests and UI.

Keep: SoC temperature read (`thermal_zone0`) for the web UI and the Matter temperature sensor, and `OverTempGuard` fed by SoC temperature only (powers the projector off past `tempCritC`). The projector's own thermal cutoff is its protection; nothing else is claimed.

Side benefit: hardware PWM0 (GPIO12) is free, so `pwm-ir-tx` becomes legal for the IR fallback; drop the guard in `config.js` that forbids it.

## Power

The second wall-wart no longer has to be 24 V for fans. It feeds the Pi and DigiAMP+ only (12-24 V; pick for amp volume). The fan fuse and branch go; WIRING.md and `render_wiring.py` change, SVGs regenerate. The "fans must match the second rail" caveat goes from CLAUDE.md and the BOM.

## Model and checks

- **IR holder keep-out.** New parameters `ir_x` (35) and `ir_z` (50, above the underside). `ir_holder` goes into the assembly at the front face and into `aim-sweep` and the light-cone check (it must clear the pane, frame and visor over the pan/tilt range inside `front_gap` 30, and stay out of the cone). The LED lead runs up and back over the top of the projector; allow for it in the side gap past the baffle.

- New parameters: `exh_len` (40), `exh_h` (= `proj_h`), `in_size` (40), `in_top` (15), `air_margin`, `air_margin_z`, `baffle_d`, `baffle_gap`, `side_port_depth`, `side_port_y`, `side_port_h`. Changed: `port_band` (barrel corner), `vents` (one entry). Removed: `fan`, `pi_fan_dz`, `fans`, `fan_z`, `pi_fan_z`, `fan_body`, `intake_c`, floor intake cuts and bosses, shelf vent slots.
- `check_clash.sh`: drop `fans`; fix `warts`/`aim-sweep` (they referenced `fan_body`); `screen-caps` covers the three wall caps; add the baffle to `aim-sweep`; add a check that the intake patch is inside the inlet opening and the exhaust patch inside the exhaust opening at zero aim.
- Bed fit is unaffected (outer size unchanged). `side_air` stays 25 for now: with the fan body gone it could shrink to roughly 19 mm (pan swing 16 mm plus clearance), which would pull the base off the 210 mm axis limit. That is a separate change; flagged, not done here.
- Docs updated in step: BOM (fans, DS18B20s, pull-up; screen caps 5 to 3), ASSEMBLY, BRINGUP (fan/sensor rows), PRINTING (re-slice), DESIGN_LOG (new entry, supersedes the Heat and Insect screen decisions), CLAUDE.md, README, `pi/README.md`.

## Risks to carry into bring-up

1. **Side-panel position** is now photo-derived (41-118 mm from the front, top 18 mm), good to a few mm; confirm with calipers before printing the baffle.
2. **Pi zone heat.** Two wall-warts and a DigiAMP+ sit behind one passive louver. Bring-up should log SoC and shelf temperature on a warm night with the lid on. Night-only duty keeps the load low; if it still runs hot, a second low louver on the other wall completes the convection loop (no fan).
3. **Recirculation.** Exhaust at the front and intake at the rear are 90 mm apart behind a lip baffle. A hot-day test with a thermometer at the intake is the real check.
4. **Louver opening size** vs. the projector's real vent patches is from owner measurements, not photos; re-measure before printing the caps.

## Out of scope

Shrinking `side_air`, multi-projector, any change to the hatch, shelf layout, sleds or lid.
