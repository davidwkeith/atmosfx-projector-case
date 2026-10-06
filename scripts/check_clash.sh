#!/usr/bin/env bash
# Interference checks: every pair below must NOT overlap in the closed assembly.
# Usage: scripts/check_clash.sh   (set OPENSCAD=/path/to/openscad if needed)
# Measures the intersection's volume, so zero-volume contact (parts resting on each other) passes.
set -u
OPENSCAD=${OPENSCAD:-openscad}
SCAD="$(cd "$(dirname "$0")/.." && pwd)/projector_pi_case.scad"
T=$(mktemp -d "${TMPDIR:-/tmp}/clash.XXXXXX") || exit 2
trap 'rm -rf "$T"' EXIT
fail=0

# Volume (mm^3) of an OFF mesh, by summing signed tetrahedra of each fan-triangulated face
volume() {
  python3 - "$1" <<'PY'
import sys
lines = [l.split() for l in open(sys.argv[1]) if l.strip() and not l.startswith('#')]
if lines[0][0] == 'OFF' and len(lines[0]) == 1: lines = lines[1:]   # counts may share the OFF line
else: lines[0] = lines[0][1:]
nv, nf = int(lines[0][0]), int(lines[0][1])
v = [tuple(map(float, l[:3])) for l in lines[1:1+nv]]
vol = 0.0
for l in lines[1+nv:1+nv+nf]:   # "n i0 i1 ... [r g b]"
    n = int(l[0]); f = [v[int(x)] for x in l[1:1+n]]
    for a, b in zip(f[1:-1], f[2:]):
        o = f[0]
        vol += (o[0]*(a[1]*b[2]-a[2]*b[1]) - o[1]*(a[0]*b[2]-a[2]*b[0]) + o[2]*(a[0]*b[1]-a[1]*b[0])) / 6
print(f"{abs(vol):.3f}")
PY
}

run() {  # name, openscad expression
  printf 'include <%s>\n%s\n' "$SCAD" "$2" > "$T/$1.scad"
  out=$("$OPENSCAD" -o "$T/$1.off" -D part=\"none\" "$T/$1.scad" 2>&1)
  if echo "$out" | grep -q "empty"; then echo "ok    $1"; return; fi
  if [ ! -s "$T/$1.off" ]; then echo "ERROR $1"; echo "$out" | tail -3; fail=1; return; fi
  if ! v=$(volume "$T/$1.off"); then echo "ERROR $1 (could not read mesh)"; fail=1; return; fi
  if python3 -c "import sys; sys.exit(0 if $v < 0.5 else 1)"; then
    echo "ok    $1 (contact)"
  else
    echo "CLASH $1 ($v mm3)"; fail=1
  fi
}

LID="translate([0,0,lid_z0]) lid()"
COVER="translate([-out_w/2-cover_gasket-3, hatch_y, hatch_zz]) rotate([90,0,90]) hatch_cover()"
run lid-base       "intersection(){ base_all(); $LID; }"
run cover-base     "intersection(){ base_all(); $COVER; }"
run cover-lift     "intersection(){ base_all(); translate([0,0,kh_drop]) $COVER; }"   # lifting it off its keyholes
run lid-cover      "intersection(){ $LID; $COVER; }"
run lid-hood       "intersection(){ $LID; hood(); }"
run shelf-base     "intersection(){ base_all(); translate([0, y_pi0+0.3, shelf_zz]) power_shelf(); }"
run pedestal-base  "intersection(){ base_all(); translate([ped_x, ped_y, z_floor+boss_h]) pedestal(); }"
run frame-base     "intersection(){ base_all(); translate([lens_x, y0, win_zc]) window_frame(); }"
run lid-tiles      "intersection(){ lid_tile(\"front\") lid(); lid_tile(\"rear\") lid(); }"
for s in pi3 pi4 pi5 zero2w; do
  run "sled-$s"   "intersection(){ base_all(); translate([0,0,z_floor+sled_pad]) pi_sled(\"$s\"); }"
  run "stack-$s"  "intersection(){ pi_stack(\"$s\"); union(){ base_all(); translate([0, y_pi0+0.3, shelf_zz]) power_shelf(); } }"
done
for s in pi3 pi4 pi5; do   # a straight HDMI plug in the Pi, through the divider (the Zero's port sits 35 mm back and takes a slim plug)
  run "hdmi-$s"   "intersection(){ pi_hdmi_plug(\"$s\"); union(){ base_all(); translate([0,0,z_floor+sled_pad]) pi_sled(\"$s\"); translate([ped_x, ped_y, z_floor+boss_h]) pedestal(); for (a=[-aim_max, aim_max]) { projector(0, a); projector_ports(0, a); } } }"
done
run screen-caps   "intersection(){ base_all(); union(){ for (v=vents) vent_cap_placed(v); exhaust_cap_placed(); intake_cap_placed(); } }"
run warts          "intersection(){ translate([0, y_pi0+0.3, shelf_zz]) warts(); union(){ base_all(); $LID; translate([0, y_pi0+0.3, shelf_zz]) power_shelf(); } }"   # both wall-warts on the receptacle plate vs case, lid roof and shelf
run aim-sweep      "intersection(){ union(){ base_all(); $LID; translate([lens_x, y0, win_zc]) window_frame(); exhaust_cap_placed(); intake_cap_placed(); }
                      for (a=[[1,0],[0,1],[1,1],[1,-1]], sg=[-1,1])
                        { projector(sg*a[0]*pan_max, sg*a[1]*(a[0] ? aim_combo : aim_max));
                          projector_ports(sg*a[0]*pan_max, sg*a[1]*(a[0] ? aim_combo : aim_max));
                          projector_side_ports(sg*a[0]*pan_max, sg*a[1]*(a[0] ? aim_combo : aim_max));
                          ir_holder_placed(sg*a[0]*pan_max, sg*a[1]*(a[0] ? aim_combo : aim_max)); } }"
run light-cone     "intersection(){ union(){ base_all(false); $LID; translate([lens_x, y0, win_zc]) window_frame(); }
                      for (a=[[1,0],[0,1],[1,1],[1,-1]], sg=[-1,1])
                        light_cone(sg*a[0]*pan_max, sg*a[1]*(a[0] ? aim_combo : cone_tilt)); }"
run ir-holder-cone "for (a=[[1,0],[0,1],[1,1],[1,-1]], sg=[-1,1]) intersection(){
                      ir_holder_placed(sg*a[0]*pan_max, sg*a[1]*(a[0] ? aim_combo : cone_tilt));
                      light_cone(sg*a[0]*pan_max, sg*a[1]*(a[0] ? aim_combo : cone_tilt)); }"
exit $fail
