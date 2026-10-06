# Printing plan

Two Prusa i3 MK3S (bed 250 x 210 x 210 mm), Prusament PETG (or ASA, which fades less in sun). Times and weights are PrusaSlicer's estimates from the current (v0.9 draft, 3.5 x 5 in 2 mm pane) STLs with the stock `Original Prusa i3 MK3S & MK3S+` printer profile. Real prints run a little longer.

## Settings

- Print profile **0.20mm SPEED @MK3** for everything. The window's snap-out ribs leave a gap of one layer (`layer_h` = 0.2 in the model). If you print the base at another layer height, set `layer_h` to match and re-export.
- **No supports** anywhere: every part is designed support-free.
- Print `power_shelf` in flame-retardant PETG (UL 94 V-0, e.g. Prusament PETG V0, which has a stock profile), and `base_rear` too if you can live with its colour: mains, the two receptacles and both wall-warts live on the shelf in the rear compartment.
- The front tiles lie flat as exported: `base_front` is 231 x 207 mm and `lid_front` 228 x 204 mm, wide side along the bed's 250 mm axis. 207 mm on the 210 mm axis leaves no room for a skirt: turn it off or keep it tight to the part.
- The STLs are already in print orientation (lid roof-down, hatch cover ribs-up, window frame flat, caps plate-down).

## Parts

| Part | Qty | Time (0.20 SPEED) | PETG | Notes |
|---|---|---|---|---|
| `fit_coupon` | 1 | 1 h 27 m | 17 g | **Print first.** Test inserts, pilots, the keyhole on an M4 bolt, the frame glazing in its slot, the receptacle in its cutout |
| `pedestal` | 1 | 1 h 42 m | 29 g | |
| `window_frame` | 1 | 1 h 19 m | 20 g | |
| `hatch_cover` | 1 | 2 h 33 m | 46 g | |
| `sled_pi3` / `pi4` / `pi5` / `zero2w` | 1 | 1 h 8 m to 1 h 20 m | 18-19 g | The one for your Pi |
| `vent_cap` | 3 | 13 m each | 2 g each | |
| `intake_cap` | 1 | 21 m | 4 g | |
| `ir_holder` | 0-1 | 15 m | 2 g | Only for the relay + IR fallback |
| `power_shelf` | 1 | 4 h 53 m | 66 g | Prints flat with the 90 mm receptacle plate standing up |
| `lid_rear` | 1 | 6 h 41 m | 112 g | |
| `lid_front` | 1 | 9 h 45 m | 169 g | |
| `base_rear` | 1 | 18 h 4 m | 259 g | 12 h 58 m with 0.30mm DRAFT |
| `base_front` | 1 | **35 h 5 m** | 529 g | 25 h 29 m with 0.30mm DRAFT (set `layer_h = 0.3`) |
| **Total** | | **about 84 h** | **about 1.3 kg** | Two 1 kg spools |

## Order, on two printers

The small parts first, so any fit problem shows up before a 35-hour print.

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
