# Printing plan

One Prusa i3 MK3S (bed 250 x 210 x 210 mm). Two materials: **Inland ASA Army Green** for every part seen from outside (it holds its colour and strength in sun and rain), **Inland PETG Black** for every part inside (black also stops light glowing through) (including `power_shelf`). Times and weights are PrusaSlicer's estimates from the current (v0.11) STLs with the stock `Original Prusa i3 MK3S & MK3S+` printer profile and the `Prusament ASA` or `Prusament PETG` material profile, plus the ASA tile settings below on the base and lid tiles (re-sliced 2026-10-21 with `make slice`: PrusaSlicer 2.7.2, PrusaResearch bundle 1.11.12). `make slice` (or `scripts/slice.sh PART...`) re-slices with these settings and prints a table of time and weight; it finds PrusaSlicer on the PATH or in `/Applications` (`PRUSASLICER=/path/to/binary` otherwise). `make 3mf` (or `scripts/slice.sh --3mf PART...`) writes the same thing as PrusaSlicer projects, `3mf/PART.3mf`: open one and every setting below is already in place (the preset names show as modified where the tile overrides apply); each release also carries them. PrusaSlicer has no Inland profiles: start from `Generic ASA` and `Generic PETG` and set the temperatures printed on each spool. Real prints run a little longer.

## Settings

- Print profile **0.20mm SPEED @MK3** for everything except the four base and lid tiles, which print at **0.30mm DRAFT @MK3** (2026-10-21: about 28 h less for the Halloween deadline). The window ribs leave a gap of one layer (`layer_h` = 0.3 in the model). If you print `base_front` at another layer height, set `layer_h` to match and re-export.
- **No supports** anywhere: every part is designed support-free.
- ASA on an open MK3S: it warps more than PETG and gives off styrene. Print in a ventilated room away from drafts (an enclosure, even a cardboard box over the printer, helps most on `base_front` and `base_rear`), keep the bed hot (Prusa's ASA profile uses 105 C first layer, 110 C after), and clean the sheet so the first layer holds.
- ASA base and lid tiles: change these settings from the stock profile. [`slicer/asa_tiles.ini`](../slicer/asa_tiles.ini) holds them (plus [`slicer/asa_base_front.ini`](../slicer/asa_base_front.ini) for the front tiles' brim): the 3MFs carry them; on the command line add `--load slicer/asa_tiles.ini` (then `--load slicer/asa_base_front.ini` for `base_front` and `lid_front`) after the profile options; in the GUI from an STL, type the values from the file into the Print Settings and Filament Settings tabs and save them as your own presets. They come from the first `base` print (2026-10-21), which split at a corner, lifted at the bottom edge, showed its infill through the walls and printed a wavy floor.
  - **Enclosure and fan**: cover the printer and turn the part fan down to 15% at most (off is fine on the walls). Raise the nozzle 5-10 C over the spool's figure. Corners split when layers cool unevenly ([layer separation](https://help.prusa3d.com/article/layer-separation-and-splitting-fdm_1806), [ASA](https://help.prusa3d.com/article/asa_1809)).
  - **Perimeters 7**: the 3 mm `wall` then prints solid instead of two perimeters over infill. It is stronger, sheds rain better and stops the crosshatch showing through ([layers and perimeters](https://help.prusa3d.com/article/layers-and-perimeters_1748)).
  - **Top solid layers 7** (or minimum top shell thickness 1.4 mm) and **infill 25%**: the 6 mm floor bridges between `foot_ribs`, and the stock top layers do not cover the sag ([poor bridging](https://help.prusa3d.com/article/poor-bridging_1802), [infill problems](https://help.prusa3d.com/article/problems-with-infill_1994)). [Ironing](https://help.prusa3d.com/article/ironing_177488) on top surfaces is optional.
  - **Brim** against warping ([warping](https://help.prusa3d.com/article/warping_2011)): 5 mm on `base_rear` and `lid_rear`. The front tiles leave little room on the 210 mm axis (`base_front` 207 mm, `lid_front` 204 mm), so [`slicer/asa_base_front.ini`](../slicer/asa_base_front.ini) gives both a 1.5 mm brim and no skirt. All four tiles also have mouse ears in the model (`ears`, v0.12), 2 layers thick and 18 mm across: the base tiles at both ends of every foot rib, since the base stands on ten 4 mm ribs, and the lid tiles at the roof corners, which lie on the bed. The ASA `hatch_cover` has them at its four corners too (3 layers at its 0.20 mm, since the thickness is 0.6 mm for the tiles' 0.30 mm layers). Peel or cut them off after printing; set `ears = false` and re-export to drop them.
  - **Floor holes closed from below** (`hole_skin`, v0.13): the drains, the speaker-wire chimney and the stake bores start one layer above the floor's underside, so the floor's first layer bridges solid between the foot ribs instead of hanging the hole rims in mid-air (PrusaSlicer's "Floating bridge anchors" warning). Punch the skin out after printing ([ASSEMBLY.md](ASSEMBLY.md) step 2). PrusaSlicer still warns about long bridging (the floor spans up to `max_bridge`, by design) and collapsing overhangs (the floor's open ends, at the outer wall and the seam face, span between rib ends) on both base tiles: dismiss these, and don't enable supports (they would fill the drain channels under the floor).
  - The Parts table's times for the four tiles include these overrides (re-sliced 2026-10-21; about 0.5 kg of ASA more than the stock profile), all at 0.30mm DRAFT.
- `fit_coupon` is ASA because most of what it tests (keyholes, inserts in the base, the pane slot) lands in ASA parts. PETG shrinks less, so a fit that is tight in ASA is a little looser in PETG.
- The front tiles lie flat as exported: `base_front` is 231 x 207 mm and `lid_front` 228 x 204 mm, wide side along the bed's 250 mm axis. 207 mm on the 210 mm axis leaves no room for a skirt: turn it off or keep it tight to the part.
- The STLs are already in print orientation (lid roof-down, hatch cover ribs-up, window frame flat, caps plate-down).

## Fit coupon

`fit_coupon` tests every fit the case depends on in a 1.5-hour print, so a wrong tolerance shows up before a 36-hour one. Print it in ASA, let it cool for an hour, then work through the table. Results go in [BRINGUP.md](BRINGUP.md) row 1 and the `coupon` and `inserts` entries of [measurements.yaml](measurements.yaml).

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
| `fit_coupon` | 1 | 1 h 32 m | ASA 16 g | **Print first.** Test inserts, pilots, the keyhole on an M5 bolt, the frame glazing in its slot, the ball head's hot-shoe adapter in its T-slot |
| `pedestal` | 1 | 1 h 36 m | PETG 27 g | Hot-shoe T-slot on top for the ball head's adapter. PETG shrinks less than the ASA coupon, so the slot may be a touch looser: check the adapter can't wobble once the ring is tight |
| `window_frame` | 1 | 1 h 18 m | PETG 20 g | |
| `hatch_cover` | 1 | 2 h 25 m | ASA 39 g | Mouse ears at the four corners. The one printed 2026-10-16 has none |
| `sled_pi3` / `pi4` / `pi5` / `zero2w` | 1 | 1 h 7 m to 1 h 28 m | PETG 18-20 g | The one for your Pi. Pi 3/4 (1 h 28 m, 20 g) carry the upright fan plate; it prints standing, the diamond intake needs no supports |
| `vent_cap` | 1 | 12 m | PETG 2 g | Pi-zone louver |
| `intake_cap` | 1 | 14 m | PETG 3 g | Rear inlet bank, wall-mounted |
| `exhaust_cap` | 1 | 21 m | PETG 4 g | Front exhaust bank; the opening is about 74 x 58 mm, the biggest of the three caps |
| `ir_holder` | 0-1 | 10 m | PETG 1 g | Only for the relay + IR fallback |
| `power_shelf` | 1 | 2 h 28 m | PETG 47 g | Prints flat. Carries the brick (provisional envelope) |
| `cord_clamp` | 1 | 43 m | ASA 9 g | Both halves in one print, flat, wall-face down. Holds the AC cord at the rear-wall opening |
| `lid_rear` | 1 | 6 h 2 m | ASA 137 g | 0.30mm DRAFT, tile settings and mouse ears (7 h 37 m, 124 g at 0.20mm SPEED). The one printed 2026-10-16 used the stock 0.20mm SPEED profile (6 h 21 m, 95 g) |
| `lid_front` | 1 | 9 h 49 m | ASA 215 g | 0.30mm DRAFT, tile settings, mouse ears and the 1.5 mm brim (12 h 17 m, 198 g at 0.20mm SPEED) |
| `base_rear` | 1 | 16 h 9 m | ASA 337 g | 0.30mm DRAFT, tile settings and mouse ears (24 h 7 m, 328 g at 0.20mm SPEED) |
| `base_front` | 1 | **36 h 8 m** | ASA 787 g | 0.30mm DRAFT, tile settings, mouse ears and 4 mm window ribs (v0.14; 51 h 18 m, 744 g at 0.20mm SPEED, with `layer_h = 0.2`) |
| **Total** | | **about 80 h** | **ASA about 1.5 kg, PETG about 0.12 kg** | Two 1 kg ASA spools, but with the first `base_rear` (228 g) the ASA comes to about 1.7 kg, which leaves nothing for a failed `base_front` (787 g): buy a third. One black PETG spool. The tile settings (7 perimeters, 25% infill, 7 top layers) add about 0.5 kg over the stock profile. ASA is less dense than PETG, so the same part weighs about 15% less. |

## Order, on one printer

Printed so far: `fit_coupon`, `hatch_cover`, `cord_clamp`, `lid_rear` (2026-10-16) and `base_rear` (by 2026-10-21), all ASA with the stock profile. `cord_clamp` and `base_rear` came before BRINGUP row 4: if the real cord or brick changes `cord_d`, `brick` or the shelf layout, reprint them. That `base_rear` showed the faults the ASA overrides above fix (a split corner, a lifted bottom edge, infill showing through the walls, a wavy floor) and is to be reprinted with `slicer/asa_tiles.ini` (owner, 2026-10-21); keep the old one for test-fitting the clamp, sled and shelf.


The small parts first, so any fit problem shows up before a 36-hour print. Everything runs back to back on the one bed, so a failure anywhere delays everything behind it.

| Step | Print | Time | Why here |
|---|---|---|---|
| 1 | `fit_coupon`, then fix any tolerance in the SCAD and re-export | 1 h 32 m | Cheapest way to find a fit problem |
| 2 | `pedestal`, `window_frame` (PETG), `hatch_cover` (ASA) | about 5 h 15 m | Small, critical, and quick to reprint |
| 3 | `base_front` | **36 h 8 m** | The longest print and the one that gates assembly. Start it as soon as the coupon checks out, ideally on a weekend, and watch the first layers |
| 4 | `sled`, caps, `ir_holder` (if used), `cord_clamp` | about 3 h | Small fillers; the bed is free between the big prints |
| 5 | `base_rear` | 16 h 10 m | |
| 6 | `lid_front`, `lid_rear` | about 16 h | The lid is only needed at closing time, so it goes last |
| 7 | `power_shelf` | 2 h 28 m | After BRINGUP row 4 (see below); slot it in wherever that lands |

**Hold `power_shelf` and `base_rear` until BRINGUP row 4 has set `brick`, `cord_*` and the brick's placement; the provisional layout puts the brick across the cord opening and cannot be assembled.** The Parts table shows what the provisional model slices to, not what to print yet.

About 80 h of printing, about 70 h of it still to go (everything but the parts printed so far, with `base_rear` reprinted): 3 days of machine time and about a week of calendar time with plate changes and sleep, if nothing fails. A failed `base_front` costs the most: watch its first layers.

## After printing

- Cut out the two 4 mm ribs in the window opening at the sill and file it flush.
- Heat-set inserts: M5 (hatch studs), M3 (sled thumbscrew); 1/4-20 only if the pedestal is built with `ped_mount = "insert"`. Use the sizes that fit the coupon.
- Spray the inside of the case matte black (masking the window rebate and screw holes) so projector light doesn't glow through the vents at night.
