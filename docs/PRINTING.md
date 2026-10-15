# Printing plan

One Prusa i3 MK3S (bed 250 x 210 x 210 mm). Two materials: **Inland ASA Army Green** for every part seen from outside (it holds its colour and strength in sun and rain), **Inland PETG Black** for every part inside (black also stops light glowing through) (including `power_shelf`). Times and weights are PrusaSlicer's estimates from the current (v0.10, 3.5 x 5 in 2 mm pane) STLs with the stock `Original Prusa i3 MK3S & MK3S+` printer profile and the `Prusament ASA` or `Prusament PETG` material profile. PrusaSlicer has no Inland profiles: start from `Generic ASA` and `Generic PETG` and set the temperatures printed on each spool. Real prints run a little longer.

## Settings

- Print profile **0.20mm SPEED @MK3** for everything. The window's snap-out ribs leave a gap of one layer (`layer_h` = 0.2 in the model). If you print the base at another layer height, set `layer_h` to match and re-export.
- **No supports** anywhere: every part is designed support-free.
- ASA on an open MK3S: it warps more than PETG and gives off styrene. Print in a ventilated room away from drafts (an enclosure, even a cardboard box over the printer, helps most on `base_front` and `base_rear`), keep the bed hot (Prusa's ASA profile uses 105 C first layer, 110 C after), and clean the sheet so the first layer holds.
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
| Hot-shoe T-slot | Slide the ball head's hot-shoe adapter in from the left edge and tighten its ring on the lips | Can't wobble or slide out once the ring is tight | Change `shoe_clr` (clearance per side), or measure the adapter and set `shoe_ch_w`, `shoe_open`, `shoe_lip_t`, `shoe_foot_l`, `shoe_neck_d`. If it holds, the pedestal could use it instead of its stud and insert (a design change) |
| Shrink | Measure the strip's length with calipers once it is fully cool | Enter it as `coupon.strip_len` in measurements.yaml; `uv run scripts/check_measurements.py` says the pane clearance after shrink is ok | TIGHT: scale `window_frame` and `base_front` by 118 / your length in the slicer, or add the shortfall to `pane_w` and `pane_h` |

After any change: `make parts`, then `scripts/check_clash.sh`. If you changed a size by more than 0.2 mm, reprint the coupon and test that feature again before the big prints. None of the coupon's features use `clearance`. It sets the pane rebate's width and height (`pane_w`/`pane_h` + 2 x `clearance`), which only the shrink row checks.

## Parts

| Part | Qty | Time (0.20 SPEED) | Material, weight | Notes |
|---|---|---|---|---|
| `fit_coupon` | 1 | 1 h 34 m | ASA 16 g | **Print first.** Test inserts, pilots, the keyhole on an M5 bolt, the frame glazing in its slot, the ball head's hot-shoe adapter in its T-slot |
| `pedestal` | 1 | 1 h 42 m | PETG 29 g | |
| `window_frame` | 1 | 1 h 19 m | PETG 20 g | |
| `hatch_cover` | 1 | 2 h 23 m | ASA 38 g | |
| `sled_pi3` / `pi4` / `pi5` / `zero2w` | 1 | 1 h 8 m to 1 h 20 m | PETG 18-19 g | The one for your Pi |
| `vent_cap` | 1 | 13 m | PETG 2 g | Pi-zone louver |
| `intake_cap` | 1 | 15 m | PETG 3 g | Rear inlet bank, wall-mounted |
| `exhaust_cap` | 1 | 22 m | PETG 4 g | Front exhaust bank; the opening is about 74 x 58 mm, the biggest of the three caps |
| `ir_holder` | 0-1 | 11 m | PETG 1 g | Only for the relay + IR fallback |
| `power_shelf` | 1 | 2 h 31 m | PETG 47 g | Prints flat. Carries the brick (provisional envelope) |
| `cord_clamp` | 1 | 44 m | ASA 9 g | Both halves in one print, flat, wall-face down. Holds the AC cord at the rear-wall opening |
| `lid_rear` | 1 | 6 h 21 m | ASA 95 g | |
| `lid_front` | 1 | 9 h 14 m | ASA 143 g | |
| `base_rear` | 1 | 18 h 32 m | ASA 228 g | 13 h 10 m with 0.30mm DRAFT (255 g) |
| `base_front` | 1 | **36 h 32 m** | ASA 471 g | 26 h 12 m with 0.30mm DRAFT (518 g; set `layer_h = 0.3`) |
| **Total** | | **about 83 h** | **ASA about 1.0 kg, PETG about 0.13 kg** | Two 1 kg ASA spools (one leaves nothing for a failed print) and one black PETG spool. ASA parts re-sliced 2026-10-15 with the `Prusament ASA` profile; ASA is less dense than PETG, so the same parts weigh about 15% less. |

## Order, on one printer

The small parts first, so any fit problem shows up before a 36-hour print. Everything runs back to back on the one bed, so a failure anywhere delays everything behind it.

| Step | Print | Time | Why here |
|---|---|---|---|
| 1 | `fit_coupon`, then fix any tolerance in the SCAD and re-export | 1 h 34 m | Cheapest way to find a fit problem |
| 2 | `pedestal`, `window_frame` (PETG), `hatch_cover` (ASA) | about 5 h 30 m | Small, critical, and quick to reprint |
| 3 | `base_front` | **36 h 30 m** | The longest print and the one that gates assembly. Start it as soon as the coupon checks out, ideally on a weekend, and watch the first layers |
| 4 | `sled`, caps, `ir_holder` (if used), `cord_clamp` | about 3 h | Small fillers; the bed is free between the big prints |
| 5 | `base_rear` | 18 h 32 m | |
| 6 | `lid_front`, `lid_rear` | about 15 h 30 m | The lid is only needed at closing time, so it goes last |
| 7 | `power_shelf` | 2 h 31 m | After BRINGUP row 4 (see below); slot it in wherever that lands |

**Hold `power_shelf` and `base_rear` until BRINGUP row 4 has set `brick`, `cord_*` and the brick's placement; the provisional layout puts the brick across the cord opening and cannot be assembled.** The Parts table shows what the provisional model slices to, not what to print yet.

About 83 h of printing, so 3.5 to 4 days of machine time and a week of calendar time with plate changes and sleep, if nothing fails. A failed `base_front` costs the most: watch its first layers, and consider the 0.30 DRAFT profile for it (about 10 h saved on `base_front`, 5 h on `base_rear`, which brings the total near 67 h).

## After printing

- Snap out the two thin ribs in the window opening.
- Heat-set inserts: 1/4-20 (pedestal), M5 (hatch studs), M3 (sled thumbscrew). Use the sizes that fit the coupon.
- Spray the inside of the case matte black (masking the window rebate and screw holes) so projector light doesn't glow through the vents at night.
