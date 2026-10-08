# Single-Supply Power Implementation Plan (revision 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two-wall-wart, two-rail, hand-wired-mains power system with one Parts Express 24 V 5 A desktop brick inside the case, fed by a standard cord that plugs into its inlet, and one DC Y-splitter to the projector and the DigiAMP+.

**Architecture:** The shelf loses its receptacle plate, barrier and notch and gains a brick envelope. The rear wall's PG9 hole becomes a rectangular opening closed by a two-piece printed cord clamp that grips the cord jacket (strain relief) and seals with foam. The brick's DC cord (uncut) goes into a 5.5 x 2.5 mm Y-splitter. The relay, IR LED and receiver drop out of the baseline wiring and survive only as CEC fallbacks. Docs, schematics and checks follow. The brick's real size and inlet are unknown until it arrives, so the shelf layout is provisional (Task 1) and re-fitted on arrival (Task 7); the wall opening and clamp are generous standard sizes so `base_rear` can print before the brick arrives.

**Tech Stack:** OpenSCAD (snapshot), bash + python3 (`scripts/check_clash.sh`), Python + Schemdraw via `uv` (`scripts/render_wiring.py`), openpyxl (`docs/measurements.xlsx`), Markdown + Mermaid. No Pi code changes: projector power already defaults to `cec`.

**Spec:** `docs/superpowers/specs/2026-10-06-single-supply-power-design.md` (revision 2, approved "LGTM" 2026-10-08; read it first).

## Global Constraints

- OpenSCAD binary on the owner Mac: `/Applications/OpenSCAD.app/Contents/MacOS/OpenSCAD`. Export `OPENSCAD=` that path for every `make` and `scripts/check_clash.sh` call. It aborts inside Claude Code's sandbox, so run those commands unsandboxed.
- `scripts/check_clash.sh` must say `ok` (or `ok ... (contact)`) on every line after each model task. Outer tile sizes must not change (bed-fit asserts). Do not resize `pi_zone_d`, `shelf_z` or any tile.
- Top-level OpenSCAD variables are evaluated in order; define a variable before anything top-level that uses it. New knobs are parameters under `/* [Section] */` headers, not magic numbers.
- Do not edit `docs/wiring-*.svg` by hand; edit `scripts/render_wiring.py` and run `uv run scripts/render_wiring.py`.
- **Safety wording changes are authorised.** The owner approved spec revision 2, which explicitly accepts: no AC fuse, a strain-relief clamp instead of a mains-rated cord grip, no barrier, and a cord that is not outdoor-rated (one month outside, replaced if damaged). Apply exactly those changes to `docs/WIRING.md` and `CLAUDE.md` "Safety" and nothing further. What stays: GFCI-fed outlet, drip loop, plug joints in the weatherproof box and off the ground, PETG/ASA only, V-0 PETG recommended for `power_shelf`, "mains is inside a printed box". Never call the case waterproof or certified.
- Never present a link as verified unless it opened. The Parts Express page returned HTTP 403 on 2026-10-06; mark its link "unverified".
- Provisional values are marked `PROVISIONAL` in comments and in the docs; do not present them as measured.
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Do not push.
- Facts used throughout: supply Parts Express 24 V 5 A, 120 W, 2.5 x 5.5 mm tip-positive (label, inlet type, input current, UL/ETL mark to be read on arrival); projector label DC 21 V 3 A (manual says "110 V, 50 W"); DigiAMP+ takes 12-24 V on its 5.5 x 2.5 mm centre-positive barrel jack and powers the Pi; shelf is `shelf_w` 214 x `shelf_d` 84, top at `shelf_zz`+3 = 75 above the ground, `lid_z0` 168; PIR slot at `pir_x` 55.
- Bring-up gate (row 4a): the projector runs 10 minutes at full brightness from the Parts Express brick on the bench. If it fails, a buck converter to 21 V goes on the projector leg only.

## Review Focus

1. **Brick fit.** Its size is unknown; a long brick can collide with the PIR slot, the cord opening or the sled stack. Pinned by Task 1's asserts and clash pairs and re-run in Task 7 with real numbers.
2. **Cord opening and clamp survive the geometry.** The opening must stay inside the left wall, clear the stake tube and lid screw block, and keep the clamp's four pilots on solid wall. Pinned by Task 2's asserts and `cord-clamp` pairs.
3. **Strain relief actually relieves strain.** A printed clamp holds a mains cord. Pinned by a pull-test step in Task 2 and BRINGUP row 17a.
4. **24 V into a 21 V projector.** Nothing may tell the owner to connect the brick to the projector before row 4a passes. Pinned by the grep in Task 5 step 5.
5. **Y-splitter polarity and lead rating.** A reversed splitter is a plug-in mistake, and a 5 A supply can overheat 3 A leads. WIRING.md must require a meter check of both legs and leads rated for 5 A or a fuse sized to the lead. Pinned in Task 4 step 2.
6. **DigiAMP+ plug through the shelf slot.** The barrel plug must pass the wire slot or the DigiAMP+ leg cannot reach the sled. Pinned by Task 1 step 5 and a measurement in Task 7.
7. **Shared-rail noise.** The amp shares a rail with the projector. BRINGUP row 4b includes listening for hum on the loudest cue.

## File Structure

- `projector_pi_case.scad`, `scripts/check_clash.sh`, `Makefile`: brick, opening, clamp (Tasks 1, 2, 7).
- `scripts/render_wiring.py`, `docs/wiring-*.svg`: three drawings (Task 3).
- `docs/WIRING.md`: the electrical truth (Task 4).
- `docs/BOM.md`, `docs/BRINGUP.md`, `docs/ASSEMBLY.md`, `docs/PRINTING.md`, `docs/measurements.xlsx` (Task 5).
- `CLAUDE.md`, `README.md`, `docs/DESIGN_LOG.md`, `pi/README.md` (Task 6).
- Task 7 is deferred until the brick and the cord arrive.

---

### Task 1: Shelf without the receptacle plate, with a provisional brick

**Files:**
- Modify: `projector_pi_case.scad` (params ~96-111; derived ~261-268; asserts ~277-284; `power_shelf()` ~434-462; `warts()` ~466-469; assembly ghost ~576; header changelog lines 1-8)
- Modify: `scripts/check_clash.sh:63`

**Interfaces:**
- Consumes: nothing.
- Produces: `brick` (`[L along X, W along Y, H]`, PROVISIONAL), `brick_x0`, `brick_y0`, `brick_gap`, `wire_slot`; module `brick_env()` (replaces `warts()`); `power_shelf()` without plate, barrier, notch. Removes `wart_*`, `wart2`, `rcpt_*`, `plate_*`, `prong_x`, `bar_x`, `barrier_h`, `rcpt_zc`, `warts()`.

- [ ] **Step 1: Green baseline**

```bash
export OPENSCAD=/Applications/OpenSCAD.app/Contents/MacOS/OpenSCAD
scripts/check_clash.sh
```
Expected: every line `ok`. If anything fails, stop and report.

- [ ] **Step 2: Red check**

```bash
grep -c "wart\|rcpt_\|barrier_h\|bar_x\|plate_x0" projector_pi_case.scad
```
Expected: a number well above 0 (about 40).

- [ ] **Step 3: Replace the supply parameters**

In `projector_pi_case.scad`:

1. Delete the whole block from the comment `// Stock supply (label, 2026-10-05): ...` through the line `barrier_h = 50; ...` (this removes `wart_l/w/t/prong`, `wart2`, `rcpt_cut/t/hole_sp/back`, `barrier_h`; keep `cord_x`, `cord_dz` lines above it). Put in its place, under the same `/* [Hardware] */`-style section the block was in:
```openscad
// Supply (spec 2026-10-06, rev 2): the Parts Express 24 V 5 A desktop brick lies on the shelf under a velcro strap, fed by a
// standard cord that plugs into its AC inlet; its DC cord goes uncut into a 5.5 x 2.5 mm Y-splitter. The stock 21 V wall-wart is
// retired from the case. Nothing about the brick is measured yet.
brick = [150, 60, 38];   // PROVISIONAL (a typical 120 W desktop brick): length along X, width along Y, height. Measure the real one (Task 7)
brick_gap = 5;           // room between the brick and the rear wall for the strap and the cord bend
wire_slot = [20, 14];    // shelf slot for the DigiAMP+ leg and the PIR wires: the DC barrel plug (about 11 x 16) must pass; check with the real splitter
```
2. Delete the `/* [Hardware] */` line `gland_d = 15.5; ...` (the PG9 hole goes in Task 2; Task 2 removes its remaining uses).
3. In the derived block, delete `plate_x0`, `plate_w`, `prong_x`, `wart_x0`, `bar_x`, `rcpt_zc`, `plate_y1`, `plate_y0` and add after `shelf_d`:
```openscad
brick_x0 = -shelf_w/2 + 3;                 // the brick's left end, against the left wall side of the shelf
brick_y0 = shelf_d - brick[1] - brick_gap; // its front edge: it sits toward the rear wall
```
4. Replace the asserts that mention `wart`, `rcpt_back`, `plate_x0`, `barrier_h` or `bar_x` (the `barrier_h`, `cord_x`, `rcpt_back`, `shelf_zz + rcpt_zc`, `bar_x + 60` lines) with:
```openscad
assert(brick_x0 + brick[0] + 3 <= pir_x - 6, "the brick runs into the PIR / wire slot: measure it, or shorten it");
assert(brick_y0 >= 0 && brick[1] + brick_gap <= shelf_d, "the brick is deeper than the shelf");
assert(shelf_zz + 3 + brick[2] + 2 <= lid_z0, "the brick hits the lid skirt: raise top_air (or lower shelf_z)");
```
Keep the `cord_dz` asserts that mention `gland_d` temporarily: change `gland_d` in them to `15.5` for now with the comment `// replaced in Task 2`. (Task 2 rewrites them.)

- [ ] **Step 4: Rewrite `power_shelf()` and the envelope**

Replace the module's header comment with:
```openscad
// Power shelf above the Pi. The desktop brick lies on it toward the rear wall, held by a velcro strap through the slots; its
// AC cord comes in through the rear wall, its DC cord goes to the Y-splitter. Mains is only in the brick and its inlet connector.
```
In the body: delete the `plate` cube, the gusset `for`, the `barrier` cube, the receptacle-cutout `for (z=rcpt_zc)` block, and the barrier notch line. Change the strap slots to
```openscad
    for (x=[brick_x0 + brick[0]*0.3, brick_x0 + brick[0]*0.7], y=[brick_y0 - 4, brick_y0 + brick[1] + 1])   // velcro strap slots round the brick
      translate([x-10, y, -1]) cube([20, 3, 5]);
```
Replace the zip-tie condition `if (x > bar+6)` with `if (x > brick_x0 + brick[0] + 6)`. Replace the PIR slot line with
```openscad
    translate([pir_x-6, shelf_d-wire_slot[1], -1]) cube([wire_slot[0], wire_slot[1]+1, 5]);   // PIR wires and the DigiAMP+ leg (with its plug) down to the Pi
```
Delete `py0`, `py1`, `bar`, `plate_h`, `gus` locals that are now unused. Replace `warts()` with:
```openscad
// The brick's envelope on the shelf (shelf coordinates): preview ghost and clash keep-out
module brick_env() {
  translate([brick_x0, brick_y0, 3]) cube(brick);
}
```
In the assembly ghost (line ~576) change `%translate([0, y_pi0+0.3, shelf_zz]) warts();` to `brick_env()`.

- [ ] **Step 5: Header changelog and clash script**

Read lines 1-8 and append in the same style: `// v0.10 - single supply: one desktop brick on the shelf (receptacle plate, barrier, wart2 and the PG9 gland replaced by a brick envelope, a rear-wall opening and a cord clamp).` (If the newest line is already v0.10, append `; one desktop brick replaces the wall-warts and the receptacle plate` instead.)

In `scripts/check_clash.sh:63` change `warts()` to `brick_env()`, the pair name `warts` to `brick`, and the trailing comment to `# the brick on the shelf vs case, lid roof and shelf`.

- [ ] **Step 6: Verify green**

```bash
grep -n "wart\|rcpt_\|barrier_h\|bar_x\|plate_x0\|warts()" projector_pi_case.scad scripts/check_clash.sh
```
Expected: no output. Then
```bash
export OPENSCAD=/Applications/OpenSCAD.app/Contents/MacOS/OpenSCAD
$OPENSCAD -o /tmp/shelf.stl -D 'part="power_shelf"' projector_pi_case.scad 2>&1 | tail -5
scripts/check_clash.sh
```
Expected: no assertion text; every line `ok`. If `brick_x0 + brick[0] + 3 <= pir_x - 6` fires, the provisional brick is too long for the shelf: that is real information, so report it with the numbers (shelf 214 wide, PIR slot starts at 49) instead of loosening the assert. If the widened wire slot hits a lid screw block or the PIR hole, shrink `wire_slot` and report.

- [ ] **Step 7: Look and commit**

```bash
$OPENSCAD -o /tmp/shelf.png --imgsize 1200,800 --camera 0,40,30,60,0,30,260 -D 'part="power_shelf"' projector_pi_case.scad
```
Read `/tmp/shelf.png`: a flat shelf with strap slots, tie slots and the wire slot, no plate or barrier.
```bash
git add projector_pi_case.scad scripts/check_clash.sh
git commit -m "Shelf: provisional desktop brick, no receptacle plate or barrier

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Rear-wall cord opening and cord clamp

**Files:**
- Modify: `projector_pi_case.scad` (params; asserts; `cuts()` gland line ~351-352; additive bosses in `base_all()` near the stake collars ~400; new `cord_clamp_half()`, `cord_clamp()`, `cord_clamp_placed()`; part dispatch ~725-737; `fit_coupon()` ~623-640)
- Modify: `Makefile`, `scripts/check_clash.sh`

**Interfaces:**
- Consumes: Task 1's removal of `gland_d` uses (the `15.5` stand-ins).
- Produces: `cord_open` (`[W, H]`), `cord_d`, `cord_x`, `cord_dz`, `clamp_t`, `clamp_flange`, `cord_boss`; modules `cord_clamp_half()`, `cord_clamp()` (both halves laid out for printing), `cord_clamp_placed()` (both halves on the wall, for the assembly and clash checks); `part = "cord_clamp"`.

- [ ] **Step 1: Parameters**

Replace `cord_x = -94; ...` and `cord_dz = 20; ...` with:
```openscad
cord_x = -75;       // centre of the AC cord opening in the rear wall: the opening, its bosses and the clamp all have to sit inside the left wall (asserted)
cord_dz = 30;       // opening centre above the shelf's top face: the clamp's lower screws clear the shelf, the clamp's top clears the lid skirt (asserted)
cord_open = [40, 30];   // rear-wall opening [X, Z]: passes a molded IEC plug (a C13 body is about 28 x 21 mm) with room; the clamp covers it
cord_d = 9;             // AC cord jacket diameter: PROVISIONAL, measure the cord you use
clamp_t = 6;            // clamp half thickness
clamp_flange = 10;      // each half overlaps the opening by this much all round
cord_boss = 6;          // pilot bosses inside the wall, at the clamp's four screws
```
(`gland_d` is already gone.) Then, among the derived values after `y_back` is defined, add
```openscad
clamp_w = cord_open[0] + 2*clamp_flange;
clamp_h = cord_open[1] + 2*clamp_flange;      // both halves together
cord_z = shelf_zz + 3 + cord_dz;              // opening centre, from the ground
cord_screws = [for (sx=[-1,1], sz=[-1,1]) [cord_x + sx*(cord_open[0]/2 + clamp_flange/2), cord_z + sz*(cord_open[1]/2 + clamp_flange/2)]];
```
and replace the Task 1 stand-in asserts with:
```openscad
assert(cord_x - clamp_w/2 >= -out_w/2, "move cord_x right: the cord clamp hangs off the rear wall's left edge");
assert(cord_x - cord_open[0]/2 - 4 >= -inner_w/2, "move cord_x right: the cord opening must sit inside the left wall");
assert(cord_dz - cord_open[1]/2 - clamp_flange >= 3, "raise cord_dz: the clamp's lower screws land on the shelf");
assert(cord_z + clamp_h/2 <= lid_z0 - 2, "lower cord_dz: the cord clamp runs into the lid skirt");
assert(cord_d >= 5 && cord_d <= cord_open[1] - 6, "cord_d: measure the cord; it must fit the opening and the clamp channel");
```

- [ ] **Step 2: The opening and the bosses**

In `cuts()`, replace the gland line (the comment `// single power-cord gland ...` and its `translate(...) cylinder(d=gland_d ...)`) with:
```openscad
  // AC cord opening (rear wall, above the shelf): passes a molded plug; the cord clamp covers it and grips the jacket
  translate([cord_x - cord_open[0]/2, y_back - 1, cord_z - cord_open[1]/2]) cube([cord_open[0], wall + 2, cord_open[1]]);
  // clamp screw pilots (M3 self-tapping) from the outside through the wall into the bosses
  for (p = cord_screws) translate([p[0], y_back + wall + 1, p[1]]) rotate([90, 0, 0]) cylinder(d=2.6, h=wall + cord_boss + 1);
```
In `base_all()`'s additive `union()`, next to the stake collars, add
```openscad
      for (p = cord_screws) translate([p[0], y_back - cord_boss, p[1]]) rotate([-90, 0, 0]) cylinder(d=8, h=cord_boss + 0.01);   // pilot bosses for the cord clamp
```
(Read `base_all()` first and put it beside similar bosses; the exact line numbers moved in Task 1.)

- [ ] **Step 3: The clamp**

Add near the other small parts (for example after `ir_holder`):
```openscad
// Cord clamp: two halves split on the cord's axis, M3 into the bosses inside the rear wall. The channel is cord_d - 0.6 so the
// halves bite the jacket (strain relief: the pull goes into the wall, not into the IEC joint). Lay a 2 mm foam gasket under it.
// Each half prints wall-face down on the bed; the channel runs through the thickness.
module cord_clamp_half() {
  h = clamp_h / 2;
  difference() {
    cube([clamp_w, h, clamp_t]);                                                       // x across, y = the half's height, z = thickness
    translate([clamp_w/2, 0, -1]) cylinder(d=cord_d - 0.6, h=clamp_t + 2);             // half-channel on the split edge (y = 0)
    for (sx=[-1,1]) translate([clamp_w/2 + sx*(cord_open[0]/2 + clamp_flange/2), h - clamp_flange/2, -1]) cylinder(d=3.4, h=clamp_t + 2);   // M3 clearance
  }
  for (sx=[-1,1]) translate([clamp_w/2 + sx*(cord_open[0]/2 + clamp_flange/2), h - clamp_flange/2, clamp_t - 0.01]) cylinder(d=6.5, h=0.01);   // marks the head seat
}
module cord_clamp() {   // both halves, side by side, as printed
  cord_clamp_half();
  translate([0, clamp_h/2 + 5, 0]) cord_clamp_half();
}
module cord_clamp_placed() {   // both halves on the rear wall's outer face (assembly, clash checks)
  x0 = cord_x - clamp_w/2;
  yo = y_back + wall;
  translate([x0, yo, cord_z]) rotate([-90, 0, 0]) cord_clamp_half();                  // lower half: split edge at the cord axis, hangs down
  translate([x0, yo, cord_z]) rotate([90, 0, 0]) mirror([0, 0, 1]) cord_clamp_half(); // upper half
}
```
(The zero-height head-seat cylinder is an optional visual mark; delete it if OpenSCAD warns.) In the assembly module add `cord_clamp_placed();` beside the other placed parts, and in the part dispatch add
```openscad
else if (part == "cord_clamp") cord_clamp();
```
In `Makefile`: add `$(OUT)/cord_clamp.stl` to the `parts:` list and
```make
$(OUT)/cord_clamp.stl: $(SCAD) | $(OUT)
	$(OPENSCAD) -o $@ -D 'part="cord_clamp"' $(SCAD)
```

- [ ] **Step 4: Fit coupon**

In `fit_coupon()`: remove the `[gland_d, "PG9", 3]` entry from `holes`, remove the receptacle tab cube (`translate([34, 30, 0]) cube([rcpt_cut[0]+14, 32, rcpt_t]);`), the `NEMA 5-15R snap-in cutout` cube and the `5-15R` text line. Add one hole entry for the clamp's pilot: `[2.6, "M3p", 8]` already exists, so nothing replaces them; the clamp is printed itself as the fit test.

- [ ] **Step 5: Clash pairs**

In `scripts/check_clash.sh` add, next to the other part/case pairs (use the existing `$LID` variable):
```bash
run cord-clamp     "intersection(){ cord_clamp_placed(); union(){ base_all(); $LID; } }"   # clamp against the rear wall and lid skirt: contact only
```

- [ ] **Step 6: Verify**

```bash
export OPENSCAD=/Applications/OpenSCAD.app/Contents/MacOS/OpenSCAD
scripts/check_clash.sh
make parts
$OPENSCAD -o /tmp/clamp.stl -D 'part="cord_clamp"' projector_pi_case.scad 2>&1 | tail -3
```
Expected: every line `ok` (the `cord-clamp` line `ok (contact)`); `make parts` includes `stl/cord_clamp.stl` with no error. If a stake tube, lid screw block or the left wall clashes with the opening or the bosses (the check names the pair), move `cord_x`/`cord_dz` within the asserts; do not shrink `clamp_flange` below 8.

- [ ] **Step 7: Look and pull-test**

```bash
$OPENSCAD -o /tmp/rear.png --imgsize 1200,800 --camera 0,100,100,70,0,200,500 -D 'part="assembly"' projector_pi_case.scad
```
Read `/tmp/rear.png`: the clamp sits over the rear-left opening, clear of the lid. The strain-relief pull test is a physical step that cannot run until the clamp is printed: it is BRINGUP row 17a (Task 5); do not claim the clamp relieves strain until that row passes.

- [ ] **Step 8: Commit**

```bash
git add projector_pi_case.scad scripts/check_clash.sh Makefile
git commit -m "Rear wall: cord opening and two-piece cord clamp replace the PG9 hole

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Wiring schematics

**Files:**
- Modify: `scripts/render_wiring.py` (docstring; `draw_hv`; `draw_lv_power`; `draw_lv_signals`)
- Regenerate: `docs/wiring-hv.svg`, `docs/wiring-lv-power.svg`, `docs/wiring-lv-signals.svg`

**Interfaces:**
- Consumes: nothing.
- Produces: three SVGs under the same names, embedded by Task 4.

- [ ] **Step 1: Baseline**

```bash
uv run scripts/render_wiring.py && git status --short docs/
```
Expected: three `docs/wiring-*.svg  N KiB` lines; no diff in `docs/` (committed SVGs match).

- [ ] **Step 2: Docstring**

Replace the three drawing descriptions and the ratings paragraph (lines ~12-18) with:
```python
    wiring-hv.svg          mains: outlet, AC cord (molded plugs, not cut), cord clamp, the 24 V desktop brick
    wiring-lv-power.svg    the one DC rail: Y-splitter, projector, DigiAMP+ (relay contact only as the CEC fallback)
    wiring-lv-signals.svg  the Pi header: every GPIO used; relay and IR LED are CEC fallbacks

The supply is the Parts Express 24 V 5 A desktop brick (label values to be read on arrival). Keep this file in step with
WIRING.md, pi/README.md ("GPIO pins and wiring") and BOM.md.
```

- [ ] **Step 3: `draw_hv`**

Keep the code from the start of the function through the "rear wall with the cord grip" block, but change two notes: `'Outdoor cord, SJTW 18 AWG or better, 3-wire.\nAny extension-cord joint in a weatherproof box, off the ground.\nDrip loop outside, below the gland.'` becomes `'Standard cord with the brick's molded plug, not cut. Not outdoor-rated:\nowner accepts one month outside; inspect daily, replace if damaged.\nEvery plug joint in a weatherproof box, off the ground. Drip loop.'`, and `'PG9 cord grip\n(rear-left corner,\nbeside the plate)'` becomes `'cord clamp\n(rear-left corner;\ngrips the jacket)'`. The wall-box height numbers can stay. Replace everything after that block (the fuse, receptacle, wall-wart, barrier and DC-cord code, through `d.save`) with:
```python
    # the brick: the cord's molded plug goes straight into its inlet; nothing hand-wired
    x_br = 11.0
    d.add(elm.Line().at((x_wall + 0.3, yL)).to((x_br, yL)).color(LIVE))
    d.add(elm.Line().at((x_wall + 0.3, yN)).to((x_br, yN)).color(NEUTRAL))
    d.add(elm.Line().at((x_wall + 0.3, yE)).to((x_br, yE)).color(EARTH).linestyle('--'))
    note(d, ((x_wall + x_br) / 2, yL + 0.3), 'L, N, E inside one molded cord', fontsize=FSS)
    H = 4.0
    br = d.add(ic([pin('L', 'L', 'L', pos=0.5 + (yL - yN) / (H - 1)), pin('N', 'L', 'N', pos=0.5),
                   pin('E', 'L', 'E', pos=0.5 + (yE - yN) / (H - 1)),
                   pin('+', 'R', 'pos', pos=0.7), pin('-', 'R', 'neg', pos=0.3)],
                  size=(4.4, H)).at((x_br, yN)).anchor('N')
               .label('Parts Express brick\n24 V 5 A, 120 W\nAC inlet (type: read the label)', fontsize=FSS))
    d.add(elm.Line().at(br.pos).right(1.6).color(POS))
    d.add(elm.Line().at(br.neg).right(1.6).color(NEG))
    note(d, (br.pos[0] + 1.7, br.pos[1]), '24 V +', halign='left', color=POS, fontsize=FS)
    note(d, (br.neg[0] + 1.7, br.neg[1]), '24 V -', halign='left', color=NEG, fontsize=FS)
    note(d, (br.pos[0] + 1.7, br.neg[1] - 1.4), 'DC cord, not cut:\nplugs into the Y-splitter\n(wiring-lv-power.svg)', halign='left')
    note(d, (x_wall + 0.4, -8.9),
         'No AC fuse and no hand-wired AC: the cord and the brick are listed, molded parts; the GFCI is upstream. '
         'Flame-retardant (V-0) PETG for the shelf.', halign='left')
    d.save(str(path))
```
(The wall dotted line and "OUTSIDE/INSIDE" notes in the kept block say "power shelf, AC side of the barrier": change that text to `INSIDE: power shelf`.)

- [ ] **Step 4: `draw_lv_power`**

Replace the function with the following (the loads, DigiAMP+, Pi and speaker code is the same as before; the supply is the 24 V brick and the projector leg carries a dashed buck-converter box):
```python
def draw_lv_power(path):
    d = drawing()

    w1 = d.add(ic([pin('+', 'R', 'pos', pos=0.72), pin('-', 'R', 'neg', pos=0.28)],
                  size=(3.0, 2.4)).at((0, 0.6)).anchor('pos')
               .label('Parts Express brick\n24 V 5 A', fontsize=FSS))
    note(d, (w1.center[0], w1.center[1] - 1.6), 'DC cord NOT cut. Tip is centre +:\nmeter both Y-splitter legs before connecting')
    yp, yn = w1.pos[1], w1.neg[1]
    x_s = 4.4            # + side of the Y-splitter
    x_n = x_s + 1.6      # - side
    x_load = x_n + 9.0
    d.add(elm.Line().at(w1.pos).to((x_s, yp)).color(POS))
    d.add(elm.Dot().at((x_s, yp)).color(POS))
    d.add(elm.Line().at(w1.neg).to((x_n, yn)).color(NEG))
    d.add(elm.Dot().at((x_n, yn)).color(NEG))
    note(d, (x_s - 0.2, yp + 0.9), '5.5 x 2.5 mm Y-splitter\n(leads rated 5 A, or fused to the lead)', halign='left')

    # projector leg: + through the optional relay contact and the optional buck converter, - straight through
    d.add(elm.Line().at((x_s, yp)).right(1.4).color(POS))
    d.add(elm.Switch().right().color(POS).linestyle('--')
          .label('K1 relay, ONLY if CEC fails\n(cut this leg; never in the -)', loc='top', fontsize=FSS - 1, ofst=0.15))
    d.add(elm.Line().right(0.8).color(POS))
    d.add(elm.Resistor().right().length(1.6).color(POS).linestyle('--')
          .label('buck to 21 V, ONLY if row 4a fails', loc='bottom', fontsize=FSS - 1, ofst=0.25))
    d.add(elm.Line().to((x_load, yp)).color(POS))
    proj = d.add(ic([pin('+', 'L', 'pos', pos=0.75), pin('-', 'L', 'neg', pos=0.25)], size=(3.2, 2.6))
                 .at((x_load, yp)).anchor('pos')
                 .label('Projector\nvia right-angle\n5.5 x 2.5 adapter', fontsize=FSS))
    d.add(elm.Dot().at((x_n, proj.neg[1])).color(NEG))
    d.add(elm.Line().at((x_n, proj.neg[1])).to(proj.neg).color(NEG))
    note(d, (proj.neg[0] - 0.3, proj.neg[1] - 0.3), '- straight through', halign='right', fontsize=FSS - 2)
```
followed by the unchanged DigiAMP+ leg code from the old function (from `# DigiAMP+ leg; ...` through `d.save`), changing only: the DigiAMP+ label to `'Raspberry Pi DigiAMP+\n5.5 x 2.5 mm barrel jack,\ncentre + (12-24 V; 24 V is its ceiling)'` and the bottom note to `'Do not connect the brick to the projector until BRINGUP row 4a passes (its label says 21 V).'`. The Resistor stands in for the buck-converter box (dashed); it is a drawing symbol, not a part.

- [ ] **Step 5: `draw_lv_signals`**

Apply the same four edits as in the previous plan revision: (1) relay label `'Relay module, ONLY if CEC fails\n5 V coil, opto in\nACTIVE-LOW'` and pin text `'+ from the Y-splitter leg'`; (2) replace the "IR LED driver" block with the direct-drive branch (GPIO16 pin 36 → R1 150 R → LED → GND, no transistor, labelled `ONLY if CEC fails`, note `'3.3 V - 1.3 V over 150 R is about 13 mA, under a pin's 16 mA'`):
```python
    yb = y(11) - 5.6
    y_ir = y(39) - 1.0               # under the header
    x_ir = -3.0                      # left of the pin labels
    wire([(XRW, y(36)), (6.3, y(36)), (6.3, y_ir), (x_ir, y_ir), (x_ir, yb)])
    note(d, (XRW + 0.1, y(36) + 0.2), 'to the IR LED (left)', halign='left', fontsize=FSS - 2, color=SIG)
    d.add(elm.Resistor().at((x_ir, yb)).left().length(1.6).color(SIG).label('R1 150 R', loc='top', fontsize=FSS - 1))
    d.add(elm.LED().left().length(1.6).color(POS)
          .label('D1  940 nm IR LED in ir_holder,\nONLY if CEC fails', loc='bottom', fontsize=FSS - 2, ofst=0.3))
    d.add(elm.Line().down(0.4).color(NEG))
    d.add(elm.Ground().label('GND', loc='bottom', fontsize=FSS - 1, ofst=0.1))
    note(d, (x_ir - 2.0, yb + 1.2), 'no transistor: about 13 mA, under a pin\'s 16 mA', halign='right')
```
(3) delete the TSOP38238 block and the unused `XR1`; (4) footer note: `'... Service pins: PIR 17, relay 27 and IR LED 16 (both CEC fallbacks). The TSOP38238 receiver (GPIO 23) is bench-only, to learn the remote.'`

- [ ] **Step 6: Render, look, commit**

```bash
uv run scripts/render_wiring.py
```
Expected: three lines, no traceback. Open each SVG in the Browser pane (`file://` under `docs/`) and check for overlapping text, wires through labels, and the Y-splitter node, buck and relay symbols. Adjust offsets and re-render until clean; the coordinates here are a starting point, not verified output.
```bash
git add scripts/render_wiring.py docs/wiring-*.svg
git commit -m "Wiring schematics: brick, Y-splitter, fallback-only relay, IR LED and buck

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: WIRING.md

**Files:**
- Modify: `docs/WIRING.md` (every section)

**Interfaces:**
- Consumes: Task 3's SVG names. Produces: section headings referenced by Task 5 (`### DC rail`, `## AC supply`).

- [ ] **Step 1: Overview and the AC section**

In the Overview paragraph: replace `[high voltage](#high-voltage-ac-side) (mains, left of the barrier: the receptacle plate with both wall-warts)` with `[AC supply](#ac-supply) (the cord, the clamp and the 24 V brick)`, and `(right of the barrier and down to the sled, drawn as the two DC rails and then the Pi's signals)` with `(on the shelf and down to the sled, drawn as the one DC rail and then the Pi's signals)`. Remove the sentence about the AC fuse value on the schematic.

Replace the whole `## High voltage: AC side` section (heading, image, mermaid and the seven numbered steps) with:

````
## AC supply

![AC supply schematic: GFCI outlet, standard AC cord through the cord clamp into the 24 V brick's inlet; the brick's DC cord out](wiring-hv.svg)

```mermaid
flowchart LR
  subgraph OUT["Outside the case"]
    direction LR
    GFCI["Outdoor GFCI outlet<br/>in-use cover; test its button"]
    BOX["Weatherproof connection box<br/>(any plug joint, off the ground)"]
    LOOP["Drip loop<br/>below the clamp"]
  end
  subgraph WALL["Rear wall, rear-left"]
    CLAMP["Cord clamp<br/>grips the jacket, foam gasket"]
  end
  subgraph SHELF["Power shelf"]
    BRICK["Parts Express brick<br/>24 V 5 A, 120 W<br/>cord plugs into its inlet"]
  end
  GFCI -- "standard cord, molded plugs, not cut" --> BOX --> LOOP --> CLAMP --> BRICK
  BRICK -- "24 V DC cord, not cut" --> DC["Y-splitter (below)"]
```

Nothing is hand-wired on the AC side: no stripped conductors, no spade terminals, no fuse holder. The cord's molded connector goes straight into the brick's inlet.

1. **Supply.** Plug into an outdoor GFCI outlet with an in-use weatherproof cover and test its button. Keep every plug-and-socket joint off the ground and out of puddles, in the weatherproof connection box.
2. **The cord.** A standard detachable cord with the right connector for the brick's inlet (read the inlet type off the brick's label: IEC C8, C14, C6 and so on). It is **not outdoor-rated**: the owner accepts that for the month outside and replaces it if the jacket is damaged. Inspect the whole length daily; unplug and replace at the first nick, crack or soft spot.
3. **Entry.** The connector passes through the opening in the rear wall into the case and plugs into the brick; then the two halves of the cord clamp close round the jacket over a 2 mm foam gasket and screw into the wall's bosses (4x M3). The clamp takes the pull. Leave a drip loop outside, below the clamp. Pull test before the lid goes on: a firm tug along and across the cord must not move the connector in the brick (BRINGUP row 17a).
4. **The brick** lies on the shelf under a velcro strap through the shelf slots, toward the rear wall. Its DC cord is not cut.
5. **No AC fuse.** There is no hand-wired AC conductor left to protect: the cord and brick are listed, molded parts, the brick has its own protection, and the GFCI/branch breaker is upstream. If you would rather have one, buy an inline-fused cord for the brick's inlet type.
6. **Earth.** If the brick has a 3-pin inlet, use the 3-wire cord. A 2-pin Class II inlet needs none.

Mains is still present inside the printed box (the cord's connector and the brick's inlet). Print the shelf in flame-retardant PETG as before.
````

- [ ] **Step 2: DC rail**

Replace the `### DC rails` content (image through the table and the lever-nut paragraph; keep `**Projector cables.**`) with the same section as in revision 1 of this plan, retitled `### DC rail`, with these differences: the supply is the **Parts Express brick (24 V)**, not the wall-wart; the mermaid and image alt text say so; the projector leg carries, in order, the optional relay contact and the optional buck converter; and the table is:

| Circuit | Wire | Notes |
|---|---|---|
| Brick DC cord into the Y-splitter | the cord's own | Plug-in; the cord is not cut. Tip must read centre + |
| Y-splitter leg 1 to the projector | the splitter's own | **Leads rated for the supply's 5 A, or a fuse in each leg sized to the lead's rating.** Ends in the right-angle 5.5 x 2.5 mm adapter on the projector's DC jack so the stock cable's bend runs along the rear face. **Do not connect it until row 4a passes.** If row 4a fails, a buck converter to 21 V goes between the splitter and the adapter on this leg only (at least 3.5 A out at 21 V, 30 V in or more; meter its output before it meets the projector) |
| Y-splitter leg 2 to the DigiAMP+ | the splitter's own | Into the DigiAMP+'s 5.5 x 2.5 mm centre-positive barrel jack. 24 V is its stated ceiling |
| Relay (CEC fallback only) | 18 AWG | Cut leg 1 a hand's width from the adapter and switch the **+** conductor only. Never switch the minus: the HDMI cable would carry the return. Use an **active-low** module: the Pi holds GPIO 27 high (relay open, projector off) from boot |
| DigiAMP+ to speakers | 16 AWG zip cord | Out through the floor chimney; red/striped to + on both ends |

Keep the polarity-check paragraph ("meter each Y-splitter leg's tip: centre positive") and the DigiAMP+/Pi powering sentence. Delete every mention of the second rail, Wago rails, the minus-rail join and the 21 V stock wall-wart. The paragraph "Pass low-voltage wires ... never across the barrier's AC side" becomes: `Pass low-voltage wires from the shelf to the Pi through the wire slot at the back of the shelf; the DigiAMP+ leg's barrel plug must fit it (BRINGUP row 4).`

- [ ] **Step 3: Signals, fuse section, power-up list**

`### Pi header signals`: apply the same replacements as in revision 1 of this plan (mermaid without the receiver, relay and IR LED marked "only if CEC fails", LED via 150 R; paragraph about no transistor and the bench-only TSOP38238).

Replace `## AC fuse and DC protection` with:

````
## Protection

**No AC fuse and no DC fuse in the baseline.** The AC side has no hand-wired conductor to protect (see "AC supply"). The brick limits its own output and carries its own short-circuit protection. The one place a fault could heat a wire is the Y-splitter's leads: a 5 A supply can overheat leads rated for less. Buy a splitter whose leads are rated for 5 A, or put a small inline fuse in each leg sized to that leg's lead rating. Use a UL/ETL-listed brick (read its label on arrival) and keep the total load under its 120 W.
````

`## Before first power-up`: items become: 1. With nothing plugged in, check the cord's continuity end to end and that the connector seats fully in the brick; 2. Brick plugged in, loads unplugged: meter each Y-splitter leg's tip (24 V, centre +); 3. Projector tested on the brick on the bench (BRINGUP row 4a) before leg 1 is connected; 4. Connect the DigiAMP+ (the Pi should boot), then the projector; 5. Close the lid, then test the GFCI outlet's trip button with the case running: everything must go dark.

- [ ] **Step 4: Verify with greps**

```bash
grep -n -i "second wall\|two wall\|both wall\|receptacle\|barrier\|quick-connect\|wago\|minus rail\|- rail\|jumper\|PG9\|facmogu\|fuse holder\|AC fuse" docs/WIRING.md
```
Expected: the only hits are the deliberate "No AC fuse" statements and the fused-cord suggestion.
```bash
grep -n "24 V" docs/WIRING.md
```
Expected: each hit either concerns the brick/DigiAMP+, or sits beside a statement that the projector is not connected until row 4a passes.

- [ ] **Step 5: Commit**

```bash
git add docs/WIRING.md
git commit -m "WIRING: one brick, molded cord, Y-splitter; no hand-wired AC

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: BOM, bring-up, assembly, printing, worksheet

**Files:**
- Modify: `docs/BOM.md`, `docs/BRINGUP.md`, `docs/ASSEMBLY.md`, `docs/PRINTING.md`, `docs/measurements.xlsx`

**Interfaces:**
- Consumes: WIRING.md headings. Produces: BRINGUP rows `4` (the brick on arrival), `4a` (projector at 24 V), `4b` (shared rail), `17a` (clamp pull test) referenced elsewhere.

- [ ] **Step 1: BOM**

In `docs/BOM.md`, in `## Power`:
- Replace the receptacle row, the "Second wall-wart" row, the quick-connect row, the lever-nut row, the fuse-holder row, and the PG9 row with removals (delete them) and add these rows:

`| Power brick: Parts Express 24 V 5 A, 5.5 x 2.5 mm tip-positive | 1 | The one supply (120 W). Desktop brick: read the label on arrival (UL/ETL mark, AC inlet type, input current, tip polarity) and measure its body into \`brick\`. **Not ordered. Order now** (about three weeks to Halloween). | [Parts Express 24 V 5 A, 120-055](https://parts-express.com/24-VDC-5A-Switching-Power-Supply-with-2.5-x-5.5mm-Plug-120-055) (link unverified: 403 to the checker on 2026-10-06) |`
`| AC cord for the brick's inlet, 6 ft or longer, 3-wire if the inlet is 3-pin | 1 | A standard detachable cord with the molded connector that fits the brick's inlet (the type is on its label). Not outdoor-rated; owner accepts one month outside and replaces it if the jacket is damaged. **Not ordered; match it to the brick's inlet.** | Any hardware store or Amazon; choose after reading the inlet type |`
`| 5.5 x 2.5 mm DC Y-splitter, 1 female to 2 male, leads rated 5 A | 1 | Feeds the projector (through the right-angle adapter) and the DigiAMP+. **Not ordered.** Find one with a stated 5 A lead rating, then open its page to confirm before adding the link; otherwise buy any splitter and fuse each leg to its lead's rating | Search "5.5 x 2.5 mm DC splitter 1 female 2 male"; add the verified link here |`
`| Buck converter to 21 V, at least 3.5 A out, 30 V in or more | 0-1 | Only if BRINGUP row 4a fails (the projector cannot take 24 V). Meter its output before it meets the projector | Not chosen; pick after the test |`
`| 2 mm foam gasket for the cord clamp | 1 | Same foam tape as the lid rim | See the foam tape row |`
`| M3 x 10 self-tapping | 4 | Cord clamp into its bosses | Same Mikniri assortment as the pedestal |`
- Keep: the cord/connection-box row (**the SJTW 25 ft cord is no longer needed**: change its note to `Not needed now; the brick's own cord goes to the outlet. Keep only if the outlet is far: an extension cord's joint goes in the weatherproof box`), the right-angle DC adapter row, the velcro strap row (`round the brick`), the weatherproof connection box row.
- Wire row: `18, 20 and 24 AWG` stays only if relay fallback wiring needs 18 AWG: change to `18 AWG (relay fallback only), 24 AWG`.
- Relay, IR LED and TSOP38238 rows as in revision 1 of this plan (Qty `0-1`, fallbacks, bench-only receiver; IR LED discrete link without the NPN).
- Add under "Order status": `**Single-supply change (2026-10-06, rev 2):** the ordered second SS-6B (both are now spare), PG9 grip, uxcell fuse holders, BOJACK fuses, BAOMAIN quick-connects, generic Wago connectors and the Facmogu 24 V 3 A are not needed in the baseline build. Keep the Facmogu for the row 4a bench test if the brick is late.`
- Remove the fuse bullet from "Still to buy" (line ~14) and the PG9/WAGO items; add `the brick, its cord, the Y-splitter`.
- Cost table: replace the power row with `Power parts (brick, cord, Y-splitter, wire, connection box)` at `45-70`; update the total range by the same delta (lower and upper).

- [ ] **Step 2: BRINGUP**

Replace row 4 with:

`| 4 | The brick, on arrival: read the label (UL/ETL mark, AC inlet type, tip polarity, input current), photograph it, and measure length, width and height with calipers into \`brick\`; measure the cord's jacket into \`cord_d\` and the connector's face into the opening check | Brick fits on the shelf (\`brick_x0 + brick[0] + 3 <= pir_x - 6\`), inlet type known, the connector passes the 40 x 30 mm opening, the DigiAMP+ leg's barrel plug passes the wire slot | Set \`brick\`, \`cord_d\`, \`cord_open\`, \`wire_slot\`; rerun \`scripts/check_clash.sh\`; reprint \`power_shelf\` (and \`base_rear\` if the opening changed) |`

Insert after it:

`| 4a | **Projector on 24 V.** On the bench, meter the brick's output first, then run the projector from it for 10 minutes at full brightness | Projector runs normally, no smell, no unusual heat, no shutdown, picture normal | Do not connect 24 V to it. Buck converter to 21 V on the projector leg only (WIRING.md) |`
`| 4b | **Shared rail.** With the brick feeding the projector, the Pi and the DigiAMP+ at the volume you will use, play the show and the loudest cue | No hum from the speakers, no picture flicker, brick stays only warm | Check the splitter and the leads; add the buck converter's filtering; if the brick is too hot in its spot, vent the shelf |`

(Use these exact labels `4a` and `4b` everywhere else; the earlier "load gate" is gone.)

Row 9 "If not": `Build the fallback: relay (cut the projector leg, + line only) and the IR LED on GPIO 16 through 150 R; learn the remote's code with the bench TSOP38238`. Row 22 "If not": append `; if the LED seems too weak with no transistor, add a BC337 and 1 k`. Row 1: remove `receptacle in the 5-15R cutout`. Add after row 17:

`| 17a | **Cord clamp pull test.** Cord through the opening, plugged into the brick, clamp closed on its foam gasket with 4x M3; tug firmly along the cord, then at 45 degrees and sideways, ten times each | The connector does not move in the brick's inlet; the cord does not slide in the clamp; no part of the clamp cracks | Reprint with a tighter channel (\`cord_d\` - 1) or ribs in the channel; add a zip tie round the cord just inside the clamp |`

- [ ] **Step 3: ASSEMBLY, PRINTING**

`docs/ASSEMBLY.md` step 9: replace with `9. **Power.** Lid off, projector aside if needed. Seat the shelf on its ledges and lay the brick on it toward the rear wall, under the velcro strap. Pass the AC cord's connector in through the opening in the rear wall, plug it fully into the brick's inlet, then close the cord clamp over its foam gasket (4x M3 into the wall bosses) and pull-test it (BRINGUP row 17a). Leave a drip loop outside below the clamp. Plug the brick's DC cord into the Y-splitter and meter both legs (centre +) before connecting anything. If the relay fallback is built, cut leg 1 and splice the relay as in WIRING.md.` Step 1: remove `snap a receptacle into the 5-15R cutout,`. Steps 8 and 10 as in revision 1 of this plan (adapter plus splitter leg 1; splitter leg 2 into the DigiAMP+; fallback parts only if built). Step 3: add `cord clamp: none (screws only)` is not needed; skip.

`docs/PRINTING.md` line 9: `mains, the two receptacles and both wall-warts live on the shelf` becomes `the mains brick and its inlet connector live on the shelf`. Add `cord_clamp` to the part table (print both halves flat, wall-face down) after slicing it with the PrusaSlicer recipe in CLAUDE.md; read the table's columns first and match them. Re-slice `power_shelf` and `base_rear`.

- [ ] **Step 4: measurements.xlsx**

Inspect, then edit without inserting rows (formulas reference their own row):
```bash
python3 - <<'E'
import openpyxl
ws = openpyxl.load_workbook('docs/measurements.xlsx')['Measurements']
for r in list(range(52, 60)) + [83]: print(r, [ws.cell(r, c).value for c in (1, 2, 3, 4)])
E
```
Then
```bash
python3 - <<'E'
import openpyxl
wb = openpyxl.load_workbook('docs/measurements.xlsx')
ws = wb['Measurements']
def row(code):
    for r in range(1, ws.max_row + 1):
        if ws.cell(r, 3).value == code: return r
rename = {'wart_l': ('Power brick', 'Brick length (X on the shelf)', 'brick[0]', 150),
          'wart_w': ('Power brick', 'Brick width (Y on the shelf)', 'brick[1]', 60),
          'wart_t': ('Power brick', 'Brick height (Z)', 'brick[2]', 38)}
for old, (grp, label, code, val) in rename.items():
    r = row(old)
    ws.cell(r, 1).value, ws.cell(r, 2).value, ws.cell(r, 3).value, ws.cell(r, 4).value = grp, label, code, val
    ws.cell(r, 7).value = None
    ws.cell(r, 11).value = 'PROVISIONAL (typical 120 W desktop brick). Measure the Parts Express brick with calipers on arrival.'
r = row('gland_d'); ws.cell(r, 2).value = 'Cord opening in the rear wall (X)'; ws.cell(r, 3).value = 'cord_open[0]'; ws.cell(r, 4).value = 40
ws.cell(r, 11).value = 'Must pass the cord\'s molded connector with room (a C13 body is about 28 x 21 mm). Measure yours.'
wb.save('docs/measurements.xlsx')
E
```
Also set the 'DC brick' group's `Output voltage` row notes to `Brick: 24 V (Parts Express). Projector label 21 V: BRINGUP row 4a`, `Output current` to `Brick: 5 A (120 W). Read the label`, and `Input current` to `Read the brick's label (no AC fuse is fitted)`; clear any wording about a second wall-wart in the 'Observations' sheet the same way as in revision 1 of this plan. Check `git diff --stat docs/measurements.xlsx` shows only that file and `python3 -c "import openpyxl; openpyxl.load_workbook('docs/measurements.xlsx')"` runs clean. If a column index differs from the inspection output, adjust before saving.

- [ ] **Step 5: Verify and commit**

```bash
grep -n -i "second wall\|two wall\|both wall\|upper receptacle\|receptacle\|wago\|piggyback\|PG9\|quick-connect\|load gate" docs/BOM.md docs/BRINGUP.md docs/ASSEMBLY.md docs/PRINTING.md
```
Expected: remaining hits are only the "not needed now" notes in the BOM. Also
```bash
grep -rn -i "connect.*24 V\|24 V.*projector" docs/WIRING.md docs/BRINGUP.md docs/BOM.md docs/ASSEMBLY.md
```
Expected: every hit says not to connect the projector to the brick until row 4a passes, or describes that test.
```bash
git add docs/BOM.md docs/BRINGUP.md docs/ASSEMBLY.md docs/PRINTING.md docs/measurements.xlsx
git commit -m "BOM, bring-up rows 4/4a/4b/17a, assembly, printing and worksheet for the brick

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Project-level docs

**Files:**
- Modify: `CLAUDE.md`, `README.md`, `docs/DESIGN_LOG.md`, `pi/README.md`

**Interfaces:** none.

- [ ] **Step 1: CLAUDE.md**

Read the truncated lines first (40, 66, 78, 79, the "Safety" section, "Conventions to keep", "Next steps"). Then:
- Module list (line 40): `power_shelf` becomes `(brick shelf: strap, tie and wire slots)`; replace `warts` with `brick_env`; add `cord_clamp` (two-piece clamp on the rear wall).
- `part` list: add `cord_clamp`.
- Rewrite the AC-cord bullet (line 66) as: `One AC cord in through a rectangular opening in the rear-left of the Pi zone, closed by a two-piece printed clamp (\`cord_clamp\`, M3 into bosses inside the wall, foam gasket) that grips the jacket. The cord is a standard detachable one whose molded connector plugs into the AC inlet of the 24 V 5 A Parts Express desktop brick (\`brick\`, lying on the shelf under a strap): nothing is hand-wired on the AC side. The brick's DC cord goes uncut into a 5.5 x 2.5 mm Y-splitter feeding the projector (through the right-angle adapter; do not connect it until BRINGUP row 4a shows the projector runs on 24 V, otherwise a buck converter to 21 V on that leg) and the DigiAMP+'s barrel jack, which powers the Pi. No AC fuse, no DC fuses (the splitter's leads are rated for 5 A or fused to the lead), no barrier.`
- Items 3 and 4 (Unverified): item 3 becomes `The brick (Parts Express 24 V 5 A) is not bought yet: its size (\`brick\`, PROVISIONAL), inlet type, UL/ETL mark and input current are unknown. The cord's jacket (\`cord_d\` 9) and connector size are guesses. The stock 21 V wall-wart is retired from the case.` Item 4: drop the wall-wart clause; add `whether the projector runs on 24 V (row 4a)`. Item 6: remove `and the receptacle snap-in cutout`. Item 7: add `the cord clamp`.
- Safety section: replace `Mains is inside a printed box in this design. Do not soften these: GFCI-fed, fused AC input, mains-rated cord grip with drip loop, AC and DC wiring on opposite sides of the barrier, fully insulated quick-connects on the receptacle tabs, PETG/ASA only.` with `Mains is still inside a printed box (the cord's connector and the brick's inlet), but nothing is hand-wired. Do not soften these: GFCI-fed outlet, drip loop below the clamp, a clamp that takes the pull (BRINGUP row 17a), every plug joint in a weatherproof box and off the ground, PETG/ASA only (V-0 PETG for the shelf). Owner-accepted (2026-10-08): no AC fuse, no barrier, a cord that is not outdoor-rated for one month outside, replaced if damaged.`
- "Projector power" bullet: add `The relay and IR LED are built only if row 9 shows the projector ignores CEC.` "Next steps" 2: replace the wall-wart measurement list with `the brick (size, inlet, label)`; 3: add rows 4a and 4b.

- [ ] **Step 2: README.md, DESIGN_LOG.md, pi/README.md**

`README.md` lines 16, 19, 54: read them and rewrite to one brick, a molded cord and a clamp, and `power_shelf`/`cord_clamp` rows. `docs/DESIGN_LOG.md`: append to the `v0.10 (unreleased)` row `; single supply: one 24 V desktop brick, a molded AC cord and a clamp (no hand-wired AC), a Y-splitter, relay and IR as CEC fallbacks`, and add a dated 2026-10-06/08 decision entry after "No DC fuses": the second rail existed only because the DigiAMP+'s 12-24 V range was never compared with 21 V; the manual's 50 W against the stock supply's 48 W made one stock supply a gamble; the owner then chose a single 120 W brick plus a plain cord over a receptacle and hand wiring; list the accepted safety changes (no AC fuse, no barrier, non-outdoor cord) and the risks (24 V into a 21 V projector, brick fit, strain relief, splitter lead rating); point to the spec. `pi/README.md`: line ~318 `the DC splice` becomes `the Y-splitter's second leg`; mark relay and IR LED rows fallback-only with the direct 150 R LED drive; TSOP38238 bench-only; line ~281 add `in the + line of the projector leg only`. No Pi code or test changes.

- [ ] **Step 3: Verify and commit**

```bash
grep -rn -i "second wall\|two wall\|both wall\|wart2\|upper receptacle\|two stacked\|two NEMA\|PG9\|gland_d\|wago\|barrier_h" CLAUDE.md README.md docs/*.md pi/README.md scripts projector_pi_case.scad Makefile | grep -v "docs/DESIGN_LOG.md"
(cd pi && npx vitest run)
```
Expected: no hits (BOM "not needed now" notes may name PG9/Wago deliberately; list them in the commit message if so); vitest green (outside the sandbox).
```bash
git add CLAUDE.md README.md docs/DESIGN_LOG.md pi/README.md
git commit -m "Docs: record the single-brick decision and the accepted safety changes

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7 (deferred): Fit the real brick and cord

**Run this only after the Parts Express brick and its cord have arrived.** It is the first thing to do on arrival; until then Tasks 1-6 stand, with `brick` PROVISIONAL.

**Files:**
- Modify: `projector_pi_case.scad` (`brick`, `brick_gap`, `wire_slot`, `cord_d`, `cord_open`, `cord_x`, `cord_dz`, shelf placement), `scripts/check_clash.sh`, `docs/BOM.md`, `docs/WIRING.md`, `docs/BRINGUP.md`, `docs/measurements.xlsx`

- [ ] **Step 1: Read and record.** Photograph the label. Record the UL/ETL mark, AC inlet type, tip polarity (meter it), input current and model. **If there is no UL/ETL mark, stop: do not install it; report to the owner.** Measure the brick (L x W x H), the cord jacket diameter and the connector's face (W x H) and length.
- [ ] **Step 2: Set the numbers.** Put them in `brick`, `cord_d`, `cord_open` (connector + 8 mm each way, minimum 40 x 30), then run `scripts/check_clash.sh`. If `brick_x0 + brick[0] + 3 <= pir_x - 6` fires, the brick is too long to lie along X as drawn: bring the numbers back for a placement change (stand it on a short edge, or rotate it 90 degrees and shorten `brick_gap`); do not stretch an assert.
- [ ] **Step 3: Orient the inlet.** Note which end or face of the brick carries the inlet and which way the cord's connector points. If the brick cannot be placed with its inlet within reach of the rear-wall opening, either buy a right-angle connector cord or move the brick; choose the cheaper and record why in `docs/DESIGN_LOG.md`.
- [ ] **Step 4: Add the connector keep-out.** Add a module `cord_plug_env()` (the connector's bounding box from the wall's inner face to the brick's inlet, at `cord_x`, `cord_z`) and a pair `run cord-plug "intersection(){ cord_plug_env(); union(){ base_all(); $LID; translate([0, y_pi0+0.3, shelf_zz]) power_shelf(); } }"` to `scripts/check_clash.sh`, with the connector measurements from Step 1. Expected: `ok` or `ok (contact)`.
- [ ] **Step 5: Wire slot.** Hold the Y-splitter's DigiAMP+ male plug against `wire_slot`; if it does not pass, enlarge `wire_slot` and recheck the PIR hole and lid screw block with `check_clash.sh`.
- [ ] **Step 6: Fuse/lead check.** Read the splitter's lead rating. If below 5 A, add the inline fuse per leg in `docs/WIRING.md` and the BOM, sized to the lead.
- [ ] **Step 7: Run BRINGUP rows 4, 4a, 4b.** If 4a fails, add the buck converter (BOM row with an opened link) and record the result in `docs/DESIGN_LOG.md`.
- [ ] **Step 8: Re-export and commit.** `make parts` with `OPENSCAD=` set; re-slice `power_shelf`, `base_rear` and `cord_clamp` for PRINTING.md; update the BOM and worksheet; commit with a message naming the measured values. Print `base_rear` only after this task: the rear wall's opening and bosses are the only brick-dependent features in the tile.

---

## Self-Review notes

- **Spec coverage:** brick, cord, clamp, Y-splitter (Tasks 1-5); stages A, A-fallback (WIRING.md buck, BOM, row 4a), B, B-fallback, C (Tasks 3-6; no Pi code change); the gate (rows 4a, 4b); safety changes 1-4 (Global Constraints, Task 4, Task 6); open entry problem (Task 2: the keyhole idea became a generous rectangular opening plus a split clamp, which lets `base_rear` print without knowing the connector); assumptions (inlet read on arrival, cord matched to inlet: Task 5 BOM and Task 7); risks (Review Focus 1-7; lead time in BOM "Order now"). Dropped from the spec's "keyhole" wording: a keyhole was replaced by a plain rectangular opening because the clamp already covers it.
- **Placeholder scan:** provisional dimensions are named as such. The Y-splitter and AC cord links are explicit "find, verify, then add" BOM steps. Schematic offsets are starting points with a viewing step.
- **Consistency:** `brick`, `brick_x0`, `brick_y0`, `brick_gap`, `wire_slot`, `cord_open`, `cord_d`, `cord_x`, `cord_dz`, `cord_z`, `clamp_*`, `cord_boss`, `cord_screws`, `cord_clamp_half/cord_clamp/cord_clamp_placed`, `brick_env`, BRINGUP labels 4, 4a, 4b, 17a: identical in every task.
- **Known-fragile spots (verify, do not guess):** Task 1's provisional brick versus the PIR slot (the assert may fire; that is information); Task 2's clamp orientation transforms (`rotate`/`mirror` in `cord_clamp_placed`: check in the render); the boss and opening positions against the left wall, stake tube and lid screw block; openpyxl column indices; the exact wording of the truncated lines in CLAUDE.md, README.md and pi/README.md (read them first).
