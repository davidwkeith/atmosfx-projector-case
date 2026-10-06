# CLAUDE.md - AtmosFX projector case

Context for Claude Code. Read this first, then `docs/DESIGN_LOG.md` for why things are the way they are.

## What this is

A parametric OpenSCAD design (`projector_pi_case.scad`, currently v0.8) for an outdoor case that holds a mini projector plus a Raspberry Pi 3 running an AtmosFX Halloween effect. The projector is a Tkisko TO2: 165 x 130 x 66 mm, lens on the long face and offset to the left, short throw (about 0.95:1), DC 21 V 3 A input per its label. Owner: David (dwk), web engineer, comfortable with code, learning 3D design through real projects. Halloween is the deadline, so bias toward getting parts printed and iterated over perfecting the model on screen.

**Status: design only. Nothing has been printed, fit-checked or wired.** The projector's depth is measured; its other dimensions come from the manual and photos (see "Unverified" below). `docs/measurements.xlsx` is the owner's fill-in worksheet (defaults, manual specs, measured, flag).

## Commands

```sh
make parts                    # all STLs -> stl/ (gitignored). OPENSCAD=/path/to/openscad if not on PATH
scripts/check_clash.sh        # interference checks incl. cover lift-off path, lid tiles, the projector + plug aim sweep and the light cone. Must all say ok. Needs python3
# docs/PRINTING.md has sliced times (PrusaSlicer CLI with the stock MK3S profiles); print fit_coupon first
scripts/render_previews.sh    # regenerate preview/*.png (needs a GL context; xvfb-run on headless Linux)
scripts/publish.sh            # create a PRIVATE GitHub repo with gh and push
```

Single part by hand: `openscad -o out.stl -D "part=\"base\"" -D "tile=\"front\"" projector_pi_case.scad`

`part` = assembly | base | lid | window_frame | pedestal | hatch_cover | power_shelf | sled | ir_holder | vent_cap | intake_cap | fit_coupon. `sled` = pi3 | pi4 | pi5 | zero2w (assembly shows it; `make parts` builds all four). `tile` = all | front | rear (base and lid only). STLs are not committed: CI attaches them to a GitHub Release for each `v*` tag; `stl/` is regenerated output.

Versioning: one version for the whole repo. `pi/package.json` version = the git tag without the `v` (e.g. 0.8.1 / `v0.8.1`); `videofx-update` compares them. Bump both together.

Docs: `docs/PRINTING.md` (sliced times, order), `docs/BOM.md` (quantities, ordering, cost), `docs/ASSEMBLY.md`, `docs/WIRING.md`, `docs/AIMING.md`, `docs/BRINGUP.md` (hardware test checklist), `docs/DESIGN_LOG.md`. Keep them in step with model changes; re-slice for PRINTING.md with the PrusaSlicer CLI (`--printer-profile "Original Prusa i3 MK3S & MK3S+" --print-profile "0.20mm SPEED @MK3" --material-profile "Prusament PETG"`, datadir seeded with the bundled PrusaResearch.ini).

Toolchain on the owner Mac: OpenSCAD snapshot (`brew install --cask openscad@snapshot`; the stable cask is an old Intel build; it aborts with "Incompatible processor" inside Claude Code's sandbox, so run it unsandboxed), PrusaSlicer, two Prusa i3 MK3S (bed 250 x 210 x 210).

## Model layout (projector_pi_case.scad)

Coordinates: XY origin at the centre of the case footprint. **-Y is the front** (lens/window), **+Y is the rear** (Pi compartment). **-X is the left wall** (aim hatch), **+X the right wall** (40 mm fan exhaust). Z=0 is the ground.

Key derived values (in the `/* [Hidden] */` block): `z_floor` (floor top, = foot_h + floor_t), `z_pj` (projector underside), `z_lens`, `y_front`, `y0` (inner front face), `y_div` (Pi divider), `y_pi0`, `y_back`, `proj_cy` (projector centre in Y), `base_h`, `out_w/out_d`, `inner_w/inner_d`.

Modules: `base_all` (shell, feet, divider, lid screw blocks, sled interface, ledges, hoods, cuts), `cuts` (all subtractions, one place), `lid` (sloped roof with no holes, front visor, side screw slots and spacer rings, flat gasket land, seam rib), `lid_tile` (45 deg scarf split), `projector` (ghost, pan/tilt about `pivot`), `window_frame`, `pedestal` (bolt-down plate plus column with a 1/4-20 insert for the ball head), `hatch_cover` (keyhole cover), `power_shelf` (brick cradle, barrier, zip-tie slots), `hood`, `ledge`, `louvers`, `tile_cut`, `pi_sled(s)` (per-generation plate), `pi_stack(s)` (Pi + HAT envelope).

Splitting: `base_seam = y_div + div_t + 0.01` (just behind the Pi divider). The rear tile has collars inside its side walls (`collar_t`, `collar_d`); 4x M3 screws go from the projector side through the divider into them (`seam_screw_z`), plus silicone on the faces. `lid_seam = yfl - visor_len + lid_front_len` (200), split by `lid_tile` along a 45 deg plane through the roof plus `seam_rib`, so the front tile laps over the rear and both print without supports. The lid seam sits over the projector, which is why it is not a butt joint.

Print orientation is baked into the `part` dispatch at the bottom (lid flipped roof-down and rotated by `lid_a`, hatch cover flipped ribs-up, window frame laid flat). The front tiles lie flat as exported: X (231 / 228 mm) runs along the bed's 250 mm axis and depth (207 / 204 mm) along the 210 mm axis. `base_front` has about 3 mm to spare, so `front_gap`, `rear_gap` and `proj_d` cannot grow without moving `base_seam`.

## Conventions to keep

- Customizer: parameters live under `/* [Section] */` headers; derived values under `/* [Hidden] */`. Add new knobs as parameters, not magic numbers. `clearance` is the general fit variable.
- OpenSCAD top-level variables are evaluated in order: referencing one before its definition gives `undef` (this bit us once with `lid_seam` and `yfl`). Functions can reference later variables.
- PETG (or ASA) for everything; PLA only for prototypes. Preferred colour: Disney "Go Away Green" (muted grey-green; no official spec, so match by eye). Print small critical pieces first (pedestal, window frame, hatch cover) before the big tiles. Orient so load runs within layers.
- Prefer 45 deg gussets and slopes so nothing needs supports (ledges, hoods, louvers, the diamond hatch, the gabled pass-through). The base prints upright, so the floor stands on `foot_ribs` (bridges <= 27 mm) and the window, which has to stay inside the pane, gets snap-out ribs with a `layer_h` gap. Anything new with a horizontal top edge over ~30 mm needs the same treatment.
- Keep interference checks green after any geometry change. If you add a part that mates with another, add a pair to `scripts/check_clash.sh`. The script measures the intersection volume, so parts that merely touch pass ("contact"); anything over 0.5 mm3 is a clash.
- `%` ghosts (projector, ball head) only show in preview, never in exports.
- `--camera` needs all seven numbers; `--viewall` produced tiny renders, so set the distance by hand.

## Design decisions (short; details in docs/DESIGN_LOG.md)

- Rain-proof, not sealed: a sealed box overheats the projector. Airflow: intake slots through the raised floor and 45 deg louvers; two 40 mm PWM fans on the right wall (`fans`: projector zone, and the Pi/brick zone above the shelf, fed through vents on the shelf's low-voltage side). The Pi runs fan curves from DS18B20 sensors and shuts the projector off on over-temperature. `fan_body()` is in the aim sweep and the `fans` clash check.
- Visitor safety: cords routed off paths or under cord covers, plug joints in weatherproof boxes, optional hatch lock screw (`hatch_lock`), flame-retardant V-0 PETG recommended for the power shelf.
- Ground-standing on 6 mm feet so the case drains underneath; drains exit into the gap under the floor. Also tripod-mountable: 3/8-16 (`tripod_y`, near the estimated centre of mass) and 1/4-20 (`tripod_y2`) inserts in a pad flush with the ribs. Move `tripod_y` once the real centre of mass is known.
- Projector on a commercial mini ball head (1/4-20). The body clears +/-15 deg tilt (`aim_max`), +/-10 deg pan (`pan_max`: past this the light cone clips the window frame at the TO2's 0.95 throw ratio, and the case can be turned for more) and +/-8 deg on both (`aim_combo`: the rear plugs reach the divider past this); the light cone (`light_cone`, `throw_ratio` 0.95, `lens_offset`) clears the window, frame and visor at +/-12 deg tilt (`cone_tilt`), which is the real limit. The projector-zone fan body sits 14 mm proud of the right wall inside `side_air`, which is why the side gap cannot shrink. Plugs on the projector's rear (`projector_ports`, `port_depth` 15 for right-angle plugs) size `rear_gap`. The window is a 4 x 5 in pane set as high as the base allows (`pane_top_clear`), with the lid's front skirt notched over it and a short visor/lip, because upward tilt is the main use. The low pivot swings the top corners about 20 mm, which sizes `front_gap` and `rear_gap`. Both at 15 deg would push `base_front` past 250 mm. Printed ball joints were rejected (creep under load). Mini heads are rated about 1.5 kg; the projector is about 0.72 kg.
- Lid: 4x M3 screws go sideways through the skirt (`lid_screw_ys`, `lid_screw_z`) into 45 deg-underside blocks in the base wall tops. The roof has no penetrations; the lid prints roof-down, so nothing can stand proud of the roof. Slots let the lid be pressed onto the gasket before tightening.
- Theft and wind: four sealed stake tubes inside the corners (`stakes`, `stake_pts`) take tent stakes driven from inside; security screws on the lid keep them in. External tabs were ruled out because they push the front tile past the 210 mm bed axis.
- Aiming is the main setup task, so the left wall has a tool-free hatch: cover hangs on four M4 button-head bolts through keyholes (narrow end up); lift `kh_drop`, pull off, aim, hang back. The diamond is 108 mm (`hatch`) centred 56 mm above the floor (`hatch_zc`): its lower tip sits just above the floor and its hood just under the lid skirt. A 45 deg hood sheds rain, leaves room for the lift and must stay below the lid skirt (both checked).
- One AC cord in through a gland above the shelf on the AC side, DC brick inside on the power shelf behind a barrier taller than the brick; fuses on both the AC input and the DC output; a wire splice feeds the projector barrel plug and a HiFiBerry Amp4 HAT, which powers the Pi (no buck converter). The TO2's label reads DC 21 V 3 A, so the rail is 21 V: the Amp4 takes 12-24 V, but the fans must be 24 V parts.
- Pi sleds: the base has a fixed interface (four pads `sled_pts`, two locating pins, one M3 insert). Each sled carries one generation's hole pattern. Every board sits with its GPIO edge at `y_gpio`, so the Amp4 lands in the same place; the Zero 2 W sled adds two tall posts for the overhanging HAT. Heights come from `sled_stack(s)` and an assert keeps `shelf_z` above the tallest; `check_clash.sh` checks every sled and stack. Pads lift the sled so floor water reaches the drains.
- DMX is first class: E1.31/sACN receive over the network (no wired DMX, no new holes). DMX overrides Matter/web/schedule while a source is live, then hands back after a timeout.
- Projector power: HDMI-CEC first; fallback is a relay on the projector's + DC line (never switch its ground: HDMI would carry the return) plus an IR LED in `ir_holder` sending the remote's power code. The relay forces a known off state, so the IR toggle stays in step.
- Insects: every opening is screened. Louver banks (`vents`) and the floor intake get `screen_cap`s (screen glued inside, 2x M2 into 1 mm bosses; tabs top/bottom for driver access). Fans clamp screen between fan and bosses. The chimney takes a foam plug; the gland and PIR dome are sealed. `screen-caps` in check_clash.sh.
- Motion sensor: PIR in the rear wall (`pir_*`), facing where visitors approach (the case faces the projection surface, so the street is behind it), under a 45 deg hood; its wires drop to the Pi through a slot in the shelf's low-voltage side. The Pi software fires scares from it, from a Matter "Scare" endpoint, or from the web page.
- Audio: Amp4 on the Pi drives speakers behind the projection over standard speaker wire. The wire goes down a floor chimney (`spk_x`, `spk_d`, `spk_collar`) into the gap under the floor and out between the feet. Figure-8 zip cord doesn't seal in a round gland, which is why the wire exits through the floor. `pi_stack()` is the Pi + HAT envelope; `pi-shelf` in check_clash.sh keeps it under the shelf.

## Unverified / assumptions (fix these first)

1. Projector: 165 x 130 x 66 mm. Depth is measured (calipers); width and height are the manual's 6.5 x 2.6 in. Lens height and offset (`lens_z` 33, `lens_x` -20) and the 1/4-20 socket position (`mount_x` 19, `mount_y` -4) are scaled off photos. Vent and port locations are unknown (louver/fan positions, `port_band`, `port_depth`).
2. Projector power control is HDMI-CEC from the Pi (fallback: HDMI output off). Whether the owner's projector supports CEC is unknown.
3. Centre of mass for the tripod insert: estimated about 12 mm behind the footprint centre from guessed weights (case 1.5 kg, projector 0.72 kg, brick 0.4 kg).
4. DC brick: assumed 100 x 50 x 32 mm. The projector label reads DC 21 V 3 A; confirm that reading and the polarity before wiring, and note the stock brick covers the projector alone.
5. PIR dome diameter and hole spacing (`pir_dome_d` 23.5, `pir_hole_sp` 28.7) and which GPIO the Amp4 leaves free. Stack heights per sled (`pi_stack_h` 40, `pi5_stack_h` 50 with Active Cooler, `zero_stack_h` 30, `zero_hat_z` 13 are guesses), Amp4 support and power on Pi 5 and Zero 2 W, and whether the brick can supply projector + Pi + amp together.
6. Ball head height (`ball_head_h` = 40) and the aim range depend on the head actually bought. Throw ratio (0.95, derived from the manual's image sizes), lens offset (0), lens height, and where the projector's HDMI/power ports are (`port_band`, assumed on the rear face with right-angle plugs) are all unmeasured.
7. Fit of hatch keyholes, acrylic rebate (sized for a 4 x 5 in, 1/8 in pane; `pane_w`/`pane_h` drive the window), heat-set insert holes (`insert_d` 8.2 for 1/4-20, `m4_insert_d` 5.6) is untested.
8. Base seam collars and screws, the lid scarf joint and the gasket land are unprinted.
9. Pi software lives in `pi/` (Matter switch, mpv player, scares, schedule, web UI, audio to the Amp4); untested on hardware. Device-facing names use `VideoFX-XXXX` (hostname `videofx-xxxx`, last 4 of the MAC; system paths and units `videofx`), not the AtmosFX trademark.

## Next steps

Work through `docs/BRINGUP.md` in order:
1. Print `fit_coupon`; tune insert/pilot/keyhole/pane tolerances.
2. Owner fills in `docs/measurements.xlsx` (width, lens, socket, ports, throw ratio, offset, brick, ball head); update the flagged parameters; rerun `scripts/check_clash.sh` (body, plugs and light cone) and `make parts`; re-slice for PRINTING.md.
3. Bench-test the Pi image (CEC, seam time, Amp4 power, PIR, sensors, Matter, DMX, update/rollback, power cut).
4. Print the rest, assemble per `docs/ASSEMBLY.md`, wire per `docs/WIRING.md`, then heat, rain and night tests.
5. Later: multi-projector sync (deferred), tune fan/louver positions against the real projector vents.

## Safety

Wiring, wire gauges, fuse sizing and the pre-power-up checklist live in `docs/WIRING.md`; keep it in step with any power change.

Mains is inside a printed box in this design. Do not soften these: GFCI-fed, fused AC input, fused DC output, mains-rated cord grip with drip loop, AC and DC wiring on opposite sides of the barrier, insulated brick terminals, PETG/ASA only. Tell the owner to have someone qualified do the mains wiring if they are not comfortable. Never present the case as certified or waterproof: it is rain-shedding and ventilated.

## Working with the owner

Short answers. Give links and let them do the work; verify every link resolves (a 404 means the homework was not done). Iterate quickly with test prints. Deliver output files individually rather than zipped when handing back single artifacts.
