# AtmosFX projector case

Parametric [OpenSCAD](https://openscad.org) design for a ground-standing, rain-proof (not sealed), ventilated case that holds a mini projector and a Raspberry Pi 3 running an [AtmosFX](https://atmosfx.com) Halloween effect.

**Status: v0.8, design only. Nothing has been printed or wired yet.** Dimensions assume a typical mini projector (about 171 x 134 x 75 mm, 0.72 kg). Measure yours and edit the parameters before printing.

## Features

- Stands on the ground or mounts on a tripod: a 3/8"-16 insert near the centre of mass and a 1/4"-20 insert 30 mm forward, in a pad flush with the floor ribs.
- Anchors: sealed stake tubes inside the four corners take 8 mm tent stakes, driven from inside with the lid off. With the lid screwed on (use security screws) they can't be pulled, which deters theft and holds the case against wind.
- Sits on the ground on eight 6 mm ribs running front to back (the outer two under the side walls); the channels between them drain rain, feed intake air and carry the speaker wire.
- Projector rides on an internal ball head (pedestal takes a 1/4-20 stud). Usable aim +/-10 deg pan and +/-12 deg tilt, +/-8 deg both at once, with the image clearing the window (checked by `scripts/check_clash.sh` for the Tkisko TO2's 0.95:1 throw). For more, tilt the whole case: tripod head or a shim.
- Aim hatch on the left wall, a 45 deg diamond so it prints without supports. Tool-free, unless you fit the optional lock screw for public-facing setups: lift the cover about 8 mm off its four keyholes, loosen the ball head, aim, lock. Lid stays on.
- Sloped lid with no holes in the roof (it screws on through the side skirt), a front visor, drip lip and a 45 deg scarf joint at the seam (the front half laps over the rear like a shingle); 45 deg louvers shed rain; intake through slots in the raised floor; two 40 mm PWM exhaust fans on the right wall (projector zone, and Pi/power zone above the shelf, which has vents on its low-voltage side), speed-controlled by the Pi from temperature sensors, with over-temperature shutdown.
- Acrylic lens window in a rebate, held by a printed frame.
- Pi compartment behind a divider. The Pi rides on a removable sled: one per generation (Pi 3B/3B+, 4B, 5, Zero 2 W), located by two floor pins and held by one M3 thumbscrew. Lid off, shelf out, sled lifts out. A pass-through in the divider, open down to the sled, takes a straight HDMI plug from the Pi (the cable loops under the projector) and the projector power lead.
- One AC cord in through a rear gland on the AC side of the power shelf. The projector's stock wall-wart and a second one (24 V for the Pi, Amp4 and fans) plug into two panel-mount NEMA 5-15R receptacles on a plate on the shelf, walled off from the low-voltage side; each rail is fused, and the HiFiBerry Amp4 HAT powers the Pi.
- DMX: the Pi is a first-class E1.31/sACN fixture (8 channels: power, mode, clip, scare trigger, volume, mute, dimmer, reserved), so xLights, Falcon Player, Vixen or QLC+ can run it as part of a show. DMX takes over while its signal is present; the schedule, Home app and web page take back control when it stops.
- Motion sensor: an HC-SR501-style PIR looks out the rear wall (toward people approaching from the street) under a 45 deg rain hood, for startle scares. A remote sensor on a cable can come in through the floor chimney instead. Scares can also be fired from any Apple Home automation.
- Sound: the Amp4 (stereo class D, 12-24 V) sits on the Pi and drives speakers placed behind the projection over ordinary speaker wire. The wire leaves through a chimney in the floor, which stands 15 mm above the floor so water can't reach it, then runs out under the case between the feet.
- Front/rear split so every piece fits a 250 x 210 x 210 mm bed (Prusa MK3S).

## Build

```sh
brew install --cask openscad@snapshot   # or your OpenSCAD of choice
make parts                              # writes stl/*.stl
scripts/check_clash.sh                  # interference checks (needs python3)
```

CI builds the STLs, runs the interference checks and runs the Pi tests on every push (Actions > Build STLs; STLs are under artifacts). A `v*` tag also builds the Pi image and attaches everything to a GitHub Release.

Preview in OpenSCAD: open `projector_pi_case.scad`, set `part` and `tile` in the Customizer. `part = "assembly"` shows everything with ghosted projector and ball head. On iOS, the [OpenSCAD Playground](https://github.com/openscad/openscad-playground) works in Safari.

## Repository layout

- `projector_pi_case.scad` - the model (all parts via `part` / `tile`)
- STLs and the Pi image: download them from the repository's Releases (CI builds and attaches them for each version tag), or run `make parts` to write the STLs to `stl/`. Flashing the image: `pi/README.md`, Install.
- `docs/` - design log, [printing plan](docs/PRINTING.md), [bill of materials](docs/BOM.md), [assembly](docs/ASSEMBLY.md), [wiring](docs/WIRING.md), [aiming](docs/AIMING.md)
- `preview/` - renders of the assembly, interior, aim hatch and power shelf
- `scripts/` - `check_clash.sh`, `render_previews.sh`, `publish.sh`
- `docs/DESIGN_LOG.md` - decisions, dead ends, references
- `CLAUDE.md` - context for Claude Code (`cd` here and run `claude`)

## Parts and print notes

| File | Notes |
|---|---|
| `base_front` | 231 x 207 mm: lies flat as exported, wide side along the 250 mm bed axis; no skirt |
| `base_rear` | Pi compartment. Joins `base_front` with 4x M3 x 12 screws through the divider into its collars; silicone the joint faces |
| `lid_front`, `lid_rear` | Already flipped roof-down; `lid_front` (228 x 204 mm) lies flat as exported. Seal the scarf joint with silicone |
| `window_frame` | Holds the acrylic pane |
| `pedestal` | Screws to the floor bosses; carries the ball head |
| `hatch_cover` | Print ribs-up |
| `power_shelf` | Receptacle plate (two NEMA 5-15R snap-ins, stacked), barrier, strap and zip-tie slots |
| `vent_cap` (print 3), `intake_cap` (print 1) | Insect-screen caps for the three louver banks and the floor intake. Glue screen inside the plate, then screw on with 2x M2 |
| `ir_holder` | Only for the relay + IR projector-power fallback. Stick it near the projector's IR receiver with VHB tape |
| `sled_pi3`, `sled_pi4`, `sled_pi5`, `sled_zero2w` | Print the one for your Pi. The name is engraved on the plate |

Everything prints without slicer supports. The window opening has two thin snap-out ribs that hold up its top edge while printing; break them out afterwards.

Material: PETG or ASA, not PLA. Colour: Disney's ["Go Away Green"](https://en.wikipedia.org/wiki/Go_Away_Green), the muted grey-green the parks use to make infrastructure disappear. It's a family of shades with no published spec, so choose a matte sage or olive grey-green by eye against the spot where the case will sit. ASA holds its colour better in sun than PETG. Test first: print `pedestal` and `window_frame`, then `hatch_cover`, before the big tiles.

## Bill of materials

Full list with quantities: [docs/BOM.md](docs/BOM.md). Assembly order: [docs/ASSEMBLY.md](docs/ASSEMBLY.md).

## Aiming

1. Set the case roughly toward the target.
2. Lift the hatch cover about 8 mm and pull it off, loosen the ball head lock, move the projector while watching the image, lock it.
3. Hang the cover back on.

Full steps, aim limits and troubleshooting: [docs/AIMING.md](docs/AIMING.md).

## Power and safety

Mains is inside a printed box in this design. Feed it from a GFCI outlet, fuse the AC input and the DC output, keep AC and DC wiring on separate sides of the barrier, use fully insulated quick-connects on the receptacle tabs, leave a drip loop on the cord, and use PETG or ASA. If you are not comfortable with mains wiring, have someone qualified do that part. Wiring diagrams, wire gauges, fuse sizing and a pre-power-up checklist: [docs/WIRING.md](docs/WIRING.md). Check each wall-wart's voltage and plug polarity before cutting its lead.

## Roadmap

- Print and fit-check the small parts, then the tiles
- Confirm real projector dimensions, lens position, socket position and vent locations
- Tune fan and louver placement against the projector's actual vents

## Changelog

- v0.9 (unreleased): sized to the Tkisko TO2 (lens on the long face, 0.95 throw), front tiles print end-on, pan and combined-aim limits, receptacle plate on the power shelf for the stock wall-wart plus a second one (the brick cradle is gone), gland beside the plate, Pi zone 85 mm, wall-wart clash check
- v0.8: light-cone check, taller 4 x 5 in window set high for upward tilt, shorter visor, skirt notch, plug clearance behind the projector, fit-test coupon, interior stake tubes, lid screws moved from the roof to the skirt sides, screwed base seam, tripod mount, insect-screen caps, second fan for the Pi/brick zone, shelf vents, support-free printing (ribbed floor, diamond hatch, snap-out window ribs, gabled pass-through), IR LED holder, rear-wall PIR mount, Pi sleds for 3B/3B+/4B/5/Zero 2 W, audio (Amp4 HAT, floor chimney for speaker wire, shelf raised 5 mm), 3 x 5 in stock acrylic pane (wider window), AC gland above the shelf, taller barrier, keyholes flipped to lift off, lid scarf joint and gasket land, larger front/rear gaps so the aim range actually clears
- v0.7: DC brick inside on the power shelf, barrier, heat louvers
- v0.6: low-voltage DC splice, zip-tie shelf
- v0.5: single power cord, power shelf on ledges
- v0.4: quick-aim hatch, floor intake, rain hood
- v0.3: resized for a real mini projector, front/rear split
- v0.2: ground-standing, ball-head pedestal
- v0.1: first parametric sketch

## License

Designs, STLs and documentation: [CERN Open Hardware Licence Version 2 - Strongly Reciprocal](LICENSE) (CERN-OHL-S-2.0). Software in `pi/`: [MIT](pi/LICENSE).
