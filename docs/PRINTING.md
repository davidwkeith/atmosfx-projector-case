# Printing plan

One Prusa i3 MK3S (bed 250 x 210 x 210 mm). One material: **PETG** for every part (black Inland PETG for the inside parts, where black also stops light glowing through; any colour you like for the base and lid tiles, `hatch_cover` and `cord_clamp`). Times and weights are PrusaSlicer's estimates from the current STLs with the stock `Original Prusa i3 MK3S & MK3S+` printer profile and the `Prusament PETG` material profile, plus the tile settings below on the base and lid tiles (re-sliced 2026-10-25 with `make slice`: PrusaSlicer 2.7.2, PrusaResearch bundle 1.11.12). `make slice` (or `scripts/slice.sh PART...`) re-slices with these settings and prints a table of time and weight; it finds PrusaSlicer on the PATH or in `/Applications` (`PRUSASLICER=/path/to/binary` otherwise). `make 3mf` (or `scripts/slice.sh --3mf PART...`) writes the same thing as PrusaSlicer projects, `3mf/PART.3mf`: open one and every setting below is already in place (the preset names show as modified where the tile overrides apply); each release also carries them. PrusaSlicer has no Inland profiles: start from `Generic PETG` and set the temperatures printed on each spool. Real prints run a little longer.

## Settings

- Print profile **0.20mm SPEED @MK3** for the small parts and **0.30mm DRAFT @MK3** for the four tiles (v0.18, 2026-10-25: PETG bonds its layers well enough at 0.30 mm, and it saves about 24 h on the base tiles). The window ribs leave a gap of one layer and the floor holes a one-layer skin (`layer_h` = 0.3 in the model). If you print a tile at another layer height, set `layer_h` to match and re-export.
- **No supports** anywhere: every part is designed support-free.
- **Why PETG and nothing else (2026-10-25).** The base tiles are big solid slabs on narrow ribs (`base_front` 231 x 207 mm). A higher-shrink material lifted off the bed or split between layers on every attempt on this printer, even in an enclosure. PETG shrinks far less and needs no enclosure, so it is the only material the design asks for. It is fine outdoors for the one-month run. On smooth PEI, wipe on a thin layer of glue stick as a release agent: PETG can bond hard enough to tear the sheet.
- **Tile settings.** The base and lid tiles and `split_test` change these settings from the stock profile. [`slicer/tiles.ini`](../slicer/tiles.ini) holds them (plus [`slicer/front_tiles.ini`](../slicer/front_tiles.ini) for the front tiles' brim): the 3MFs carry them; on the command line add `--load slicer/tiles.ini` (then `--load slicer/front_tiles.ini` for `base_front` and `lid_front`) after the profile options; in the GUI from an STL, type the values from the file into the Print Settings tab and save them as your own preset. Cooling stays as the PETG profile sets it.
  - **Perimeters 7**: the 3 mm `wall` then prints solid instead of two perimeters over infill. It is stronger, sheds rain better and stops the crosshatch showing through ([layers and perimeters](https://help.prusa3d.com/article/layers-and-perimeters_1748)).
  - **Top solid layers 7** (or minimum top shell thickness 1.4 mm) and **infill 25%**: the 6 mm floor bridges between `foot_ribs`, and the stock top layers do not cover the sag ([poor bridging](https://help.prusa3d.com/article/poor-bridging_1802), [infill problems](https://help.prusa3d.com/article/problems-with-infill_1994)). [Ironing](https://help.prusa3d.com/article/ironing_177488) on top surfaces is optional.
  - **Rib feet and glue stick** (v0.17): the base tiles touch the bed only through their foot ribs, so each rib flares from 4 to 10 mm on the bed with a 45 deg chamfer (`rib_foot_w`, `rib_foot_t`; the outer ribs flare inward only). Wipe a thin layer of glue stick on the sheet where the ribs land as well. `base_front` lifted 6 mm at the corners without them (2026-10-24).
  - **Brim** against warping ([warping](https://help.prusa3d.com/article/warping_2011)): 5 mm on `base_rear` and `lid_rear`. The front tiles leave little room on the 210 mm axis (`base_front` 207 mm, `lid_front` 204 mm), so [`slicer/front_tiles.ini`](../slicer/front_tiles.ini) gives both a 1.5 mm brim and no skirt. All four tiles also have mouse ears in the model (`ears`, v0.12), 0.6 mm thick (`ear_layers` 2: two 0.30 mm layers, three on the hatch cover's 0.20 mm) and 18 mm across: the base tiles at both ends of every foot rib, since the base stands on ten 4 mm ribs, and the lid tiles at the roof corners, which lie on the bed. `hatch_cover` has them at its four corners too. Peel or cut them off after printing; set `ears = false` and re-export to drop them.
  - **Floor holes closed from below** (`hole_skin`, v0.13): the drains, the speaker-wire chimney and the stake bores start one layer above the floor's underside, so the floor's first layer bridges solid between the foot ribs instead of hanging the hole rims in mid-air (PrusaSlicer's "Floating bridge anchors" warning). Punch the skin out after printing ([ASSEMBLY.md](ASSEMBLY.md) step 2). PrusaSlicer still warns about long bridging (the floor spans up to `max_bridge`, by design) and collapsing overhangs (the floor's open ends, at the outer wall and the seam face, span between rib ends) on both base tiles: dismiss these, and don't enable supports (they would fill the drain channels under the floor).
  - The Parts table's times for the four tiles include these overrides, all at 0.30mm DRAFT.
- The front tiles lie flat as exported: `base_front` is 231 x 207 mm and `lid_front` 228 x 204 mm, wide side along the bed's 250 mm axis. 207 mm on the 210 mm axis leaves no room for a skirt: turn it off or keep it tight to the part.
- The STLs are already in print orientation (lid roof-down, hatch cover ribs-up, window frame flat, caps plate-down).

## Fit coupon

`fit_coupon` tests every fit the case depends on in a 1.5-hour print, so a wrong tolerance shows up before a 39-hour one. Print it in PETG, let it cool for an hour, then work through the table. Results go in [BRINGUP.md](BRINGUP.md) row 1 and the `coupon` and `inserts` entries of [measurements.yaml](measurements.yaml).

What is on it:

- **Strip (118 mm long)** with seven labelled bosses, left to right: `1/4` (1/4-20 insert), `M5i` (M5 insert), `M3i` (M3 insert), `M3` (M3 through-hole), `M3p`, `M2.5p`, `M2p` (pilots for self-tapping screws). The holes are blind with a 1.2 mm floor, like the real parts, except the M3 through-hole.
- **Keyhole tab** off the strip's left end, as thick as the hatch cover.
- **Pane slot block** at the strip's right end.
- **Hot-shoe block** below the strip at the left. The T-slot opens on the left edge.

| Feature | How to test | Good fit | If not |
|---|---|---|---|
| Heat-set inserts (`1/4`, `M5i`, `M3i`) | Press each insert in with the iron at the insert maker's temperature. Once cool, drive a screw in and back out three times | Goes in straight and flush with steady pressure; the boss doesn't crack or bulge; the insert doesn't spin or pull out | Spins or pulls out: make the hole 0.1-0.2 mm smaller. Needs force, or the boss cracks: 0.1-0.2 mm bigger. Parameters: `insert_d` (1/4-20), `stud_insert_d` (M5), `m3_insert_d` (M3) |
| Pilots (`M3p`, `M2.5p`, `M2p`) and the `M3` through-hole | Drive the screw for each pilot in and out three times. Pass an M3 screw through the `M3` hole | Pilots: firm torque, threads hold on the third pass, boss doesn't split. Through-hole: the screw drops through without binding | These sizes (2.6, 2.2, 1.8 and 3.4 mm) are fixed numbers in the SCAD, not parameters. If one fails, they need to become parameters first: ask for that change rather than editing the numbers by hand |
| Keyhole | Push an M5 button-head bolt's head through the round end, slide it 8 mm to the narrow end | Head passes freely, the shank slides without catching, and the tab doesn't wobble on the bolt at the narrow end | Narrow end too tight or loose: change `stud_d` (slot = `stud_d` + 0.8). Head won't pass: raise `stud_head_d` (opening = `stud_head_d` + 1.5). The same numbers cut the hatch cover |
| Pane slot | Slide the frame glazing into the slot | Goes in by hand without forcing and doesn't rattle much | The slot is `pane_t` + 0.5, the same as the base's rebate. Measure your pane and set `pane_t` |
| Hot-shoe T-slot | Slide the ball head's hot-shoe adapter in from the left edge and tighten its ring on the lips | Can't wobble or slide out once the ring is tight | Change `shoe_clr` (clearance per side), or measure the adapter and set `shoe_ch_w`, `shoe_open`, `shoe_lip_t`, `shoe_foot_l`, `shoe_neck_d`. The pedestal uses the same slot (`ped_mount`), so a change here changes the pedestal too |
| Shrink | Measure the strip's length with calipers once it is fully cool | Enter it as `coupon.strip_len` in measurements.yaml; `uv run scripts/check_measurements.py` says the pane clearance after shrink is ok | TIGHT: scale `window_frame` and `base_front` by 118 / your length in the slicer, or add the shortfall to `pane_w` and `pane_h` |

After any change: `make parts`, then `scripts/check_clash.sh`. If you changed a size by more than 0.2 mm, reprint the coupon and test that feature again before the big prints. None of the coupon's features use `clearance`. It sets the pane rebate's width and height (`pane_w`/`pane_h` + 2 x `clearance`), which only the shrink row checks.

## Parts

| Part | Qty | Time | Material, weight | Notes |
|---|---|---|---|---|
| `fit_coupon` | 1 | 1 h 34 m | PETG 19 g | **Print first.** Test inserts, pilots, the keyhole on an M5 bolt, the frame glazing in its slot, the ball head's hot-shoe adapter in its T-slot |
| `pedestal` | 1 | 1 h 36 m | PETG 27 g | Hot-shoe T-slot on top for the ball head's adapter. The coupon passed in an earlier material; check the adapter can't wobble once the ring is tight |
| `window_frame` | 1 | 1 h 18 m | PETG 20 g | |
| `hatch_cover` | 1 | 2 h 34 m | PETG 46 g | Mouse ears at the four corners |
| `sled_pi3` / `pi4` / `pi5` / `zero2w` | 1 | 1 h 7 m to 1 h 28 m | PETG 18-20 g | The one for your Pi. Pi 3/4 (1 h 28 m, 20 g) carry the upright fan plate; it prints standing, the diamond intake needs no supports |
| `vent_cap` | 1 | 12 m | PETG 2 g | Pi-zone louver |
| `intake_cap` | 1 | 14 m | PETG 3 g | Rear inlet bank, wall-mounted |
| `exhaust_cap` | 1 | 21 m | PETG 4 g | Front exhaust bank; the opening is about 74 x 58 mm, the biggest of the three caps |
| `ir_holder` | 1 | 10 m | PETG 1 g | Needed: the projector has no CEC (BRINGUP row 9, 2026-10-25), so the IR LED sends its power code |
| `power_shelf` | 1 | 2 h 28 m | PETG 47 g | Prints flat. Carries the brick (provisional envelope) |
| `cord_clamp` | 1 | 44 m | PETG 11 g | Both halves in one print, flat, wall-face down. Holds the AC cord at the rear-wall opening |
| `lid_rear` | 1 | 6 h 32 m | PETG 162 g | 0.30mm DRAFT, tile settings and mouse ears |
| `lid_front` | 1 | 10 h 31 m | PETG 255 g | 0.30mm DRAFT, tile settings, mouse ears and the 1.5 mm brim |
| `base_rear` | 1 | 17 h 8 m | PETG 416 g | 0.30mm DRAFT, tile settings, mouse ears and rib feet (v0.18) |
| `base_front` | 1 | **38 h 47 m** | PETG 971 g | 0.30mm DRAFT, tile settings, mouse ears, rib feet and 4 mm window ribs (v0.18) |
| **Total** | | **about 86 h** | **PETG about 2 kg** | One `sled` and `ir_holder` counted, `split_test` not (5 h 34 m, 126 g). About 1.85 kg is the outside colour (`base_front` alone is 971 g) and 0.15 kg black for the inside parts: three 1 kg spools leave room for one failed small part, not a failed tile. The tile settings (7 perimeters, 25% infill, 7 top layers) add about 0.5 kg over the stock profile. |

## Order, on one printer

Printed so far, before the switch to PETG: `fit_coupon`, `hatch_cover`, `cord_clamp`, `lid_rear` (2026-10-16) and an early `base_rear` (by 2026-10-21). The owner reuses `hatch_cover`, `cord_clamp` and `lid_rear` for 2026 (reprint them in PETG later). The early `base_rear` is for test-fitting only: it has the old PIR hood (the dome cannot pass) and predates the brick layout; [DESIGN_LOG.md](DESIGN_LOG.md) has what went wrong with the base tiles before PETG. `cord_clamp` and `base_rear` also came before BRINGUP row 4: if the real cord or brick changes `cord_d`, `brick` or the shelf layout, they change anyway.

`split_test` is an optional check before committing two days to a base tile (PETG, same profile and `slicer/tiles.ini` as the base tiles; `make parts` builds it). It is the back 50 mm of `base_rear` at full width (`split_test_d`): the same ribs, floor, rear wall, corners and stake tubes, cut 30 mm above the floor (`split_test_h`), so the floor shrinks over the real 231 mm and the walls leave it the way they do on the tile. Let it cool, then look for a crack along the first wall layers above the floor and at the corners, and try to snap a corner off by hand: layers that bonded tear through the plastic, not along a layer line. At 50 mm deep it cannot show warping across the 207 mm of `base_front`'s floor; watch the corners of the first base tile through the floor layers (Z 6-12) for that.


The small parts first, so any fit problem shows up before a 39-hour print. Everything runs back to back on the one bed, so a failure anywhere delays everything behind it.

| Step | Print | Time | Why here |
|---|---|---|---|
| 1 | `fit_coupon`, then fix any tolerance in the SCAD and re-export | 1 h 34 m | Cheapest way to find a fit problem |
| 2 | `pedestal`, `window_frame`, `hatch_cover` | about 5 h 15 m | Small, critical, and quick to reprint |
| 3 | `base_front` | **38 h 47 m** | The longest print and the one that gates assembly. Start it as soon as the coupon checks out, ideally on a weekend, and watch the first layers |
| 4 | `sled`, caps, `ir_holder`, `cord_clamp` | about 3 h | Small fillers; the bed is free between the big prints |
| 5 | `base_rear` | 17 h 8 m | |
| 6 | `lid_front`, `lid_rear` | about 17 h | The lid is only needed at closing time, so it goes last |
| 7 | `power_shelf` | 2 h 28 m | After BRINGUP row 4 (see below); slot it in wherever that lands |

**`power_shelf` and `base_rear` are cleared to print (v0.19, 2026-10-25):** the brick is calipered (135 x 57 x 46 mm) and lies with its AC inlet toward the left wall, the cord's plug and turn beside it and the rear-wall opening behind that, so the cord no longer runs into the brick.

About 86 h of printing in all. Reusing the parts already printed for this year (`hatch_cover`, `cord_clamp`, `lid_rear`; owner, 2026-10-25) leaves about 74 h: `base_front`, `base_rear`, `lid_front` and the small inside parts, 3 days of machine time and 4-5 days of calendar time with plate changes and sleep, if nothing fails. A failed `base_front` costs the most: watch its first layers.

## After printing

- Cut out the two 4 mm ribs in the window opening at the sill and file it flush.
- Heat-set inserts: M5 (hatch studs), M3 (sled thumbscrew); 1/4-20 only if the pedestal is built with `ped_mount = "insert"`. Use the sizes that fit the coupon.
- Spray the inside of the case matte black (masking the window rebate and screw holes) so projector light doesn't glow through the vents at night.
