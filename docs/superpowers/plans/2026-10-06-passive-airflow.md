# Passive Airflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the two case fans, the DS18B20 sensors and their software, and give the projector's own fan a clean passive path in and out of the case.

**Architecture:** The OpenSCAD model gets an exhaust louver bank (right wall, front), an inlet bank (right wall, rear gap) and a lip baffle between them; one passive Pi-zone louver stays. Everything else that existed for active cooling goes. The Pi keeps only an SoC-temperature guard. Docs, BOM, wiring and checks follow.

**Tech Stack:** OpenSCAD (snapshot), bash + python3 (`scripts/check_clash.sh`), Node 24 + vitest (`pi/`), Python + Schemdraw via `uv` (`scripts/render_wiring.py`).

**Spec:** `docs/superpowers/specs/2026-10-06-passive-airflow-design.md` (read it first; it holds the measured projector facts and the reasoning).

## Global Constraints

- OpenSCAD binary on the owner Mac: `/Applications/OpenSCAD.app/Contents/MacOS/OpenSCAD`. Export `OPENSCAD=` that path for every `make` and `scripts/check_clash.sh` call. It aborts inside Claude Code's sandbox, so run those commands unsandboxed.
- `scripts/check_clash.sh` must say `ok` (or `ok ... (contact)`) on every line after each model task. The base tiles must still pass the bed-fit asserts (outer size must not change).
- Top-level OpenSCAD variables are evaluated in order; define a variable before anything top-level that uses it (functions may use later ones).
- New knobs are parameters under `/* [Section] */` headers; derived values go under `/* [Hidden] */`. No magic numbers.
- Pi tests: `cd pi && npx vitest run`, outside Claude Code's sandbox (they bind 127.0.0.1 and a Unix socket).
- Do not edit `docs/wiring-*.svg` by hand; edit `scripts/render_wiring.py` and regenerate.
- Mains-safety wording in `docs/WIRING.md` and `CLAUDE.md` ("Safety") stays as is. Never call the case waterproof.
- Do not commit unless a task's commit step says so. Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Measured facts (photos, 2026-10-06, about +/-2 mm): exhaust grille 10-42 mm behind the front face, full height; rear intake 40 x 40, 15 from the right edge, 15 below the top; DC jack centre 15 from the right edge, 13 below the top; I/O strip on the right face top 18 mm, 41-118 mm behind the front, HDMI at 56 mm; IR receiver on the front face near X +35, Z 50; the second rear grille is a speaker.

## File Structure

- `projector_pi_case.scad`: all geometry (Tasks 1-3).
- `scripts/check_clash.sh`: interference pairs (Tasks 1-3).
- `Makefile`: part list (Task 1).
- `pi/src/thermal.js`: shrinks to `parseMilli`, `OverTempGuard`, new `SocWatch` (Task 4).
- `pi/src/main.js`, `pi/src/config.js`, `pi/public/{index.html,app.js}`, `pi/system/{setup.sh,videofx.default,99-videofx.rules}`, `pi/test/*`, `pi/README.md`, `pi/package.json` description (Tasks 4-5).
- `scripts/render_wiring.py`, `docs/WIRING.md`, `docs/BOM.md`, `docs/ASSEMBLY.md`, `docs/BRINGUP.md`, `docs/PRINTING.md`, `docs/DESIGN_LOG.md`, `CLAUDE.md`, `README.md` (Task 6).

---

### Task 1: Airflow parameters, exhaust/inlet banks, baffle; remove fan seats, old vents, floor intake

**Files:**
- Modify: `projector_pi_case.scad` (parameters ~154-155, 202-213; `cuts()` ~304-320; `base_all()` ~362-364, 378; `power_shelf()` ~430; `assembly()` ~543-547; caps ~568-571; `fan_body` ~598; part dispatch ~675-676; line 17 part list)
- Modify: `scripts/check_clash.sh` (lines 62-65)
- Modify: `Makefile` (lines 10, 35-38)

**Interfaces:**
- Produces (used by Tasks 2-3): `y_pf` (projector front face Y), `exh_open` ([Z, Y] wall opening), `exh_c` ([y, z] centre), `in_open`, `in_c`, `air_n(h, pitch)`, `exhaust_cap_placed()`, `intake_cap_placed()`, `vents` (single Pi entry), modules `baffle()`. Part names `exhaust_cap`, `intake_cap`, `vent_cap`.
- Removes: `fan`, `pi_fan_dz`, `fans`, `fan_z`, `pi_fan_z`, `fan_body`, `intake_c`, `intake_open`, floor intake slots/bosses/pilots, the shelf vent slots, the fan bosses and pilots.

- [ ] **Step 1: Establish a green baseline**

Run (unsandboxed):
```bash
export OPENSCAD=/Applications/OpenSCAD.app/Contents/MacOS/OpenSCAD
scripts/check_clash.sh
```
Expected: every line `ok`. If anything fails before you start, stop and report it; do not proceed on a red baseline.

- [ ] **Step 2: Add the airflow parameters**

In `projector_pi_case.scad`, replace the two fan lines in `/* [Hardware] */`:
```openscad
fan = 40;           // 40 x 40 x 10 mm 24 V 4-pin PWM fans on the second wall-wart's 24 V rail (Pi-controlled; 12 V parts would burn)
pi_fan_dz = 28;     // Pi-zone exhaust fan centre above the shelf's top face
```
with nothing (delete both), and add a new section after `/* [Insect screen] */`'s two lines:
```openscad
/* [Airflow (projector's own fan; photo-measured, confirm with calipers)] */
exh_y = [0, 42];        // exhaust grille span behind the projector's front face, right side (slots measured 10-42; the owner says the first 40)
in_size = 40;           // rear intake patch, square
in_right = 15;          // intake patch inset from the projector's right edge
in_top = 15;            // intake patch inset from the projector's top
dc_jack = [15, 13];     // DC barrel centre: inset from the right edge, below the top
side_port_h = 18;       // I/O strip height on the right face, from the top
hdmi_y = 56;            // HDMI centre behind the front face (right face)
side_port_depth = 15;   // right-angle HDMI plug standing out of the right face
side_cable_d = 8;       // the cable run behind the plug, standing out of the right face
air_margin = 8;         // opening grows past the patch this much each way along Y (pan sweep)
air_margin_z = 4;       // and along Z (tilt sweep)
lv_pitch = 8;           // louver slat pitch
baffle_d = 10;          // lip baffle depth from the right wall (aim sweep checks it)
baffle_t = 4;
baffle_gap = side_port_h + 4;   // baffle top stops this far below the projector's top, under the HDMI plug
ir_x = 35;              // IR receiver on the projector's front face, right of centre (above the logo)
ir_z = 50;              // and its height above the projector underside
ir_holder_h = 10;       // ir_holder body height off the front face
```

- [ ] **Step 3: Replace the derived fan/vent/intake values**

In `/* [Hidden] */` delete `fan_z`, `pi_fan_z`, `fans`, `intake_c`, `intake_open`, and replace the `vents` line, then add the airflow derivations just before `pir_zz`:
```openscad
vents = [[1, pi_cy, shelf_zz+26]];         // the one passive Pi-zone louver bank [side, y, centre z] (right wall, over the low-voltage side)
vent_open = [26, 42];                      // louver bank opening a wall cap covers (Z, Y); tabs go top/bottom (clear driver access)
y_pf = y0 + front_gap;                     // projector front face
exh_open = [proj_h + 2*air_margin_z, exh_y[1] - exh_y[0] + 2*air_margin];   // exhaust wall opening [Z, Y]
exh_c = [y_pf + (exh_y[0] + exh_y[1])/2, z_pj + proj_h/2];
in_open = [in_size + 2*air_margin_z, rear_gap + 2];                         // inlet wall opening [Z, Y]
in_c = [y_div - in_open[1]/2 - 1, z_pj + proj_h - in_top - in_size/2];
function air_n(h, pitch) = ceil((h - 7)/pitch) + 1;   // slats needed to span an opening of height h
assert(exh_open[1] >= exh_y[1] - exh_y[0] + 2*air_margin - 0.01 && exh_open[0] >= proj_h + 2*air_margin_z - 0.01, "exhaust opening does not cover the exhaust grille plus its sweep margin");
assert(in_open[0] >= in_size + 2*air_margin_z - 0.01 && in_c[1] + in_open[0]/2 <= z_pj + proj_h + air_margin_z + 0.01, "inlet opening does not span the intake patch, or rises past the projector's top");
assert(in_c[0] + in_open[1]/2 <= y_div, "inlet opening runs into the divider");
assert(in_c[0] - in_open[1]/2 >= y_pf + proj_d - 6, "inlet opening starts too far in front of the projector's rear face");
```
Note: `pi_cy`, `y_div`, `rear_gap`, `y0`, `front_gap`, `z_pj`, `shelf_zz` are all defined earlier in `/* [Hidden] */`; place these lines after `pi_cy` (line ~197) so they are not `undef`. Put them after the `shelf_zz` line.

- [ ] **Step 4: Cut the new openings and delete the old cuts**

In `cuts()`:
- Delete the floor intake slots (`// intake: slots in the raised floor ...` plus its `for`).
- Delete `// fan exhaust louvers (+X)` and its `for (f=fans)` line.
- Delete the `intake_c` screen-cap pilot line (`for (sx=[-1,1]) translate([intake_c[0]+...`).
- Delete `// fan screw pilots` and its `for (f=fans ...)` block.
- Add (replacing the deleted fan louver line):
```openscad
  // exhaust bank (+X wall, front): the projector's own fan blows out through here
  translate([out_w/2-wall/2, exh_c[0], exh_c[1]-(air_n(exh_open[0], lv_pitch)-1)*lv_pitch/2]) louvers(exh_open[1], air_n(exh_open[0], lv_pitch), lv_pitch, 1);
  // inlet bank (+X wall, rear gap): air reaches the projector's rear intake
  translate([out_w/2-wall/2, in_c[0], in_c[1]-(air_n(in_open[0], lv_pitch)-1)*lv_pitch/2]) louvers(in_open[1], air_n(in_open[0], lv_pitch), lv_pitch, 1);
  // screen-cap pilots for both banks (M2 self-tap)
  for (c=[[exh_c[0], exh_c[1], exh_open], [in_c[0], in_c[1], in_open]], sy=[-1,1])
    translate([inner_w/2+2, c[0], c[1]+sy*cap_tab(c[2])]) rotate([0, -90, 0]) cylinder(d=1.8, h=cap_h+2);
```
(The passive Pi louver keeps its existing `for (v=vents)` louver and pilot lines.)

- [ ] **Step 5: Bosses, baffle and the base union**

In `base_all()`:
- Delete the `for (sx=[-1,1]) translate([intake_c[0]+...` boss line and the fan boss line (`for (f=fans, sy=[-16,16], sz=[-16,16]) translate([inner_w/2-4, ...`).
- Keep the `for (v=vents, sy=[-1,1])` boss line for the Pi vent, and add bosses for the two new banks beneath it:
```openscad
      for (c=[[exh_c[0], exh_c[1], exh_open], [in_c[0], in_c[1], in_open]], sy=[-1,1])   // screen-cap bosses, projector banks
        translate([inner_w/2+0.1, c[0], c[1]+sy*cap_tab(c[2])]) rotate([0, -90, 0]) cylinder(d=6, h=cap_h-cap_t+0.1);
      baffle();
```
Add the module near `hood()`:
```openscad
// Lip baffle on the right wall between the exhaust and the rear inlet: exhaust that stays in the case does not creep back to the
// intake along the side gap. Stops baffle_gap below the projector's top so the HDMI plug passes over it. A lip, not a seal.
module baffle() {
  by = exh_c[0] + exh_open[1]/2 + 1;
  translate([inner_w/2 - baffle_d, by, z_pj - air_margin_z]) cube([baffle_d + 0.1, baffle_t, proj_h + air_margin_z - baffle_gap]);
}
```
In `power_shelf()` delete the line `for (x=[40, 60, 80]) ... // vents: Pi/amp heat rises to the Pi-zone fan`.

- [ ] **Step 6: Caps, assembly and dispatch**

Replace `vent_cap_placed`, `intake_cap_placed` and add `exhaust_cap_placed`:
```openscad
module vent_cap_placed(v) {   // plate faces into the case, box rim on the wall
  translate([v[0]*(inner_w/2-cap_h), v[1], v[2]]) rotate([0, v[0]*90, 0]) screen_cap(vent_open);
}
module exhaust_cap_placed() { translate([inner_w/2-cap_h, exh_c[0], exh_c[1]]) rotate([0, 90, 0]) screen_cap(exh_open); }
module intake_cap_placed()  { translate([inner_w/2-cap_h, in_c[0], in_c[1]]) rotate([0, 90, 0]) screen_cap(in_open); }
```
In `assembly()`: replace `intake_cap_placed();` and `%for (f=fans) fan_body(f);` with `exhaust_cap_placed(); intake_cap_placed();` (keep `for (v=vents) vent_cap_placed(v);`). Delete the `fan_body` module. In the dispatch at the bottom replace the intake line:
```openscad
else if (part == "exhaust_cap") screen_cap(exh_open);
else if (part == "intake_cap") screen_cap(in_open);
```
Add `exhaust_cap` to the `part` Customizer list on line 17.

- [ ] **Step 7: Update the checks and the Makefile**

In `scripts/check_clash.sh` replace the `screen-caps`, `fans`, `warts` and `aim-sweep` first line:
```bash
run screen-caps   "intersection(){ base_all(); union(){ for (v=vents) vent_cap_placed(v); exhaust_cap_placed(); intake_cap_placed(); } }"
run warts          "intersection(){ translate([0, y_pi0+0.3, shelf_zz]) warts(); union(){ base_all(); \$LID; translate([0, y_pi0+0.3, shelf_zz]) power_shelf(); } }"
run aim-sweep      "intersection(){ union(){ base_all(); \$LID; translate([lens_x, y0, win_zc]) window_frame(); exhaust_cap_placed(); intake_cap_placed(); }
```
(`\$LID` is written `$LID` in the file; keep the file's existing quoting and only drop the `fans` lines and the `for (f=fans) fan_body(f)` terms, and add the two caps to the aim-sweep union.) Delete the `run fans ...` line. In `Makefile` add `$(OUT)/exhaust_cap.stl` to `parts` and its rule:
```make
$(OUT)/exhaust_cap.stl: $(SCAD) | $(OUT)
	$(OPENSCAD) -o $@ -D 'part="exhaust_cap"' $(SCAD)
```

- [ ] **Step 8: Render and check**

Run (unsandboxed):
```bash
export OPENSCAD=/Applications/OpenSCAD.app/Contents/MacOS/OpenSCAD
$OPENSCAD -o /tmp/base.stl -D 'part="base"' -D 'tile="front"' projector_pi_case.scad
$OPENSCAD -o /tmp/exh.stl -D 'part="exhaust_cap"' projector_pi_case.scad
scripts/check_clash.sh
```
Expected: renders with no `undef` or assert messages; all clash lines `ok`.

Likely failure and fix: an `aim-sweep` clash with the baffle or a cap means the swing is larger than assumed. Reduce `baffle_d` first (6), then lower the cap box (`cap_h` stays 3) is not an option; if the exhaust cap clashes, increase nothing: report it, do not change `side_air` (it is out of scope).

- [ ] **Step 9: Commit**

```bash
git add projector_pi_case.scad scripts/check_clash.sh Makefile
git commit -m "Passive airflow: exhaust and inlet banks, baffle; drop fans, floor intake and extra vents

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Port keep-outs (DC corner, right-face HDMI) and the IR holder

**Files:**
- Modify: `projector_pi_case.scad` (`projector_ports` ~655; new `projector_side_ports`, `ir_holder_placed`; `port_band` param line 37; assembly)
- Modify: `scripts/check_clash.sh` (aim-sweep, light-cone, hdmi lines)

**Interfaces:**
- Consumes: Task 1's `y_pf`, `side_port_*`, `hdmi_y`, `dc_jack`, `ir_*`.
- Produces: `projector_ports(pan, tilt)` (rear DC corner only), `projector_side_ports(pan, tilt)`, `ir_holder_placed(pan, tilt)`.

- [ ] **Step 1: Replace the rear keep-out and add the side one**

Delete the `port_band` parameter (line 37) and replace `projector_ports`:
```openscad
// Keep-out for the DC barrel plug in the rear face's top-right corner (a right-angle plug pointing back), in the same pose
module projector_ports(pan=0, tilt=0) {
  translate(pivot) rotate([0,0,pan]) rotate([-tilt,0,0]) translate(-pivot)
    translate([proj_w/2 - dc_jack[0] - 7, y_pf + proj_d, z_pj + proj_h - dc_jack[1] - 7]) cube([14, port_depth, 14]);
}
// Keep-out for the right-angle HDMI plug on the right face's I/O strip and its cable run back to the projector's rear plane
module projector_side_ports(pan=0, tilt=0) {
  translate(pivot) rotate([0,0,pan]) rotate([-tilt,0,0]) translate(-pivot) {
    translate([proj_w/2, y_pf + hdmi_y - 8, z_pj + proj_h - side_port_h]) cube([side_port_depth, 16, side_port_h]);
    translate([proj_w/2, y_pf + hdmi_y + 8, z_pj + proj_h - side_port_h]) cube([side_cable_d, proj_d - hdmi_y - 8 + port_depth, side_port_h]);
  }
}
// IR LED holder stuck to the projector's front face above the logo, in the same pose (pad on the face, body toward the window)
module ir_holder_placed(pan=0, tilt=0) {
  translate(pivot) rotate([0,0,pan]) rotate([-tilt,0,0]) translate(-pivot)
    translate([ir_x, y_pf, z_pj + ir_z]) rotate([90,0,0]) ir_holder();
}
```
Make `ir_holder` use the parameter: change its `cube([16, 16, 10])` to `cube([16, 16, ir_holder_h])`. Add `%ir_holder_placed(aim[0], aim[1]);` to `assembly()`.

- [ ] **Step 2: Add the new pairs to the checks**

In `scripts/check_clash.sh`, inside the `aim-sweep` pose loop, add the side ports and the holder next to the existing `projector_ports(...)` call (same pose expression), so the loop body becomes:
```bash
                        { projector(sg*a[0]*pan_max, sg*a[1]*(a[0] ? aim_combo : aim_max));
                          projector_ports(sg*a[0]*pan_max, sg*a[1]*(a[0] ? aim_combo : aim_max));
                          projector_side_ports(sg*a[0]*pan_max, sg*a[1]*(a[0] ? aim_combo : aim_max));
                          ir_holder_placed(sg*a[0]*pan_max, sg*a[1]*(a[0] ? aim_combo : aim_max)); } }"
```
Add one new check before `exit $fail`, pairing the holder with the cone in the same pose:
```bash
run ir-holder-cone "for (a=[[1,0],[0,1],[1,1],[1,-1]], sg=[-1,1]) intersection(){
                      ir_holder_placed(sg*a[0]*pan_max, sg*a[1]*(a[0] ? aim_combo : cone_tilt));
                      light_cone(sg*a[0]*pan_max, sg*a[1]*(a[0] ? aim_combo : cone_tilt)); }"
```

- [ ] **Step 3: Run the checks**

```bash
scripts/check_clash.sh
```
Expected: all `ok`. If `aim-sweep` clashes, the likely culprit is the IR holder against the window frame (the front tilt swings the holder's 10 mm plus about 17 mm of arc into the 30 mm front gap). Fix in this order: set `ir_holder_h = 7`, then re-run. If the HDMI side keep-out clashes with the baffle, raise `baffle_gap`; with an inlet cap, reduce `side_cable_d` to 6. Do not change `front_gap`, `rear_gap` or `side_air` (the base is within 3 mm of the bed).

- [ ] **Step 4: Commit**

```bash
git add projector_pi_case.scad scripts/check_clash.sh
git commit -m "Port keep-outs from the photos: DC corner, right-face HDMI, IR holder on the front face

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Export every part and re-verify

**Files:** none changed unless a fix is needed.

- [ ] **Step 1: Build all parts**

```bash
export OPENSCAD=/Applications/OpenSCAD.app/Contents/MacOS/OpenSCAD
make clean && make parts
ls stl | wc -l
```
Expected: no assert text in the output; 18 STLs (base/lid tiles 4, window_frame, pedestal, hatch_cover, power_shelf, sleds 4, ir_holder, vent_cap, intake_cap, exhaust_cap, fit_coupon).

- [ ] **Step 2: Look at the result**

```bash
scripts/render_previews.sh
```
(needs a GL context; if it fails headless, open `projector_pi_case.scad` in OpenSCAD and view the assembly from the right side.) Check by eye: three caps on the right wall (exhaust front, inlet rear, Pi vent high), the baffle between the first two, nothing left of the fans or the floor slots. No commit needed for `stl/`; commit updated `preview/*.png` only if the script regenerated them cleanly:
```bash
git add preview && git commit -m "Regenerate previews for the passive airflow model

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Pi software: remove fans, tach, PWM and DS18B20; keep an SoC guard

**Files:**
- Modify: `pi/src/thermal.js` (rewrite)
- Modify: `pi/src/main.js` (import line 46; heat block ~447-560; setting case ~662-667; status ~724; shutdown ~830-836; Matter temperature ~133)
- Modify: `pi/src/config.js` (PIN_ROLES ~80-91; checkPins ~103; `romId` ~108-112; cooling settings ~465-561; fixed pins ~657-661)
- Modify: `pi/test/thermal.test.js` (rewrite), `pi/test/config.test.js` (lines 21-22, 103-111), `pi/test/settings.test.js` (line 173)

**Interfaces:**
- Produces in `thermal.js`: `parseMilli(text): number|null` (unchanged), `OverTempGuard` (unchanged API: `critical(temp, limit, reason)`, `cleared(temp)`, `reset()`, `blocked`), new `class SocWatch` with `constructor({ cfg, guard })`, `update(socC: number|null): { temp: number|null, alarms: {level,text}[], locked: boolean }`, `reset()`.
- Settings kept: `tempWarnC` (45 -> default 70), `tempCritC` (55 -> 80), `tempHysteresisC` (5), `thermalEnabled` (bool, now "SoC temperature protection", default `true`). Settings removed: `fan1Curve`, `fan2Curve`, `fanMinDuty`, `fanCooldownSec`, `sensorProjector`, `sensorPi`, `fan1PwmPin`, `fan2PwmPin`, `fan1TachPin`, `fan2TachPin`, `w1Pin`.
- Status JSON `thermal` becomes `{ enabled, temp, alarms, locked, tripped }`.

- [ ] **Step 1: Write the failing tests for `SocWatch`**

Replace `pi/test/thermal.test.js` entirely with:
```js
import { describe, expect, it, vi } from "vitest";
import { OverTempGuard, SocWatch, parseMilli } from "../src/thermal.js";

const cfg = { warnC: 70, critC: 80, hysteresisC: 5 };

describe("SoC temperature text", () => {
  it("reads the millidegree zone file", () => {
    expect(parseMilli("48312\n")).toBe(48.312);
    expect(parseMilli("")).toBeNull();
    expect(parseMilli("abc")).toBeNull();
    expect(parseMilli(null)).toBeNull();
  });
});

describe("SocWatch", () => {
  it("is quiet below the warning temperature", () => {
    const w = new SocWatch({ cfg: () => cfg, guard: { critical: vi.fn(), cleared: vi.fn() } });
    expect(w.update(50)).toEqual({ temp: 50, alarms: [], locked: false });
  });
  it("warns above warnC", () => {
    const w = new SocWatch({ cfg: () => cfg, guard: { critical: vi.fn(), cleared: vi.fn() } });
    const s = w.update(72);
    expect(s.alarms).toHaveLength(1);
    expect(s.alarms[0].level).toBe("warn");
  });
  it("trips once at critC, stays locked until below critC minus hysteresis", () => {
    const guard = { critical: vi.fn(), cleared: vi.fn() };
    const w = new SocWatch({ cfg: () => cfg, guard });
    w.update(81);
    w.update(82);
    expect(guard.critical).toHaveBeenCalledTimes(1);
    expect(guard.critical).toHaveBeenCalledWith(81, 80, undefined);
    expect(w.update(77).locked).toBe(true); // 77 is not below 75
    expect(guard.cleared).not.toHaveBeenCalled();
    expect(w.update(74).locked).toBe(false);
    expect(guard.cleared).toHaveBeenCalledWith(74);
  });
  it("a missing reading neither trips nor clears", () => {
    const guard = { critical: vi.fn(), cleared: vi.fn() };
    const w = new SocWatch({ cfg: () => cfg, guard });
    expect(w.update(null)).toEqual({ temp: null, alarms: [], locked: false });
    w.update(85);
    expect(w.update(null).locked).toBe(true);
    expect(guard.cleared).not.toHaveBeenCalled();
  });
  it("reset forgets a trip", () => {
    const w = new SocWatch({ cfg: () => cfg, guard: { critical: vi.fn(), cleared: vi.fn() } });
    w.update(90);
    w.reset();
    expect(w.update(50).locked).toBe(false);
  });
});

describe("over-temperature shutdown and resume rule", () => {
  it("switches off, blocks switching on, and resumes only if it was on", () => {
    let on = true;
    const powerOff = vi.fn(() => (on = false));
    const powerOn = vi.fn(() => (on = true));
    const log = { error: vi.fn(), warn: vi.fn() };
    const g = new OverTempGuard({ powerOff, powerOn, isOn: () => on, log });
    expect(g.blocked).toBeNull();
    g.critical(81, 80);
    expect(powerOff).toHaveBeenCalledTimes(1);
    expect(g.blocked).toMatch(/over-temperature/);
    g.critical(82, 80); // already tripped: no second power-off
    expect(powerOff).toHaveBeenCalledTimes(1);
    g.cleared(74);
    expect(powerOn).toHaveBeenCalledTimes(1);
    expect(g.blocked).toBeNull();
  });
  it("does not switch on after clearing if it was off when it tripped", () => {
    const powerOn = vi.fn();
    const g = new OverTempGuard({ powerOff: vi.fn(), powerOn, isOn: () => false, log: { error: vi.fn(), warn: vi.fn() } });
    g.critical(81, 80);
    g.cleared(70);
    expect(powerOn).not.toHaveBeenCalled();
  });
  it("reset unblocks without switching on", () => {
    const powerOn = vi.fn();
    const g = new OverTempGuard({ powerOff: vi.fn(), powerOn, isOn: () => true, log: { error: vi.fn(), warn: vi.fn() } });
    g.critical(81, 80);
    g.reset();
    expect(g.blocked).toBeNull();
    expect(powerOn).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

```bash
cd pi && npx vitest run test/thermal.test.js
```
Expected: FAIL (`SocWatch` is not exported).

- [ ] **Step 3: Rewrite `pi/src/thermal.js`**

Keep only `parseMilli` (as it is, line 70) and `OverTempGuard` (as it is, lines ~191-241, including its doc comment), delete everything else (`PWM_PERIOD_NS`, `parseCurve`, `curveDuty`, `parseDs18b20`, `ThermalControl`, `SysfsPwm`, `Tach`, `tachArgs`, the imports of `EventEmitter` and `createInterface`), replace the file header and add `SocWatch`:
```js
// Heat protection: the Pi's own SoC temperature. The case has no fans; the projector's
// own fan moves the air, and the projector has its own thermal cutoff. This file reads
// the SoC zone and switches the projector off (OverTempGuard) if the Pi itself overheats.

export const parseMilli = (text) => (/^-?\d+$/.test((text ?? "").trim()) ? Number(text) / 1000 : null);

/**
 * SoC temperature watch; no I/O. update(socC) returns { temp, alarms, locked }.
 * Warn above warnC; at critC trip the guard once and stay locked until the
 * temperature is below critC - hysteresisC. A missing reading changes nothing.
 */
export class SocWatch {
  #cfg;
  #guard;
  #locked = false;

  /** @param {{ cfg: () => { warnC: number, critC: number, hysteresisC: number }, guard: { critical: Function, cleared: Function } }} o */
  constructor({ cfg, guard }) {
    this.#cfg = cfg;
    this.#guard = guard;
  }

  reset() {
    this.#locked = false;
  }

  update(socC) {
    const c = this.#cfg();
    const temp = socC ?? null;
    if (temp !== null) {
      if (!this.#locked && temp >= c.critC) {
        this.#locked = true;
        this.#guard.critical(temp, c.critC, undefined);
      } else if (this.#locked && temp < c.critC - c.hysteresisC) {
        this.#locked = false;
        this.#guard.cleared(temp);
      }
    }
    const alarms = [];
    if (this.#locked) alarms.push({ level: "critical", text: `Pi over ${c.critC} °C: playback stopped until it cools below ${c.critC - c.hysteresisC} °C` });
    else if (temp !== null && temp >= c.warnC) alarms.push({ level: "warn", text: `Pi: ${temp.toFixed(1)} °C (warning at ${c.warnC} °C)` });
    return { temp, alarms, locked: this.#locked };
  }
}
```
Then paste `OverTempGuard` unchanged below it.

- [ ] **Step 4: Run the thermal tests**

```bash
cd pi && npx vitest run test/thermal.test.js
```
Expected: PASS. (If the "trips once" case fails on the `critical` arguments, `SocWatch` must call `guard.critical(temp, c.critC, undefined)` exactly as written.)

- [ ] **Step 5: Slim `main.js`**

Change the import (line 46) to `import { OverTempGuard, SocWatch, parseMilli } from "./thermal.js";`. Replace the whole `// --- heat: fans, sensors, protection` block (from that comment through `startThermal();`) with:
```js
// --- heat: the Pi's own SoC temperature (the case has no fans)

const guard = new OverTempGuard({
  isOn: () => player.isOn,
  powerOff: () => requestPower("thermal", false),
  // Resume: under DMX, whatever DMX asks for; otherwise back on.
  powerOn: () => requestPower("thermal", dmx.inControl ? interpret(dmx.values ?? [0]).power : true),
});
const thermal = new SocWatch({
  cfg: () => ({ warnC: get("tempWarnC"), critC: get("tempCritC"), hysteresisC: get("tempHysteresisC") }),
  guard,
});
let thermalState = { temp: null, alarms: [], locked: false };
let thermalTimer = null;
let stopping = false;

async function thermalTick() {
  try {
    const socC = await readFile("/sys/class/thermal/thermal_zone0/temp", "utf8").then(parseMilli, () => null);
    if (stopping || !get("thermalEnabled")) return; // switched off while reading
    thermalState = thermal.update(socC);
    const value = socC === null ? null : Math.round(socC * 100);
    if (temperature.state.temperatureMeasurement.measuredValue !== value) {
      await temperature.set({ temperatureMeasurement: { measuredValue: value } });
    }
  } catch (err) {
    console.error(`Thermal: ${err.message}`);
  }
}

function startThermal() {
  if (thermalTimer) clearInterval(thermalTimer);
  thermalTimer = null;
  if (!get("thermalEnabled")) {
    // No protection: forget any trip (or it would block power-on for good).
    thermal.reset();
    guard.reset();
    thermalState = { temp: null, alarms: [], locked: false };
    return;
  }
  thermalTimer = setInterval(thermalTick, 5000);
  thermalTick();
}
startThermal();
```
Fix the header comment of `main.js` line 6 (`// 4 "temperature" (projector zone).` -> `// 4 "temperature" (the Pi's SoC)`). In the settings change handler replace the `case "thermalEnabled":` body with:
```js
    case "thermalEnabled":
      startThermal();
      return undefined;
```
In the status object replace the `thermal:` line with:
```js
      thermal: { enabled: get("thermalEnabled"), ...thermalState, tripped: guard.blocked },
```
In the shutdown tail delete `tach?.stop();` and replace the comment + `await fansFull();` with nothing (keep `await projector.shutdown(); relay.release();`). Remove now-unused imports (`access`, `readdir`, `writeFile` if nothing else in the file uses them: run `grep -n "readdir\|writeFile\|access" pi/src/main.js` and drop only the unused ones; `spawn` and `gpiodMajor` stay, the PIR uses them).

- [ ] **Step 6: Slim `config.js`**

- Delete from `PIN_ROLES`: `fan1PwmPin`, `fan2PwmPin`, `fan1TachPin`, `fan2TachPin`, `w1Pin`.
- In `checkPins` delete the `pwm-ir-tx` refusal line (GPIO12 is free now).
- Delete `romId`.
- Delete the setting entries `fan1Curve`, `fan2Curve`, `fanMinDuty`, `fanCooldownSec`, `sensorProjector`, `sensorPi`. Keep `thermalEnabled`, `tempWarnC`, `tempCritC`, `tempHysteresisC` and change them to:
```js
  {
    key: "thermalEnabled",
    env: "VIDEOFX_THERMAL",
    group: "Cooling",
    label: "Pi over-temperature protection",
    help: "The case has no fans: the projector's own fan moves the air. If the Pi's SoC reaches the critical temperature, playback stops and the projector switches off until it cools.",
    apply: "live",
    default: () => true,
    parse: bool,
  },
```
with `tempWarnC` label `Pi warning temperature (°C)` default 70 range `int(40, 90)`, `tempCritC` label `Pi critical temperature (°C)` default 80 range `int(50, 95)`, `tempHysteresisC` unchanged. Delete the five fixed pin entries (`fan1PwmPin` .. `w1Pin`). Remove the `parseCurve` import (line 15).

- [ ] **Step 7: Update the config/settings tests**

`pi/test/config.test.js`: replace line 21-22's assertions with
```js
    expect([c.thermalEnabled, c.tempWarnC, c.tempCritC, c.tempHysteresisC]).toEqual([true, 70, 80, 5]);
```
and delete the line 21 pin assertion; replace the `pwm-ir-tx is refused` test (line 103-105) with
```js
  it("pwm-ir-tx is allowed now that the fans are gone (GPIO12 is free)", () => {
    expect(checkPins({ ...base, irTxDriver: "pwm-ir-tx", irTxPin: 12 })).toBeUndefined();
  });
```
and delete the `the fan and 1-wire pins join the budget` test (lines 106-111). `pi/test/settings.test.js` line 173: change `s.set("pirPin", 24)` expectation to use a pin that is still assigned: set `relayPin` to the PIR's pin instead, e.g. `s.set("relayPin", 17)` and expect `[400, "GPIO17 is set for both the PIR and the relay"]` (adjust to the actual `pirPin` default; read the neighbouring lines first).

- [ ] **Step 8: Run all Pi tests**

```bash
cd pi && npx vitest run
```
Expected: all pass. Fix any remaining references surfaced by failures (`grep -rn "fan\|tach\|ds18\|sensorProjector\|w1Pin" pi/src pi/test`), expecting only comments to remain, and clean those.

- [ ] **Step 9: Commit**

```bash
git add pi/src pi/test
git commit -m "Pi: drop fans, tach, PWM and DS18B20; keep an SoC over-temperature guard

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Pi web UI, system files and README

**Files:**
- Modify: `pi/public/index.html` (lines 122-125), `pi/public/app.js` (`renderCooling` ~447-472, `pinTable` ~496-499, alarms line ~391)
- Modify: `pi/system/setup.sh` (lines ~121-137), `pi/system/videofx.default` (cooling and fixed-pin comments), `pi/system/99-videofx.rules` (lines 9-10), `pi/README.md` (line 13), `pi/package.json` (description)

**Interfaces:**
- Consumes: Task 4's status shape `thermal: { enabled, temp, alarms, locked, tripped }`.

- [ ] **Step 1: Web page**

`index.html`: delete `<div id="sensor-pick"></div>`. In `app.js` replace `renderCooling` with:
```js
function renderCooling(t) {
  const table = $("cooling");
  if (!t?.enabled) {
    table.replaceChildren(el("tr", {}, el("td", {}, "Off. Turn on in Settings > Cooling to stop playback if the Pi overheats.")));
    return;
  }
  const temp = t.temp === null || t.temp === undefined ? "–" : `${t.temp.toFixed(1)} °C`;
  const rows = [
    ["Pi (SoC)", temp],
    ["State", t.tripped ? `Stopped: ${t.tripped}` : "OK"],
  ];
  table.replaceChildren(...rows.map(([k, v]) => el("tr", {}, el("th", {}, k), el("td", {}, v))));
}
```
Delete the four fan/1-wire rows from `pinTable` (`Projector fan PWM`, `Pi fan PWM`, `Fan tach in`, `1-wire (DS18B20)`). Rename the page heading `Cooling` to `Heat` only if tests or docs do not reference it (leave it as `Cooling` otherwise).

- [ ] **Step 2: System files**

`setup.sh`: delete the `# Fans (hardware PWM ...` comment and the whole `grep -q '^# videofx: fans and 1-wire' ... CFG` heredoc block (lines ~121-137). On a device that already ran the old setup the overlays stay in `config.txt`; add before `install -m 644 "$src/system/asound.conf"`:
```bash
# Older installs added fan PWM and 1-wire overlays; the case has no fans or DS18B20s now.
if grep -q '^# videofx: fans and 1-wire' "$config"; then
  sed -i '/^# videofx: fans and 1-wire/,/^\[all\]$/{/^dtoverlay=pwm-2chan/d;/^dtoverlay=w1-gpio/d}' "$config"
  sed -i '/^# videofx: fans and 1-wire/d;/^# Fan PWM: PWM0/d' "$config"
fi
```
`videofx.default`: delete the commented `VIDEOFX_FAN1_CURVE`, `FAN2_CURVE`, `FAN_MIN_DUTY`, `FAN_COOLDOWN_SEC`, `SENSOR_PROJECTOR`, `SENSOR_PI` lines and their comments, the fixed `FAN1/2_PWM_GPIO`, `FAN1/2_TACH_GPIO`, `W1_GPIO` lines, and the `w1-gpio` mention at line ~143; update the `THERMAL`, `TEMP_*` comments to match the new labels/defaults (70 / 80 / 5). `99-videofx.rules`: delete the PWM comment and rule (lines 9-10). `pi/README.md` line 13: replace the fan bullet with `- watches the Pi's own temperature and switches the projector off if it overheats (the projector's fan does the case cooling).` `pi/package.json` description: remove `fans, `.

- [ ] **Step 3: Verify**

```bash
cd pi && npx vitest run
grep -rn -i "fan\|tach\|ds18\|1-wire\|w1-gpio\|pwm" pi/src pi/public pi/system pi/README.md pi/package.json | grep -v node_modules
```
Expected: tests pass; the grep shows only `pwm-ir-tx` (IR LED) mentions and nothing about case fans.

- [ ] **Step 4: Commit**

```bash
git add pi
git commit -m "Pi UI and system files: no fans, sensors or PWM overlay

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Wiring, BOM and documentation

**Files:**
- Modify: `scripts/render_wiring.py`, `docs/WIRING.md`, `docs/BOM.md`, `docs/ASSEMBLY.md`, `docs/BRINGUP.md`, `docs/PRINTING.md`, `docs/AIMING.md`, `docs/DESIGN_LOG.md`, `CLAUDE.md`, `README.md`
- Regenerate: `docs/wiring-lv-power.svg`, `docs/wiring-lv-signals.svg`

**Interfaces:** none (documents the result of Tasks 1-5).

- [ ] **Step 1: Wiring script and SVGs**

In `scripts/render_wiring.py` remove: the fan blocks in the power diagram (the `# --- fans: 24 V parts on the 24 V rail` loop, ~263-278), the 1-wire bus with its resistor and two DS18B20s (`# 1-wire bus off GPIO26 ...`, ~350-370) and the `fan(...)` helper with both fan rows and the PWM0 riser hop (~372-399) in the signals diagram; fix the module docstring (line 13) and the note at line ~403 (drop `fan PWM 12 / 13, fan tach 24 / 25, 1-wire`); change the second wall-wart label (line 146) to `'Second wall-wart\nunmodified\n12-24 V, 2.5-3 A out\nfor the Pi + DigiAMP+'` and drop the line-223 note about fans. Then:
```bash
uv run scripts/render_wiring.py
grep -c -i "fan\|DS18B20\|1-wire" docs/wiring-lv-power.svg docs/wiring-lv-signals.svg
```
Expected: counts of 0. Open both SVGs (browser) and check nothing overlaps where the blocks were removed; shift remaining elements up only if a visible gap remains.

- [ ] **Step 2: `docs/WIRING.md`**

Remove the FANS subgraph and `FAN1/FAN2` links from the DC mermaid (lines ~84-100, and fix the `linkStyle` indices after deleting links: count the remaining links in order), the DS18B20/tach/PWM nodes from the signals mermaid (~121-150), the "Splice to fans" row and the fan fuse row, and edit the sentence at ~171 to: `Check the second rail's total: the DigiAMP+ at your volume plus the Pi must stay under that wall-wart's output rating.` Change the second rail text from 24 V to `12-24 V (the DigiAMP+'s range; higher gives it more power)`. Step 4 of the power-up list (`Connect loads one at a time: fans, then ...`) becomes `Connect loads one at a time: the DigiAMP+ (the Pi should boot), then the projector.` Add a short **Projector cables** note: DC barrel plug on the rear face top-right corner (right-angle, pointing back); HDMI on the right face's I/O strip (right-angle, cable runs back along the side gap above the baffle); leave USB, AV and Type-C unplugged.

- [ ] **Step 3: BOM, assembly, bring-up, printing, aiming**

- `docs/BOM.md`: delete the fan row (line 43), the DS18B20 + 4.7 kohm row (44), the fan screws row (64), `Noctua fans, DS18B20` from the order list (88), and the `Fans (2x Noctua) + sensors + PIR` cost line becomes `PIR` (adjust the total); screen caps: `exhaust_cap` x1, `intake_cap` x1, `vent_cap` x1 (was 3 + 1); the second wall-wart row loses `+ fans` and its 24 V requirement (`12-24 V`); add a right-angle HDMI plug/cable (male-to-male, low profile, pointing rearward) and a right-angle DC barrel plug if the stock one is straight. Insect screen note: `Caps` only.
- `docs/ASSEMBLY.md`: step 4 becomes `Glue insect screen inside the three caps (exhaust_cap, intake_cap, vent_cap). Screw them over the right-wall louver banks (front bank: exhaust, rear bank: inlet, high bank over the shelf: the Pi vent).`; delete step 7 (Fans) and renumber the rest (including the step references inside the document).
- `docs/BRINGUP.md`: replace rows 13-13c (fans and sensors, over-temperature, lost sensor, cooling-off) with one row `13 | Pi over-temperature: set the critical temperature just above the Pi's idle temperature (Settings > Cooling) | Playback and projector stop with a clear alarm; resume after the hysteresis`; add rows: `Airflow (night, lid on): thin tissue at the exhaust bank blows outward, at the inlet bank is drawn inward; a thermometer at the rear intake reads within 3 C of ambient after 30 min`; `Pi zone: log SoC and shelf-top temperature over a warm night with the lid on`; `Port fit: right-angle HDMI on the right face clears the baffle at +/-15 tilt, +/-10 pan; the IR holder clears the window at the same extremes`; row 18 (heat) rewritten without fans. Keep the numbering contiguous.
- `docs/PRINTING.md`: replace the `vent_cap` x3 / `intake_cap` x1 rows with `vent_cap` x1, `intake_cap` x1, `exhaust_cap` x1 and re-slice them and the two base tiles using the PrusaSlicer CLI recipe in `CLAUDE.md` (Commands); update the sliced times and grams. Note this slice needs the stock MK3S profile; if PrusaSlicer is not installed, leave the old numbers and add `(not re-sliced after the airflow change)` beside them.
- `docs/AIMING.md` line 38: `The louver banks are clear of the HDMI cable and the power cord hangs in a drip loop below the gland.`

- [ ] **Step 4: Design log, CLAUDE.md, README**

- `docs/DESIGN_LOG.md`: add a version row (`v0.10 (unreleased)`: passive airflow) and a decision entry dated 2026-10-06: why the fans went (the projector has its own; fewer parts, no 24 V coupling, no sensors, the side gap no longer needs the 14 mm fan body), the path (rear intake, right-wall banks, baffle), the photo-derived port positions (DC corner, right-face HDMI strip), the IR receiver position, the speaker grille, the single passive Pi louver and the night-only duty argument, and the open risks from the spec. Mark the **Heat** and **Insect screen** decisions superseded with a pointer.
- `CLAUDE.md`: rewrite the `Airflow` bullet and the `Insects` bullet and the `Pi software`/fan mentions; update `part` list (add `exhaust_cap`), the `check_clash` description (no fan_body; baffle, side ports, IR holder), the Unverified list (items 1 and 4: new measured values, port positions now from photos), the mains bullet (second wall-wart no longer needs to match fans), and `side_air`'s comment (note it could shrink once re-measured). Keep the file's tone and length; remove `fan` knobs from the knob names it lists.
- `README.md`: update the feature bullets and the part table row for the caps (line ~55) and the roadmap line 83 (`Tune fan and louver placement` -> `Re-measure louver openings against the real projector vents`).

- [ ] **Step 5: Verify and commit**

```bash
grep -rn -i "noctua\|fan_body\|ds18b20\|1-wire\|intake slot\|floor intake" CLAUDE.md README.md docs/*.md pi/README.md | grep -v DESIGN_LOG
```
Expected: no hits outside `docs/DESIGN_LOG.md` (history may mention them). Re-run:
```bash
export OPENSCAD=/Applications/OpenSCAD.app/Contents/MacOS/OpenSCAD
scripts/check_clash.sh && (cd pi && npx vitest run)
git add -A docs CLAUDE.md README.md scripts
git commit -m "Docs, BOM and wiring for passive airflow

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```
Expected: everything `ok` and green.

---

## Self-Review notes

- **Spec coverage:** exhaust and inlet banks, baffle, Pi vent, removals (Task 1); DC corner, side HDMI, IR holder, speaker note (Task 2, docs in Task 6); full part export (Task 3); Pi software removal and SoC guard, GPIO12 freed, setup overlays (Tasks 4-5); power rail wording, wiring, BOM, bring-up risks (Task 6). `side_air` shrink is out of scope and noted in `CLAUDE.md`.
- **Spec deltas made while planning:** the spec's "check that the patch is inside the opening" became OpenSCAD `assert`s (Task 1, step 3); `exh_y` is `[0, 42]` to honour the owner's "first 40 mm" while the photo shows slots from 10 mm; `thermalEnabled` now defaults to `true` with 70/80 C thresholds because the SoC guard needs no wiring.
- **Known-fragile spots (executor: verify, do not guess):** the louver centring arithmetic in Task 1 step 4, the IR holder fit in the 30 mm front gap (fallback `ir_holder_h` 7), the HDMI cable run versus the inlet cap in the `aim_combo` corner (fallback `side_cable_d` 6), and the mermaid `linkStyle` indices in `WIRING.md`.
