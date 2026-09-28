// Ground-standing projector + Raspberry Pi 3 case: rain-proof (not sealed), ventilated
// v0.8 - AC gland moved above the shelf (AC side of the barrier); barrier clears the brick; keyholes lift off;
//        45 deg scarf joint at the lid seam; flat gasket land under the sloped roof;
//        audio: HiFiBerry Amp4 HAT on the Pi (also powers it), speaker wire out through a floor chimney;
//        Pi rides on a removable sled (Pi 3B/3B+, 4B, 5, Zero 2 W), shelf raised to clear the Pi 5 stack;
//        PIR motion sensor in the rear wall under a rain hood, for startle scares
// v0.7 - ONE AC cord in (rear gland) -> DC brick INSIDE on the power shelf, walled off from the low-voltage side;
//        a wire splice feeds the projector's barrel plug and the Amp4 HAT (which powers the Pi).
// v0.4 - quick-aim hatch on the left (-X) wall: reach the ball head with the lid on, tool-free
// sized for a ~171x134x75 mm mini projector (0.72 kg) on an internal ball head
// Print PETG/ASA. Lid prints roof-down. Base+lid split front/rear (MK3S bed 250x210x210); rotate front pieces 90 deg.

/* [Part] */
part = "assembly"; // [assembly, base, lid, window_frame, pedestal, hatch_cover, power_shelf, sled, ir_holder, vent_cap, intake_cap]
sled = "pi3";      // [pi3, pi4, pi5, zero2w] sled shown in the assembly / exported by part="sled"
tile = "all";      // [all, front, rear] for base+lid
explode = 0;       // [0:1:80]
aim = [0, 0];      // [pan, tilt] deg of the ghost projector in the assembly preview

/* [Projector (mm)] */
proj_w = 135;   // width (X)  - measure yours; listing says 6.74x5.28x2.96 in
proj_d = 172;   // depth (Y), lens faces front
proj_h = 76;    // height (Z)
lens_x = 0;     // lens offset from centre (+ = right)
lens_z = 40;    // lens centre height above projector underside
pane_w = 127;   // acrylic pane: 3 x 5 in (127 x 76.2 mm), a stock size; the window opening is the pane minus lap
pane_h = 76.2;
mount_x = 0;    // 1/4-20 socket offset from projector centre (keep within a few cm)
mount_y = 0;    // + = toward rear

/* [Ball head] */
ball_head_h = 40;  // height of your ball head, base to mounting stud
pivot_h = 25;      // ball centre above the head's base (aim pivot)
aim_max = 15;      // pan OR tilt range the case must clear (check_clash.sh sweeps it)
aim_combo = 10;    // pan AND tilt together (corners); 15+15 would need a front tile past 250 mm
ped_top = 30;      // pedestal top height above floor
insert_d = 8.2;    // 1/4-20 heat-set insert hole; check your insert's datasheet
insert_len = 9;

/* [Enclosure] */
wall = 3;
floor_t = 6;
foot_h = 6;        // ground clearance so rain drains out underneath
foot_ribs = [-88, -68, -40, -15, 15, 40, 68, 88];   // front-to-back ribs: floor bridges <= 27 mm, channels drain/vent/route wires
rib_t = 4;
layer_h = 0.2;     // print layer height: gap above the window's snap-out ribs
clearance = 0.3;
side_air = 25;     // gap each side of projector (clears +/-15 deg pan)
top_air  = 25;
front_gap = 30;      // lens-down tilt swings the top front corner ~20 mm forward
rear_gap  = 26;      // lens-up tilt swings the top rear corner back; aim-sweep in check_clash.sh sizes these
pi_zone_d = 75;
pane_t = 3.2;      // acrylic thickness (1/8 in); photo-frame glazing is often thinner
lap = 8;           // pane overlap past the window opening
boss_h = 4;

/* [Aim hatch (-X wall)] */
hatch = 120;         // diamond opening, tip to tip: reach in to loosen/aim the ball head (45 deg edges print unsupported)
hatch_flange = 10;   // cover overlap past the diamond's tips
hatch_zc = 62;       // opening centre height above floor (cover must lift kh_drop under the hood)
stud_off = 56;       // M4 stud spacing from opening centre
kh_drop = 8;         // keyhole slide distance: cover lifts this much to come off
m4_insert_d = 5.6;   // M4 heat-set insert hole; check your insert
hood_d = 10;         // rain hood depth over the hatch (must stay below the lid skirt)
cover_gasket = 1.5;  // foam tape thickness

/* [Power] */
shelf_z = 60;       // power shelf height above floor: clears the tallest sled stack (asserted)
ledge_w = 9;        // shelf ledge on the side walls
tie_gap = 34;       // zip-tie slot spacing across the shelf (module sits between)
cord_x = -65;       // where the single AC cord enters the rear wall (AC side, left of the barrier)
cord_dz = 15;       // gland centre above the shelf's top face, so mains never enters the Pi zone
brick_l = 100;      // your DC brick: length (X) - measure it
brick_w = 50;       // width (Y)
brick_h = 32;       // height
barrier_h = 40;     // AC/low-voltage barrier above the shelf; must exceed brick_h

/* [Audio] */
spk_x = 58;         // speaker-wire chimney: beside the Pi's USB end, clear of the drains
spk_d = 12;         // bore: two runs of 16 AWG zip cord
spk_collar = 15;    // chimney height above the floor, so floor water can't reach the bore
pi_stack_h = 40;    // Pi 3/4: board bottom to top of the Amp4 HAT (assumption: check yours)
pi5_stack_h = 50;   // Pi 5 with Active Cooler under the HAT (taller header)
zero_stack_h = 30;  // Zero 2 W + Amp4
zero_hat_z = 13;    // Zero 2 W: HAT underside above the Zero's board bottom (sets the HAT support posts)

/* [Motion sensor (rear wall)] */
pir = true;         // HC-SR501-style PIR looking out the rear wall, toward people approaching
pir_x = 55;         // low-voltage side, clear of the barrier and the rear lid post
pir_dz = 45;        // dome centre above the shelf's top face
pir_dome_d = 23.5;  // lens dome; check yours
pir_hole_sp = 28.7; // board mounting holes (M2), check yours
pir_stand = 3;      // lens frame thickness: board sits this far off the wall

/* [Projector power fallback] */
ir_angle = 30;      // IR LED tilt in the stick-on holder

/* [Tripod mount] */
tripod = true;
tripod_y = 12;       // 3/8-16 insert near the estimated centre of mass (brick and Pi sit rearward)
tripod_y2 = -18;     // 1/4-20 insert for smaller heads / quick-release plates
insert38_d = 12.1;   // 3/8-16 heat-set insert hole; check your insert's datasheet
insert38_len = 12.7;

/* [Insect screen] */
cap_h = 3;          // screen caps stand this far off the wall/floor; screen glues inside the plate
cap_t = 2;          // cap ring and plate thickness

/* [Pi sled] */
sled_pad = 2;       // floor pads lift the sled so floor water drains underneath
sled_t = 3;         // sled plate
sled_post = 3;      // board standoffs on the sled
m3_insert_d = 4.0;  // M3 heat-set insert for the sled thumbscrew; check your insert

/* [Hardware] */
gland_d = 15.5;    // PG9 mains-rated cord grip for the single AC cord
fan = 40;           // 40 x 40 x 10 mm 12 V 4-pin PWM fans (Pi-controlled)
pi_fan_dz = 28;     // Pi-zone exhaust fan centre above the shelf's top face

/* [Lid] */
lid_clr = 0.6;
skirt_h = 22;
top_t = 3;
rise = 12;         // roof slope, drains to rear
visor_len = 40;
lip_h = 12;
gasket = 2;        // foam tape on the base rim; lid bosses stop 1 mm short so it compresses
seam_rib = 4;      // extra roof thickness at the lid seam for the scarf joint

/* [Hidden] */
$fn = 48;
z_floor = foot_h + floor_t;
proj_z0 = ped_top + ball_head_h;          // projector underside above floor
fw = wall + pane_t + 4;
div_t = 3;
inner_w = proj_w + 2*side_air;
proj_zone_d = front_gap + proj_d + rear_gap;
inner_d = proj_zone_d + div_t + pi_zone_d;
inner_h = proj_z0 + proj_h + top_air;
out_w = inner_w + 2*wall;
out_d = inner_d + fw + wall;
base_h = z_floor + inner_h;
y_front = -out_d/2;
y0 = y_front + fw;
y_div = y0 + proj_zone_d;
y_pi0 = y_div + div_t;
y_back = out_d/2 - wall;
z_pj = z_floor + proj_z0;
z_lens = z_pj + lens_z;
proj_cy = y0 + front_gap + proj_d/2;
ped_x = mount_x;
ped_y = proj_cy + mount_y;
win_w = pane_w - 2*lap;                   // clear opening for the light cone
win_h = pane_h - 2*lap;
frame_t = 4;
pi_cy = (y_pi0 + y_back)/2;
cover_s = hatch + 2*hatch_flange;
hatch_zz = z_floor + hatch_zc;
hatch_y = proj_cy;
hood_lift = hood_d - cover_gasket + 0.5 + kh_drop + 1;   // room to lift the cover off its keyholes
fan_z = z_pj + proj_h/2;
post_x = inner_w/2 - 8;
post_ys = [y0 + 8, y_back - 8];
base_seam = y_div + div_t + 0.01;
shelf_zz = z_floor + shelf_z;
pi_fan_z = shelf_zz + 3 + pi_fan_dz;
fans = [[proj_cy, fan_z], [pi_cy, pi_fan_z]];
vents = [[-1, pi_cy, z_floor+24], [-1, pi_cy, shelf_zz+26], [1, pi_cy, z_floor+24]];   // passive louver banks [side, y, centre z]
vent_open = [26, 42];                      // louver bank opening a wall cap covers (Z, Y); tabs go top/bottom, clear of the lid posts
intake_c = [0, y0+39, z_floor];            // floor intake slots centre
intake_open = [92, 30];   // [y, z] on the +X wall: projector exhaust, Pi-zone exhaust
pir_zz = shelf_zz + 3 + pir_dz;
y_gpio = pi_cy + 28;                       // GPIO edge of every Pi (HAT position)
z_board = z_floor + sled_pad + sled_t + sled_post;
sled_x = [-60, 47];                        // plate spans the left margin (pins, screw, label) to clear the chimney
sled_pts = [[-52, pi_cy-24], [43, pi_cy+24], [-52, pi_cy+18], [43, pi_cy-24]];   // pin, pin, thumbscrew, pad
SLEDS = ["pi3", "pi4", "pi5", "zero2w"];
function sled_board(s) = s == "zero2w" ? [65, 30] : [85, 56];
function sled_holes(s) = s == "zero2w" ? [[3.5,3.5],[61.5,3.5],[3.5,26.5],[61.5,26.5]]
                                       : [[3.5,3.5],[61.5,3.5],[3.5,52.5],[61.5,52.5]];   // 3B/3B+/4B/5 share 58 x 49
function sled_stack(s) = s == "pi5" ? pi5_stack_h : s == "zero2w" ? zero_stack_h : pi_stack_h;
function sled_label(s) = s == "zero2w" ? "Zero 2W" : str("Pi ", s[2]);
assert(z_board + max([for (s=SLEDS) sled_stack(s)]) + 1 <= shelf_zz, "raise shelf_z: a sled stack hits the shelf");
shelf_w = inner_w - 1;
shelf_d = pi_zone_d - 1;

lid_w = out_w + 2*(lid_clr + wall);
lid_d = out_d + 2*(lid_clr + wall);
lid_a = atan(rise/lid_d);
yfl = -lid_d/2;
lid_seam = yfl - visor_len + 230;
seam_t = top_t + seam_rib;                // roof thickness across the scarf
pivot = [ped_x, ped_y, z_floor + ped_top + pivot_h];
assert(barrier_h > brick_h, "barrier_h must exceed brick_h");
lid_z0 = base_h + gasket - (skirt_h - top_t);
lid_boss_z = base_h - lid_z0 + 1;
big = 900;
function zp(y) = skirt_h + rise*(1 - (y - yfl)/lid_d);

// Butt-joint split at seam_y (base)
module tile_cut(t, seam_y) {
  if (t == "all") children();
  else intersection() {
    children();
    translate([-500, (t=="front") ? seam_y-500 : seam_y, -500]) cube([1000,500,1500]);
  }
}

// Lid split with a 45-degree scarf: the front (uphill) tile laps over the rear one like a shingle,
// and both print roof-down without supports. front = everything forward of the plane y - z = c.
module lid_tile(t) {
  c = lid_seam + seam_t/2 - zp(lid_seam);
  module front_region() rotate([90,0,90]) linear_extrude(big, center=true)
    polygon([[-big, -big], [c-big, -big], [c+big, big], [-big, big]]);
  if (t == "all") children();
  else if (t == "front") intersection() { children(); front_region(); }
  else difference() { children(); front_region(); }
}

// 45-degree louvers that shed rain; dir=+1 for +X wall, -1 for -X wall
module louvers(len=60, n=4, pitch=8, dir=1) {
  for (i=[0:n-1]) translate([0,0,i*pitch])
    rotate([0, dir*45, 0]) cube([wall*3, len, 2.4], center=true);
}

module cuts() {
  // lens window + acrylic rebate (inside face)
  translate([lens_x-win_w/2, y_front-1, z_lens-win_h/2]) cube([win_w, fw+2, win_h]);
  translate([lens_x-(pane_w+2*clearance)/2, y0-pane_t-0.4, z_lens-(pane_h+2*clearance)/2])
    cube([pane_w+2*clearance, pane_t+0.5, pane_h+2*clearance]);
  for (sx=[-1,1], sz=[-1,1])
    translate([lens_x+sx*(pane_w/2+8), y0+0.1, z_lens+sz*(pane_h/2+8)])
      rotate([90,0,0]) cylinder(d=2.6, h=8.1);
  // intake: slots in the raised floor (air enters from the gap underneath)
  for (i=[0:3]) translate([-45, y0+25+i*8, foot_h-0.5]) cube([90, 4, floor_t+1]);
  // aim hatch opening + M4 stud inserts (from outside)
  translate([-out_w/2-1, hatch_y, hatch_zz]) rotate([0,90,0]) linear_extrude(wall+2) rotate(45) square(hatch/sqrt(2), center=true);
  for (sy=[-1,1], sz=[-1,1])
    translate([-out_w/2-0.1, hatch_y+sy*stud_off, hatch_zz+sz*stud_off]) rotate([0,90,0]) cylinder(d=m4_insert_d, h=8.1);
  // fan exhaust louvers (+X)
  for (f=fans) translate([out_w/2-wall/2, f[0], f[1]-10.5]) louvers(28, 4, 7, 1);
  // passive Pi-side louvers
  // (the upper -X bank is intake across the brick to the Pi-zone fan)
  for (v=vents) translate([v[0]*(out_w/2-wall/2), v[1], v[2]-8]) louvers(40, 3, 8, v[0]);
  // screen-cap screw pilots (M2 self-tap)
  for (v=vents, sy=[-1,1]) translate([v[0]*(inner_w/2+2), v[1], v[2]+sy*cap_tab(vent_open)]) rotate([0, -v[0]*90, 0]) cylinder(d=1.8, h=cap_h+2);
  for (sx=[-1,1]) translate([intake_c[0]+sx*cap_tab(intake_open), intake_c[1], z_floor-2]) cylinder(d=1.8, h=cap_h+2.1);
  // fan screw pilots
  for (f=fans, sy=[-16,16], sz=[-16,16])
    translate([inner_w/2-4.1, f[0]+sy, f[1]+sz]) rotate([0,90,0]) cylinder(d=2.6, h=6);
  // single power-cord gland (rear wall, above the shelf, AC side of the barrier)
  translate([cord_x, y_back-1, shelf_zz+3+cord_dz]) rotate([-90,0,0]) cylinder(d=gland_d, h=wall+2);
  // divider pass-through (HDMI + projector power)
  translate([0, y_div+div_t+1, 0]) rotate([90,0,0]) linear_extrude(div_t+2)   // gabled top prints unsupported
    polygon([[-25, z_floor+30], [25, z_floor+30], [25, shelf_zz+23], [0, shelf_zz+48], [-25, shelf_zz+23]]);
  // drains (exit into the gap under the floor)
  for (sx=[-1,1], y=[y0+8, y_back-10]) translate([sx*55, y, foot_h-0.5]) cylinder(d=4, h=floor_t+1);
  // pedestal plate pilots
  for (sx=[-1,1], sy=[-1,1])
    translate([ped_x+sx*35, ped_y+sy*25, z_floor+boss_h-8]) cylinder(d=2.6, h=8.1);
  // speaker-wire chimney bore: wires come up from the gap under the floor
  translate([spk_x, pi_cy, foot_h-1]) cylinder(d=spk_d, h=floor_t+spk_collar+2);
  translate([spk_x, pi_cy, z_floor+spk_collar-1.5]) cylinder(d1=spk_d, d2=spk_d+3, h=1.6);   // chamfer so wires don't chafe
  // PIR: dome hole through the rear wall + M2 pilots in the bosses
  if (pir) {
    translate([pir_x, y_back-1, pir_zz]) rotate([-90,0,0]) cylinder(d=pir_dome_d+2*clearance, h=wall+2);
    for (sx=[-1,1]) translate([pir_x+sx*pir_hole_sp/2, y_back-pir_stand-0.1, pir_zz]) rotate([-90,0,0]) cylinder(d=1.6, h=pir_stand+2);
  }
  // tripod inserts, from below
  if (tripod) {
    translate([0, tripod_y, -1]) cylinder(d=insert38_d, h=insert38_len+1);
    translate([0, tripod_y2, -1]) cylinder(d=insert_d, h=insert_len+1);
  }
  // sled thumbscrew insert
  translate([sled_pts[2][0], sled_pts[2][1], z_floor+sled_pad-6]) cylinder(d=m3_insert_d, h=6.1);
  // lid screw pilots
  for (sx=[-1,1], y=post_ys) translate([sx*post_x, y, base_h-14]) cylinder(d=2.6, h=14.1);
}

module base_all() {
  difference() {
    union() {
      difference() {
        translate([-out_w/2, y_front, foot_h]) cube([out_w, out_d, base_h-foot_h]);
        translate([-inner_w/2, y0, z_floor]) cube([inner_w, inner_d, inner_h+1]);
      }
      for (v=vents, sy=[-1,1])   // screen-cap bosses
        translate([v[0]*(inner_w/2+0.1), v[1], v[2]+sy*cap_tab(vent_open)]) rotate([0, -v[0]*90, 0]) cylinder(d=6, h=cap_h-cap_t+0.1);
      for (sx=[-1,1]) translate([intake_c[0]+sx*cap_tab(intake_open), intake_c[1], z_floor-0.1]) cylinder(d=6, h=cap_h-cap_t+0.1);
      if (tripod) {   // pad flush with the rib bottoms, plus a boss inside so the 3/8 insert has room
        hull() for (y=[tripod_y, tripod_y2]) translate([0, y, 0]) cylinder(d=30, h=foot_h+0.1);
        translate([0, tripod_y, z_floor-0.1]) cylinder(d=18, h=insert38_len+2-z_floor+0.1);   // 2 mm above the insert
      }
      for (x=foot_ribs) translate([x-rib_t/2, y_front, 0]) cube([rib_t, out_d, foot_h+0.1]);   // feet
      translate([-inner_w/2, y_div, z_floor-0.1]) cube([inner_w, div_t, base_h-z_floor+0.1]);   // divider
      for (sx=[-1,1], sy=[-1,1]) translate([ped_x+sx*35, ped_y+sy*25, z_floor-0.1]) cylinder(d=9, h=boss_h+0.1);
      for (sx=[-1,1], y=post_ys) translate([sx*post_x, y, z_floor-0.1]) cylinder(d=10, h=base_h-z_floor+0.1);
      for (p=sled_pts) translate([p[0], p[1], z_floor-0.1]) cylinder(d=10, h=sled_pad+0.1);   // sled pads
      for (p=[sled_pts[0], sled_pts[1]]) translate([p[0], p[1], z_floor]) cylinder(d=4, h=sled_pad+sled_t-0.4);   // locating pins
      for (f=fans, sy=[-16,16], sz=[-16,16]) translate([inner_w/2-4, f[0]+sy, f[1]+sz]) rotate([0,90,0]) cylinder(d=7, h=4.1);
      for (sy=[-1,1], sz=[-1,1])   // inner bosses behind the hatch studs
        translate([-inner_w/2-0.1, hatch_y+sy*stud_off, hatch_zz+sz*stud_off]) rotate([0,90,0]) cylinder(d=10, h=6.1);
      hood();
      if (pir) {
        for (sx=[-1,1]) translate([pir_x+sx*pir_hole_sp/2, y_back+0.1, pir_zz]) rotate([90,0,0]) cylinder(d=5, h=pir_stand+0.1);
        translate([pir_x-20, out_d/2, pir_zz+pir_dome_d/2+4]) rotate([90,0,90])   // 45 deg rain hood over the dome
          linear_extrude(40) polygon([[-0.1, 3], [hood_d, 0], [-0.1, -hood_d]]);
      }
      translate([spk_x, pi_cy, z_floor-0.1]) cylinder(d=spk_d+4.8, h=spk_collar+0.1);   // speaker-wire chimney
      for (sx=[-1,1]) ledge(sx);
    }
    cuts();
  }
  // snap-out ribs: cut the window's top bridge into thirds; one layer gap so they break away
  for (sx=[-1,1]) translate([lens_x+sx*win_w/6-0.4, y_front, z_lens-win_h/2-0.1])
    cube([0.8, fw-pane_t-0.5, win_h-layer_h+0.1]);
}

// 45-degree gusset ledge on the side wall that carries the power shelf
module ledge(sx) {
  translate([sx*inner_w/2, y_pi0+0.05, shelf_zz]) rotate([90,0,0]) mirror([0,0,1])
    linear_extrude(pi_zone_d-0.05) polygon([[0,0],[-sx*ledge_w,0],[sx*0.1,-ledge_w-0.1]]);
}

// Power shelf above the Pi. AC side (left of the barrier): brick in its cradle, mains cord from the gland.
// Low-voltage side (right): wire splice and DC fuse holder zip-tie to it; DC feed runs down to the Amp4.
module power_shelf() {
  bx0 = -shelf_w/2 + 3;
  bx1 = bx0 + 2.4 + brick_l + 1;     // right cradle wall
  bar = bx1 + 2.4 + 3;               // barrier between AC/brick side and low-voltage side
  difference() {
    union() {
      translate([-shelf_w/2, 0, 0]) cube([shelf_w, shelf_d, 3]);
      for (x=[bx0, bx1]) translate([x, 8, 2.9]) cube([2.4, brick_w, 8]);       // brick cradle ends
      translate([bar, 0, 2.9]) cube([2.4, shelf_d, barrier_h]);                // barrier
    }
    translate([bar-1, shelf_d/2-8, 2.9]) cube([4.4, 16, 12]);                  // low-voltage wire notch
    for (x=[-30,0], y=[3, 8+brick_w+5]) translate([x-10, y-1.5, -1]) cube([20, 3, 5]);   // velcro strap slots for the brick
    for (x=[-70:20:70], sy=[-1,1]) translate([x-1.6, shelf_d/2+sy*tie_gap/2-3, -1]) cube([3.2, 6, 5]);   // zip-tie slots
    for (x=[40, 60, 80]) translate([x-2.5, shelf_d/2-13, -1]) cube([5, 26, 5]);   // vents: Pi/amp heat rises to the Pi-zone fan (low-voltage side only)
    for (sx=[-1,1]) translate([sx*post_x, y_back-8-y_pi0-0.3, -1]) cylinder(d=11, h=5);
    translate([pir_x-6, shelf_d-7, -1]) cube([12, 8, 5]);                     // PIR / low-voltage wires down to the Pi
  }
}

// 45-degree rain hood over the aim hatch (prints without supports)
module hood() {
  translate([-out_w/2, hatch_y+cover_s/2, hatch_zz+cover_s/2+hood_lift]) rotate([90,0,0])
    linear_extrude(cover_s) polygon([[0.1, 3], [-hood_d, 0], [0.1, -hood_d]]);
}

// Hatch cover: hangs on four M4x12 button-head bolts through keyholes; lift kh_drop and pull off, no tools.
// Foam-tape gasket on the wall side. Prints ribs-up (part="hatch_cover").
module hatch_cover() {
  difference() {
    union() {
      translate([-cover_s/2, -cover_s/2, 0]) cube([cover_s, cover_s, 3]);
      translate([-cover_s/2+4, -1.5, -4]) cube([cover_s-8, 3, 4.1]);
      translate([-1.5, -cover_s/2+4, -4]) cube([3, cover_s-8, 4.1]);
    }
    for (sx=[-1,1], sz=[-1,1]) hull() {
      translate([sx*stud_off, sz*stud_off, -5]) cylinder(d=4.8, h=9);
      translate([sx*stud_off, sz*stud_off-kh_drop, -5]) cylinder(d=9, h=9);   // local +Y is up when hung
    }
  }
}

// Screws to the floor bosses and carries the ball head (1/4-20 insert + short stud)
module pedestal() {
  difference() {
    union() {
      translate([-50, -35, 0]) cube([100, 70, 4]);
      cylinder(d=40, h=ped_top-boss_h);
    }
    for (sx=[-1,1], sy=[-1,1]) translate([sx*35, sy*25, -1]) cylinder(d=3.4, h=6);
    translate([0, 0, ped_top-boss_h-insert_len]) cylinder(d=insert_d, h=insert_len+0.1);
  }
}

module plane_below(off) {
  translate([0, yfl, skirt_h+rise-off]) rotate([-lid_a,0,0])
    translate([-big/2, -big/2, -big]) cube([big, 2*big, big]);
}

module lid() {
  difference() {
    union() {
      difference() {
        union() {
          intersection() {
            translate([-lid_w/2, yfl, 0]) cube([lid_w, lid_d, skirt_h+rise+1]);
            plane_below(0);
          }
          intersection() {   // visor
            translate([-lid_w/2, yfl-visor_len, 0]) cube([lid_w, visor_len+0.01, big]);
            difference() { plane_below(0); plane_below(top_t); }
          }
          intersection() {   // drip lip
            translate([-lid_w/2, yfl-visor_len, skirt_h+rise-top_t-lip_h]) cube([lid_w, 2.4, big]);
            plane_below(0);
          }
        }
        intersection() {     // cavity
          translate([-(out_w+2*lid_clr)/2, -(out_d+2*lid_clr)/2, -1]) cube([out_w+2*lid_clr, out_d+2*lid_clr, skirt_h+rise+2]);
          plane_below(top_t);
        }
      }
      for (sx=[-1,1], y=post_ys)   // screw bosses reaching down to the base posts
        translate([sx*post_x, y, lid_boss_z]) cylinder(d=10, h=zp(y)-top_t-lid_boss_z+0.5);
      intersection() {     // flat gasket land over the base rim (the roof underside slopes)
        difference() {
          translate([-(out_w+2*lid_clr)/2, -(out_d+2*lid_clr)/2, skirt_h-top_t]) cube([out_w+2*lid_clr, out_d+2*lid_clr, big]);
          translate([-(out_w+2*lid_clr)/2+wall+3, -(out_d+2*lid_clr)/2+wall+3, -1]) cube([out_w+2*lid_clr-2*(wall+3), out_d+2*lid_clr-2*(wall+3), big]);
        }
        plane_below(1);
      }
      intersection() {     // seam rib: thickens the roof so the scarf has seam_t of overlap
        translate([-lid_w/2, lid_seam-seam_t/2-3, 0]) cube([lid_w, seam_t+6, big]);
        plane_below(1);
        difference() { plane_below(0); plane_below(seam_t); }
      }
    }
    for (sx=[-1,1], y=post_ys) {
      translate([sx*post_x, y, lid_boss_z-1]) cylinder(d=3.4, h=zp(y)-lid_boss_z+3);
      translate([sx*post_x, y, zp(y)-1.5]) cylinder(d=6.6, h=4);
    }
  }
}

module window_frame() {
  difference() {
    translate([-(pane_w+32)/2, 0, -(pane_h+32)/2]) cube([pane_w+32, frame_t, pane_h+32]);
    translate([-(win_w+8)/2, -1, -(win_h+8)/2]) cube([win_w+8, frame_t+2, win_h+8]);
    for (sx=[-1,1], sz=[-1,1]) translate([sx*(pane_w/2+8), -1, sz*(pane_h/2+8)]) rotate([-90,0,0]) cylinder(d=3.4, h=frame_t+2);
  }
}

module assembly() {
  tile_cut(tile, base_seam) base_all();
  translate([ped_x, ped_y, z_floor+boss_h]) pedestal();
  translate([0, y_pi0+0.3, shelf_zz]) power_shelf();
  translate([lens_x, y0, z_lens]) window_frame();
  translate([-out_w/2-cover_gasket-3, hatch_y, hatch_zz]) rotate([90,0,90]) hatch_cover();
  translate([0, 0, lid_z0 + explode]) lid_tile(tile) lid();
  translate([0, 0, z_floor+sled_pad]) pi_sled(sled);
  for (v=vents) vent_cap_placed(v);
  intake_cap_placed();
  %pi_stack(sled);
  %for (f=fans) fan_body(f);
  // ghosts (preview only): ball head + projector
  %translate([ped_x, ped_y, z_floor+ped_top]) cylinder(d=35, h=ball_head_h);
  %projector(aim[0], aim[1]);
}

// Insect-screen cap: a shallow box that seats on the wall/floor all round, screen glued inside the
// plate, two M2 screws through the tabs into bosses. Prints plate-down. Placed in local XY = the opening.
function cap_tab(o) = o[0]/2 + cap_t + 4;
module screen_cap(o) {
  difference() {
    union() {
      translate([-o[0]/2-cap_t, -o[1]/2-cap_t, 0]) cube([o[0]+2*cap_t, o[1]+2*cap_t, cap_h]);
      hull() for (sx=[-1,1]) translate([sx*cap_tab(o), 0, 0]) cylinder(d=7, h=cap_t);
    }
    translate([-o[0]/2, -o[1]/2, cap_t]) cube([o[0], o[1], cap_h]);            // open box
    translate([-o[0]/2+3, -o[1]/2+3, -1]) cube([o[0]-6, o[1]-6, cap_t+2]);      // window; 3 mm ledge for the screen
    for (sx=[-1,1]) translate([sx*cap_tab(o), 0, -1]) cylinder(d=2.4, h=cap_t+2);
  }
}

module vent_cap_placed(v) {   // plate faces into the case, box rim on the wall
  translate([v[0]*(inner_w/2-cap_h), v[1], v[2]]) rotate([0, v[0]*90, 0]) screen_cap(vent_open);
}
module intake_cap_placed() { translate([intake_c[0], intake_c[1], z_floor+cap_h]) mirror([0,0,1]) screen_cap(intake_open); }

// Fan body envelope, for clash checks and the preview
module fan_body(f) { translate([inner_w/2-4-10, f[0]-fan/2, f[1]-fan/2]) cube([10, fan, fan]); }

// IR LED holder for the projector-power fallback: sticks on with VHB tape near the projector's
// IR receiver, 5 mm LED aimed ir_angle off the pad's normal. Prints pad-down.
module ir_holder() {
  difference() {
    translate([-8, -8, 0]) cube([16, 16, 10]);
    translate([0, 0, 2]) rotate([ir_angle, 0, 0]) cylinder(d=5.2, h=30);
    translate([-1.5, -9, 1]) cube([3, 9, 3]);   // lead channel out the side, clear of the taped face
  }
}

// Pi + Amp4 envelope. Every generation sits with its GPIO edge at y_gpio, so the HAT lands in the
// same place; full-size boards' ports overhang the +X end by about 3 mm.
module pi_stack(s) {
  translate([-42.5, y_gpio-56, z_board]) cube([s == "zero2w" ? 65 : 88, 56, sled_stack(s)]);
}

// Removable Pi sled: lifts out from the top (lid off, shelf out), located by two floor pins and held
// by one M3 thumbscrew. One sled per Pi generation; the base doesn't change.
module pi_sled(s) {
  bd = sled_board(s);
  x0 = -42.5; y0b = y_gpio - bd[1];
  difference() {
    union() {
      translate([sled_x[0], y_gpio-59, 0]) cube([sled_x[1]-sled_x[0], 62, sled_t]);
      for (h=sled_holes(s)) translate([x0+h[0], y0b+h[1], 0]) cylinder(d=6, h=sled_t+sled_post);
      if (s == "zero2w")   // hold up the part of the Amp4 that overhangs the Zero
        for (hx=[3.5, 61.5]) translate([x0+hx, y_gpio-52.5, 0]) cylinder(d=6, h=sled_t+sled_post+zero_hat_z);
    }
    for (p=[sled_pts[0], sled_pts[1]]) translate([p[0], p[1], -1]) cylinder(d=4.4, h=sled_t+2);
    translate([sled_pts[2][0], sled_pts[2][1], -1]) cylinder(d=3.4, h=sled_t+2);
    for (h=sled_holes(s)) translate([x0+h[0], y0b+h[1], 0.6]) cylinder(d=2.2, h=20);   // M2.5 self-tap
    if (s == "zero2w") for (hx=[3.5, 61.5]) translate([x0+hx, y_gpio-52.5, 0.6]) cylinder(d=2.2, h=40);
    translate([-56, (sled_pts[0][1]+sled_pts[2][1])/2, sled_t-0.6]) rotate([0,0,90]) linear_extrude(1)
      text(sled_label(s), size=5, halign="center", valign="center");
  }
}

// Projector block panned (about Z) and tilted (about X, + = lens up) around the ball-head pivot
module projector(pan=0, tilt=0) {
  translate(pivot) rotate([0,0,pan]) rotate([-tilt,0,0]) translate(-pivot)
    translate([-proj_w/2, y0+front_gap, z_pj]) cube([proj_w, proj_d, proj_h]);
}

if (part == "assembly") assembly();
else if (part == "base") tile_cut(tile, base_seam) base_all();
else if (part == "lid") rotate([180,0,0]) rotate([lid_a,0,0]) lid_tile(tile) lid();
else if (part == "window_frame") rotate([90,0,0]) window_frame();
else if (part == "pedestal") pedestal();
else if (part == "power_shelf") power_shelf();
else if (part == "hatch_cover") rotate([180,0,0]) hatch_cover();
else if (part == "ir_holder") ir_holder();
else if (part == "vent_cap") screen_cap(vent_open);
else if (part == "intake_cap") screen_cap(intake_open);
else if (part == "sled") translate([0, -pi_cy, 0]) pi_sled(sled);
