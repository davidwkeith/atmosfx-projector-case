# Single-supply power: design (revision 2)

Status: draft for owner review, 2026-10-06. Supersedes revision 1 (stock wall-wart on a receptacle, Parts Express brick as the fallback). Nothing here is built, measured or changed in the model yet. The plan at `docs/superpowers/plans/2026-10-06-single-supply-power.md` was written against revision 1 and must be rewritten after this spec is approved.

## Goal

Remove circuitry, and above all remove hand-wired mains. Today the case has two wall-warts, two stacked receptacles, an AC jumper, a live-only fuse, insulated crimps on receptacle tabs, two Wago rails and a spliced projector lead. The target has no hand-wired AC conductor anywhere: one listed desktop brick inside the case, fed by a standard cord that plugs into the brick's own inlet, and one DC Y-splitter.

Success: one supply, one Y-splitter, no AC wiring done by hand, no cut or spliced DC leads in the baseline build, no inter-rail ground path, and the relay/IR parts built only if bring-up proves CEC does not work.

## Target architecture

```
GFCI outlet -> AC cord (molded plug for the brick's inlet) -> case wall -> brick inlet
brick DC cord (uncut) -> 5.5x2.5 Y-splitter -+-> right-angle adapter -> projector
                                              +-> DigiAMP+ barrel jack -> Pi (5 V via header) + speakers
```

- **Supply:** the [Parts Express 24 V 5 A](https://parts-express.com/24-VDC-5A-Switching-Power-Supply-with-2.5-x-5.5mm-Plug-120-055) (120 W, 2.5 x 5.5 mm tip-positive; link unverified, the site returned 403 to the checker). It lies on the power shelf under the strap. It replaces the stock wall-wart, which cannot live in the case without a receptacle and is retired from the case.
- **Why 120 W:** the total load is the projector (label 63 W, manual says 50 W), plus the Pi and the amp at show volume, expected under about 80 W. That is a large margin, so the revision-1 load gate (at most 40 W against the 48 W stock supply) is no longer needed.
- **Both loads are 5.5 x 2.5 mm centre-positive** (projector per its label symbol and the owner; DigiAMP+ per its brief as quoted in WIRING.md). The Y-splitter replaces the cut-and-splice, both Wago rails, the minus join and the DC wire table.
- **AC entry:** a standard detachable cord whose molded connector fits the brick's inlet (inlet type to be read from the label or listing on arrival: IEC C8, C14, C6 or similar). The cord's connector end is inside the case, plugged into the brick; the other end plugs into the GFCI outlet. No stripping, crimping or spade terminals. This replaces the PG9 gland, the receptacle, its plate and the AC fuse.

## Open design problem: getting a molded connector through the wall

A round gland cannot pass a molded IEC plug. Recommendation: a keyhole-shaped opening in the rear wall (a large end for the connector, a narrow end for the cord) closed by a two-piece printed cord clamp that grips the cord jacket, seals with foam, and takes the pull so the strain never reaches the IEC joint. The shape is sized from the connector and cord you buy (`cord_d`, connector envelope), so it is a plan task that follows the arrival of the brick and cord. Drip loop outside, below the wall. Rejected: a panel-mount IEC inlet (its terminals need hand wiring, which defeats the goal), and an oversized gland (no sealing insert fits a cord that small).

## Stages

| Stage | Change | Condition |
|---|---|---|
| A | Drop the stock wall-wart from the case, both receptacles and plate, the AC jumper, the AC fuse, the Wago DC rails, the PG9 gland and the barrier's AC role; add the Parts Express brick, the AC cord with its clamp and the Y-splitter | Row 4b below passes |
| A-fallback | If the projector cannot take 24 V: a buck converter to 21 V on the projector leg only (the DigiAMP+ stays at 24 V, its maximum) | Row 4b fails |
| B | Drop relay module, GPIO 27 and the IR LED + BC337 + 1 kΩ + 47 Ω; keep `ir_holder` in the model | Bring-up row 9 shows CEC works |
| B-fallback | If CEC fails, keep the IR LED but drive it straight from GPIO 16 (about 13 mA through ~150 Ω, no transistor). The relay then needs the projector leg cut | CEC fails |
| C | TSOP38238 out of the permanent wiring (GPIO 23); learn the remote's codes on the bench | Always |

Unchanged: PIR on GPIO 17, the DigiAMP+ powering the Pi, HDMI CEC as the default power control. No Pi code changes: `cec` is already the default and `relay`/`relay-ir` remain selectable.

## The gate (new BRINGUP row 4b)

Before the brick is connected to anything in the case: run the projector from the Parts Express brick on the bench for 10 minutes at full brightness, metering the brick's output voltage first. Pass: runs normally, no smell, no unusual heat, no shutdown. Fail: stage A-fallback. Also, with the Pi and the amp running at show volume, listen for hum on the loudest cue and watch for picture flicker (shared-rail noise).

## Safety changes the owner must explicitly accept

CLAUDE.md lists "fused AC input" and "mains-rated cord grip with drip loop" among the things not to soften, and says mains is inside a printed box. This revision changes each:

1. **No AC fuse.** There is no hand-wired AC conductor left to protect; the cord and brick are listed, molded parts, the brick has its own internal protection, and the GFCI/branch breaker is upstream. Revision 1 kept a live-only inline fuse because it was wiring receptacle tabs by hand. Owner to confirm that dropping it is acceptable (an inline-fused cord can be bought if not).
2. **No mains-rated cord grip, but a strain-relief clamp.** The printed clamp must take a firm pull without loading the connector; test it in bring-up. Drip loop stays.
3. **Mains is still inside the printed box** (the cord's connector and the brick's inlet). The barrier, the quick-connects and the receptacle go; the GFCI, the drip loop, PETG/ASA only and the weatherproof connection box for any plug joint stay. "Flame-retardant V-0 PETG recommended for the power shelf" stays, since the brick now sits on it.
4. **The cord is not outdoor-rated.** Owner decision (2026-10-06): the existing cord is good enough for one month outside and can be replaced cheaply if damaged. Keep every plug joint off the ground and in the weatherproof box, inspect the cord daily, and run it along edges or under a cord cover as WIRING.md already says.

## Files this touches (to confirm in the plan)

`projector_pi_case.scad` (`power_shelf`: remove the plate, cutouts, strap-slot pairing around the wart; `warts()` becomes the brick envelope; the rear-wall gland becomes the keyhole + clamp; new `cord_clamp` part; asserts; `fit_coupon`'s receptacle tab can stay as a spare), `scripts/check_clash.sh` (brick envelope, clamp pair, `make parts`), `Makefile`, `scripts/render_wiring.py` (the HV drawing shrinks to cord, brick and Y-splitter; the DC rail and signal drawings as in revision 1), `docs/WIRING.md` (the HV section collapses; mains-safety wording reviewed with the owner), `docs/BOM.md` (new: brick, AC cord, Y-splitter, buck converter conditional; removed: second wall-wart, receptacles, quick-connects, fuse holder and fuses, Wago for AC, PG9; order the brick now, see Risks), `docs/BRINGUP.md`, `docs/ASSEMBLY.md`, `docs/measurements.xlsx`, `CLAUDE.md` (safety section and power bullets), `README.md`, `docs/DESIGN_LOG.md`, `docs/PRINTING.md`, `pi/README.md` (relay/IR fallback wording). I have not read the Pi code or the model's gland geometry beyond what the plan's reading covered.

## Assumptions to confirm

- The brick has a detachable AC inlet. A Parts Express "switching power supply" at 120 W is normally a desktop brick, but the page was not readable. If it is a plug-in wall-mount unit instead, it needs a receptacle again and revision 1's shelf stands.
- "The existing cord" means a standard detachable cord for that inlet that you already have or will get with the brick, not the 25 ft SJTW extension cord from the BOM. (That cord has a NEMA plug at both ends and would need an adapter to reach the brick.)
- Cord length outside the case is whatever reaches your outlet; no DC cord run is involved.

## Non-goals

No DC fuses beyond what the Y-splitter's leads need (see Risks). No case fans. No change to the aim, vent or lid geometry. No resize of the Pi zone or any tile in this pass; freed shelf space stays free.

## Risks

- **Lead time.** The brick is now the baseline, not a fallback, and Halloween is about three weeks away. Order it now, then read its label on arrival (UL/ETL mark, inlet type, tip polarity, input rating) and measure its body into `brick_*`.
- **Splitter lead rating.** A 5 A supply can overheat Y-splitter leads rated for about 3 A if a fault occurs downstream of the splitter. Buy a splitter rated for the supply's output, or add a small inline DC fuse on each leg.
- **Brick fit.** Its size is unknown. A desktop brick of this class may not fit the shelf's low-voltage side beside the sled interface; the first plan task on arrival is the clash check.
- **Projector tolerance of 24 V** is untested (row 4b); the buck converter is the answer if it fails.
- **Shared-rail noise** into the amp: class D amps reject supply ripple well, but listen on bring-up.
- **Strain relief** is a printed part holding a mains cord; prove it with a pull test before the lid goes on.
