# Printing plan

Two Prusa i3 MK3S (bed 250 x 210 x 210 mm), Prusament PETG (or ASA, which fades less in sun). Times and weights are PrusaSlicer's estimates from the current (v0.10, 3.5 x 5 in 2 mm pane) STLs with the stock `Original Prusa i3 MK3S & MK3S+` printer profile. Real prints run a little longer.

## Settings

- Print profile **0.20mm SPEED @MK3** for everything. The window's snap-out ribs leave a gap of one layer (`layer_h` = 0.2 in the model). If you print the base at another layer height, set `layer_h` to match and re-export.
- **No supports** anywhere: every part is designed support-free.
- Print `power_shelf` in flame-retardant PETG (UL 94 V-0, e.g. Prusament PETG V0, which has a stock profile), and `base_rear` too if you can live with its colour: the mains brick and its inlet connector live on the shelf in the rear compartment.
- The front tiles lie flat as exported: `base_front` is 231 x 207 mm and `lid_front` 228 x 204 mm, wide side along the bed's 250 mm axis. 207 mm on the 210 mm axis leaves no room for a skirt: turn it off or keep it tight to the part.
- The STLs are already in print orientation (lid roof-down, hatch cover ribs-up, window frame flat, caps plate-down).

## Parts

| Part | Qty | Time (0.20 SPEED) | PETG | Notes |
|---|---|---|---|---|
| `fit_coupon` | 1 | 1 h 42 m | 20 g | **Print first.** Test inserts, pilots, the keyhole on an M4 bolt, the frame glazing in its slot, the ball head's hot-shoe adapter in its T-slot |
| `pedestal` | 1 | 1 h 42 m | 29 g | |
| `window_frame` | 1 | 1 h 19 m | 20 g | |
| `hatch_cover` | 1 | 2 h 33 m | 46 g | |
| `sled_pi3` / `pi4` / `pi5` / `zero2w` | 1 | 1 h 8 m to 1 h 20 m | 18-19 g | The one for your Pi |
| `vent_cap` | 1 | 13 m | 2 g | Pi-zone louver |
| `intake_cap` | 1 | 15 m | 3 g | Rear inlet bank, wall-mounted |
| `exhaust_cap` | 1 | 22 m | 4 g | Front exhaust bank; the opening is about 74 x 58 mm, the biggest of the three caps |
| `ir_holder` | 0-1 | 11 m | 1 g | Only for the relay + IR fallback |
| `power_shelf` | 1 | 2 h 31 m | 47 g | Prints flat. Carries the brick (provisional envelope) |
| `cord_clamp` | 1 | 44 m | 11 g | Both halves in one print, flat, wall-face down. Holds the AC cord at the rear-wall opening |
| `lid_rear` | 1 | 6 h 41 m | 112 g | |
| `lid_front` | 1 | 9 h 45 m | 169 g | |
| `base_rear` | 1 | 18 h 44 m | 270 g | The 0.30mm DRAFT figure (13 h 25 m, 305 g) predates the rear-wall opening and was not re-sliced |
| `base_front` | 1 | **37 h 4 m** | 559 g | 26 h 55 m with 0.30mm DRAFT (615 g; set `layer_h = 0.3`) |
| **Total** | | **about 84 h** | **about 1.3 kg** | Two 1 kg spools. Re-sliced for the UTEBIT 20 mm ball head (`ball_head_h` 52), which only changed the two base tiles; `power_shelf`, `cord_clamp` and `base_rear` re-sliced for the single-brick power change. |

## Order, on two printers

The small parts first, so any fit problem shows up before a 37-hour print.

| Day | Printer A | Printer B |
|---|---|---|
| 1 | `fit_coupon`, then fix any tolerance in the SCAD and re-export | `pedestal`, `window_frame`, `hatch_cover` |
| 1-2 | (after the coupon checks out) `base_front` | `sled`, caps, `power_shelf`, `lid_rear` |
| 2-3 | `base_front` continues | `base_rear`, then `lid_front` |

About 2 to 2.5 days of printing if nothing fails. A failed `base_front` costs the most: watch its first layers, and consider the 0.30 DRAFT profile for it.

## After printing

- Snap out the two thin ribs in the window opening.
- Heat-set inserts: 1/4-20 (pedestal), M4 (hatch studs), M3 (sled thumbscrew). Use the sizes that fit the coupon.
- Spray the inside of the case matte black (masking the window rebate and screw holes) so projector light doesn't glow through the vents at night.
