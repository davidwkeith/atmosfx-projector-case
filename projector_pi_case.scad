// Ground-standing projector + Raspberry Pi 3 case: rain-proof (not sealed), ventilated
// v0.9 - the stock supply is a wall-wart, so the shelf grew a receptacle plate: two panel-mount NEMA 5-15R stacked,
//        the stock 21 V wall-wart below and a second (Pi, DigiAMP+, fans) above, hanging on their prongs; the AC gland
//        moved beside the plate, next to the left wall; Pi zone 85 deep; the fit coupon has the receptacle cutout
// v0.8 - AC gland moved above the shelf (AC side of the barrier); barrier clears the brick; keyholes lift off;
//        45 deg scarf joint at the lid seam; flat gasket land under the sloped roof;
//        audio: Raspberry Pi DigiAMP+ HAT on the Pi (also powers it), speaker wire out through a floor chimney;
//        Pi rides on a removable sled (Pi 3B/3B+, 4B, 5, Zero 2 W), shelf raised to clear the Pi 5 stack;
//        PIR motion sensor in the rear wall under a rain hood, for startle scares
// v0.7 - ONE AC cord in (rear gland) -> DC brick INSIDE on the power shelf, walled off from the low-voltage side;
//        a wire splice feeds the projector's barrel plug and the DigiAMP+ HAT (which powers the Pi).
// v0.4 - quick-aim hatch on the left (-X) wall: reach the ball head with the lid on, tool-free
// sized for a ~171x134x75 mm mini projector (0.72 kg) on an internal ball head
// Print PETG/ASA. Lid prints roof-down. Base+lid split front/rear (MK3S bed 250x210x210); front pieces lie flat with X along the 250 mm axis.

/* [Part] */
part = "assembly"; // [assembly, base, lid, window_frame, pedestal, hatch_cover, power_shelf, sled, ir_holder, vent_cap, intake_cap, fit_coupon]
sled = "pi3";      // [pi3, pi4, pi5, zero2w] sled shown in the assembly / exported by part="sled"
tile = "all";      // [all, front, rear] for base+lid
explode = 0;       // [0:1:80]
aim = [0, 0];      // [pan, tilt] deg of the ghost projector in the assembly preview

/* [Projector (mm)] */
// Verified 2026-10-05 from the projector's EDID (read on a Mac, docs/BRINGUP.md "Verified so far"):
// generic STK "S2-TEK TV" block (product 0x531A, dated 2014), HDMI input with CEC physical address 2.0.0.0,
// native 1080p60 (VIC 16), 8-bit only, TMDS <= 150 MHz, 2-ch LPCM audio, DPMS standby/active-off flagged.
// CEC itself is NOT proven (the address field is mandatory for any HDMI sink): see BRINGUP row 9.
// The EDID says nothing about size, lens or ports: those come from docs/measurements.xlsx (see below).
proj_w = 165;   // width (X): Tkisko TO2 manual says 6.5 x 5 x 2.6 in, lens on the 6.5 in face; confirm with calipers
proj_d = 130;   // depth (Y), lens faces front: measured 130.0 with calipers
proj_h = 66;    // height (Z)
lens_x = -20;   // lens offset from centre (+ = right): estimated from the product photo, measure it
lens_z = 33;    // lens centre height above projector underside: estimated from the product photo, measure it
throw_ratio = 0.95; // throw distance / image width: from the manual's image sizes (36 in at 2.5 ft, 72 in at 5 ft); measure it
aspect = 16/9;
port_depth = 15;    // HDMI + power plugs on the projector's rear face: right-angle plugs with slack (a straight HDMI plug needs ~40)
port_band = [15, 55];   // plug height range above the projector underside (guess: check yours)
lens_offset = 0;    // vertical image offset: 0 = image centred on the lens axis, 1 = image bottom on the axis
pane_w = 127;   // acrylic pane: 4 x 5 in (127 x 101.6 mm), a stock size; the window opening is the pane minus lap
pane_h = 101.6;
pane_top_clear = 7;  // pane top this far below the base rim: the window sits as high as it can, for upward tilt
mount_x = 19;   // 1/4-20 socket offset from projector centre (+ = right): scaled off the underside photo, measure it
mount_y = -4;   // + = toward rear: scaled off the underside photo, measure it

/* [Ball head] */
ball_head_h = 40;  // height of your ball head, base to mounting stud
pivot_h = 25;      // ball centre above the head's base (aim pivot)
aim_max = 15;      // tilt range the case must clear (check_clash.sh sweeps it)
pan_max = 10;      // pan range the case must clear: the light cone clips the window frame past this at throw_ratio 0.95 (turn the case for more)
cone_tilt = 12;     // light-cone check: the image must clear the window, frame and visor at +/- this tilt
aim_combo = 8;     // tilt while panned by pan_max (corners): the rear plugs reach the divider past this; more would lengthen base_front past the 210 mm bed axis
ped_top = 30;      // pedestal top height above floor
insert_d = 8.2;    // 1/4-20 heat-set insert hole; check your insert's datasheet
insert_len = 9;

/* [Enclosure] */
wall = 3;
floor_t = 6;
foot_h = 6;        // ground clearance so rain drains out underneath
foot_ribs = [-88, -68, -40, -15, 15, 40, 68, 88];   // inner front-to-back ribs; two more run under the side walls. Floor bridges <= max_bridge (asserted); channels drain/vent/route wires
rib_t = 4;
layer_h = 0.2;     // print layer height: gap above the window's snap-out ribs
clearance = 0.3;
side_air = 25;     // gap each side of projector: clears +/-10 deg pan with the fan body (14 mm) in the gap
top_air  = 25;
front_gap = 30;      // lens-down tilt swings the top front corner forward (more so panned, now the body is 165 wide); aim-sweep and light-cone checks size this
rear_gap  = 34;      // lens-up tilt swings the rear plugs back (port_depth) toward the divider; aim-sweep sizes this
pi_zone_d = 85;    // Pi compartment depth: the wall-warts hang 68 off the rear wall (rcpt_back + plate + wart_t, asserted) and the shelf's low-voltage side needs wiring room
pane_t = 3.2;      // acrylic thickness (1/8 in); photo-frame glazing is often thinner
lap = 8;           // pane overlap past the window opening
boss_h = 4;

/* [Aim hatch (-X wall)] */
hatch = 108;         // diamond opening, tip to tip: reach in to loosen/aim the ball head (45 deg edges print unsupported); its hood must clear the lid skirt
hatch_flange = 10;   // cover overlap past the diamond's tips
hatch_zc = 56;       // opening centre height above floor: lower tip just above the floor, hood under the lid skirt (cover must lift kh_drop under the hood)
stud_off = 56;       // M4 stud spacing from opening centre
kh_drop = 8;         // keyhole slide distance: cover lifts this much to come off
m4_insert_d = 5.6;   // M4 heat-set insert hole; check your insert
hood_d = 10;         // rain hood depth over the hatch (must stay below the lid skirt)
cover_gasket = 1.5;  // foam tape thickness
hatch_lock = true;   // optional M3 (security) screw through the cover's bottom edge: stops it lifting off its keyholes

/* [Power] */
shelf_z = 60;       // power shelf height above floor: clears the tallest sled stack (asserted)
ledge_w = 9;        // shelf ledge on the side walls
tie_gap = 34;       // zip-tie slot spacing across the shelf (module sits between)
cord_x = -94;       // where the single AC cord enters the rear wall: AC side, in the corner between the left wall and the receptacle plate (asserted)
cord_dz = 20;       // gland centre above the shelf's top face: level with the lower receptacle's spade terminals, below the lid skirt (asserted)
// Stock supply (label, 2026-10-05): wall-wart MX48CC-210228US, in AC 100-240 V 1.0 A, out 21 V 2.28 A (48 W), centre +,
// fixed 2-pin NEMA 1-15 prongs and a captive DC cord: no AC inlet. It plugs into a panel-mount NEMA 5-15R on the shelf's
// receptacle plate and hangs on its prongs, standing on its long edge: length along X (cord end toward the barrier),
// width = height above the shelf, thickness along Y. A second wall-wart (12-24 V rail for the Pi, DigiAMP+ and fans) plugs in above it.
wart_l = 86;        // stock wall-wart length (X): measured 85.6
wart_w = 47;        // width = standing height (Z): scaled off the photo against the caliper reading; confirm (the stack is asserted against the lid roof)
wart_t = 35;        // thickness, prong face to back (Y): not measured yet
wart_prong = 15;    // prong centre from the wart's wall end (X), centred across the width: from the photo
wart2 = [86, 47, 35];   // second wall-wart [length, width, thickness], same orientation: measure the one you buy
rcpt_cut = [26, 22];    // NEMA 5-15R snap-in panel cutout [X, Z]: Qualtek 738W-X2/01 is 26 x 22 in a 0.8-2 mm panel; check yours on the fit coupon
rcpt_t = 2;             // plate thickness at the cutout, inside the snap-in's panel range
rcpt_hole_sp = 0;       // flanged receptacles: M3 pilot spacing across the cutout (0 = none)
rcpt_back = 30;         // plate stand-off from the rear wall: receptacle body, 4.8 mm spades and the cord
barrier_h = 50;         // AC/low-voltage barrier above the shelf; must exceed the lower wall-wart's height

/* [Audio] */
spk_x = 58;         // speaker-wire chimney: beside the Pi's USB end, clear of the drains
spk_d = 12;         // bore: two runs of 16 AWG zip cord
spk_collar = 15;    // chimney height above the floor, so floor water can't reach the bore
pi_stack_h = 40;    // Pi 3/4: board bottom to top of the DigiAMP+ HAT (assumption: check yours)
pi5_stack_h = 50;   // Pi 5 with Active Cooler under the HAT (taller header)
zero_stack_h = 30;  // Zero 2 W + DigiAMP+
zero_hat_z = 13;    // Zero 2 W: HAT underside above the Zero's board bottom (sets the HAT support posts)

/* [Motion sensor (rear wall)] */
pir = true;         // HC-SR501-style PIR looking out the rear wall, toward people approaching
pir_x = 55;         // low-voltage side, clear of the barrier and the rear lid screw block
pir_dz = 45;        // dome centre above the shelf's top face
pir_dome_d = 23.5;  // lens dome; check yours
pir_hole_sp = 28.7; // board mounting holes (M2), check yours
pir_stand = 3;      // lens frame thickness: board sits this far off the wall

/* [Projector power fallback] */
ir_angle = 30;      // IR LED tilt in the stick-on holder

/* [Base seam] */
collar_t = 6;        // screw collars on the rear tile's side walls, just behind the divider
collar_d = 10;
seam_screw_z = [10, 42];   // M3 screws through the divider into the collars, above the floor

/* [Ground anchors] */
stakes = true;       // sealed stake tubes inside the four corners: drive tent stakes from inside, lid on = can't pull them
stake_d = 9;         // bore for 8 mm tent stakes / 1/4 in pins
stake_collar = 15;   // tube rises this far above the floor so water can't reach the bore
stake_x = 78;        // inside the channel between the +/-68 and +/-88 ribs

/* [Tripod mount] */
tripod = true;
tripod_y = 5;        // 3/8-16 insert at the estimated centre of mass: part centroids x slicer weights, plus projector 0.72 kg,
                     // ball head 0.1, two wall-warts 0.4, Pi + amp 0.12 (about 2.6 kg in all). Re-measure once built.
tripod_y2 = -25;     // 1/4-20 insert for smaller heads / quick-release plates
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
hdmi_plug = [22, 45, 13];   // straight HDMI plug at the Pi, with strain relief: [width, length, height] (check_clash.sh keep-out)
pass_x = [-40, 25];         // divider pass-through, left/right edge: spans every board's HDMI port

/* [Printer] */
bed = [250, 210, 210];   // print volume; every tile is asserted to fit (either way round)
max_bridge = 30;         // longest unsupported bridge under the floor

/* [Hardware] */
gland_d = 15.5;    // PG9 mains-rated cord grip for the single AC cord
fan = 40;           // 40 x 40 x 10 mm 24 V 4-pin PWM fans on the second wall-wart's 24 V rail (Pi-controlled; 12 V parts would burn)
pi_fan_dz = 28;     // Pi-zone exhaust fan centre above the shelf's top face

/* [Lid] */
lid_clr = 0.6;
skirt_h = 22;
top_t = 3;
rise = 12;         // roof slope, drains to rear
visor_len = 30;     // longer visors and deeper lips cut into upward-tilted light (see light-cone check)
lid_front_len = 200; // front lid tile, visor tip to seam: base_front and lid_front print end-on, depth along the bed's 210 mm axis (asserted)
lip_h = 4;          // drip lip at the visor tip
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
ribs_x = concat([-(out_w-rib_t)/2], foot_ribs, [(out_w-rib_t)/2]);   // outer ribs sit under the side walls: no floor past them
assert(max([for (i=[1:len(ribs_x)-1]) ribs_x[i]-ribs_x[i-1]-rib_t]) <= max_bridge, "floor bridge too long: add or move foot_ribs");
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
win_zc = base_h - pane_top_clear - pane_h/2;   // window/pane centre height (above the lens: tilting up is the main use)
win_w = pane_w - 2*lap;                   // clear opening for the light cone
win_h = pane_h - 2*lap;
frame_t = 4;
pi_cy = (y_pi0 + y_back)/2;
cover_s = hatch + 2*hatch_flange;
hatch_zz = z_floor + hatch_zc;
hatch_y = proj_cy;
hood_lift = hood_d - cover_gasket + 0.5 + kh_drop + 1;   // room to lift the cover off its keyholes
fan_z = z_pj + proj_h/2;
lid_screw_ys = [y0 + 10, y_back - 8];     // lid screw stations: side screws through the skirt, none in the roof; front block (y-5) stays behind the window frame (y0..y0+frame_t)
lid_screw_z = base_h - 7;
base_seam = y_div + div_t + 0.01;
shelf_zz = z_floor + shelf_z;
pi_fan_z = shelf_zz + 3 + pi_fan_dz;
fans = [[proj_cy, fan_z], [pi_cy, pi_fan_z]];
stake_pts = [for (sx=[-1,1], y=[y0+12, y_back-12]) [sx*stake_x, y]];
vents = [[-1, pi_cy, z_floor+24], [-1, pi_cy, shelf_zz+26], [1, pi_cy, z_floor+24]];   // passive louver banks [side, y, centre z]
vent_open = [26, 42];                      // louver bank opening a wall cap covers (Z, Y); tabs go top/bottom (clear driver access)
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
function sled_hdmi_x(s) = s == "pi3" ? 32 : s == "zero2w" ? 12.4 : 26;   // HDMI (HDMI0) centre from the board's SD-card end
assert(z_board + max([for (s=SLEDS) sled_stack(s)]) + 1 <= shelf_zz, "raise shelf_z: a sled stack hits the shelf");
shelf_w = inner_w - 1;
shelf_d = pi_zone_d - 1;
plate_x0 = -shelf_w/2 + 27;                // receptacle plate's left edge: room for the gland's locknut between it and the left wall
plate_w = 50;
prong_x = plate_x0 + plate_w/2;            // receptacle centres (both stacked here)
wart_x0 = prong_x - wart_prong;            // the wall-warts' wall end
bar_x = wart_x0 + max(wart_l, wart2[0]) + 6;   // barrier between the AC side and the low-voltage side
rcpt_zc = [3 + wart_w/2, 3 + wart_w + 2 + wart2[1]/2];   // receptacle centres above the shelf bottom: stock wart on the shelf, second one above it
plate_y1 = shelf_d - rcpt_back;            // plate's rear (terminal) face, shelf coordinates
plate_y0 = plate_y1 - 3;                   // plate's front face: the warts hang here

lid_w = out_w + 2*(lid_clr + wall);
lid_d = out_d + 2*(lid_clr + wall);
lid_a = atan(rise/lid_d);
yfl = -lid_d/2;
lid_seam = yfl - visor_len + lid_front_len;
seam_t = top_t + seam_rib;                // roof thickness across the scarf
pivot = [ped_x, ped_y, z_floor + ped_top + pivot_h];
assert(barrier_h > wart_w, "barrier_h must exceed the lower wall-wart's height (wart_w)");
lid_z0 = base_h + gasket - (skirt_h - top_t);
assert(cord_x - gland_d/2 - 4 >= -shelf_w/2 && cord_x + gland_d/2 + 4 <= plate_x0, "move cord_x: the gland and its locknut must sit between the left wall and the receptacle plate");
assert(cord_dz - gland_d/2 - 4 >= 3, "raise cord_dz: the gland's locknut lands on the shelf");
assert(rcpt_back + 3 + max(wart_t, wart2[2]) + 6 <= shelf_d, "deepen pi_zone_d: the wall-warts hang past the divider end of the shelf");
assert(shelf_zz + rcpt_zc[1] + wart2[1]/2 + 2 <= base_h + gasket - 1, "the wall-wart stack hits the lid roof: raise top_air (or lower shelf_z)");
assert(bar_x + 60 <= shelf_w/2, "the shelf's low-voltage side is too narrow for the splice and fuses: shorter wall-warts or a wider case");
assert(shelf_zz + 3 + cord_dz + gland_d/2 + 6 <= lid_z0, "lower cord_dz: the gland runs into the lid skirt");
assert(pane_top_clear >= pane_t + clearance + 2.5, "raise pane_top_clear: the rebate's 45 deg ceiling would cut through the base rim");

// Every tile must fit the bed, either way round. These fire when the projector parameters grow the case.
function fits_bed(x, y, z) = z <= bed[2] && ((x <= bed[0] && y <= bed[1]) || (x <= bed[1] && y <= bed[0]));
base_front_len = base_seam - y_front;
assert(fits_bed(base_front_len, out_w + hood_d, base_h), str("base_front is ", base_front_len, " x ", out_w + hood_d, " x ", base_h,
  " mm, too big for the bed: trim front_gap / rear_gap / side_air / top_air, or it needs another split"));
assert(fits_bed(out_w, out_d/2 - base_seam + (pir ? hood_d : 0), base_h), "base_rear does not fit the bed");
assert(fits_bed(lid_seam + seam_t - (yfl - visor_len), lid_w, skirt_h + rise + lip_h), "lid_front does not fit the bed");
assert(fits_bed(lid_d/2 - lid_seam + skirt_h + rise, lid_w, skirt_h + rise), "lid_rear does not fit the bed: the lid needs a third tile");
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
  // trapezoid, sloped edge on the right: the old parallelogram crossed itself once c went negative (CGAL rejects that)
  module front_region() rotate([90,0,90]) linear_extrude(big, center=true)
    polygon([[-3*big, -big], [c-big, -big], [c+big, big], [-3*big, big]]);
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
  translate([lens_x-win_w/2, y_front-1, win_zc-win_h/2]) cube([win_w, fw+2, win_h]);
  translate([lens_x-(pane_w+2*clearance)/2, y0-pane_t-0.4, win_zc-(pane_h+2*clearance)/2])
    cube([pane_w+2*clearance, pane_t+0.5, pane_h+2*clearance]);
  zt = win_zc + (pane_h+2*clearance)/2;   // 45 deg rebate ceiling: a flat one is an unsupported edge as wide as the pane
  translate([lens_x-(pane_w+2*clearance)/2, 0, 0]) rotate([90,0,90]) linear_extrude(pane_w+2*clearance)
    polygon([[y0-pane_t-0.4, zt-0.01], [y0+0.1, zt-0.01], [y0+0.1, zt+pane_t+0.5]]);
  for (sx=[-1,1], sz=[-1,1])   // frame screws on the sides, so the frame hugs the pane top and bottom
    translate([lens_x+sx*(pane_w/2+8), y0+0.1, win_zc+sz*pane_h/4])
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
  // (the upper -X bank is intake across the wall-warts to the Pi-zone fan)
  for (v=vents) translate([v[0]*(out_w/2-wall/2), v[1], v[2]-8]) louvers(40, 3, 8, v[0]);
  // screen-cap screw pilots (M2 self-tap)
  for (v=vents, sy=[-1,1]) translate([v[0]*(inner_w/2+2), v[1], v[2]+sy*cap_tab(vent_open)]) rotate([0, -v[0]*90, 0]) cylinder(d=1.8, h=cap_h+2);
  for (sx=[-1,1]) translate([intake_c[0]+sx*cap_tab(intake_open), intake_c[1], z_floor-2]) cylinder(d=1.8, h=cap_h+2.1);
  // fan screw pilots
  for (f=fans, sy=[-16,16], sz=[-16,16])
    translate([inner_w/2-4.1, f[0]+sy, f[1]+sz]) rotate([0,90,0]) cylinder(d=2.6, h=6);
  // single power-cord gland (rear wall, above the shelf, AC side of the barrier)
  translate([cord_x, y_back-1, shelf_zz+3+cord_dz]) rotate([-90,0,0]) cylinder(d=gland_d, h=wall+2);
  // divider pass-through (HDMI + projector power). Open down to the sled: the Pi's HDMI edge sits about 10 mm
  // behind the divider, so the plug goes straight through and the cable loops under the projector
  translate([0, y_div+div_t+1, 0]) rotate([90,0,0]) linear_extrude(div_t+2)   // gabled top prints unsupported
    polygon([[pass_x[0], z_floor+sled_pad], [pass_x[1], z_floor+sled_pad], [pass_x[1], shelf_zz+23],
             [(pass_x[0]+pass_x[1])/2, shelf_zz+23+(pass_x[1]-pass_x[0])/2], [pass_x[0], shelf_zz+23]]);
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
  // seam screws: clearance through the divider, pilots in the collars
  for (sx=[-1,1], z=seam_screw_z) {
    translate([sx*(inner_w/2-collar_t/2), y_div-1, z_floor+z]) rotate([-90,0,0]) cylinder(d=3.4, h=div_t+1.1);
    translate([sx*(inner_w/2-collar_t/2), y_pi0-0.1, z_floor+z]) rotate([-90,0,0]) cylinder(d=2.6, h=collar_d-1);
  }
  if (stakes) for (p=stake_pts) translate([p[0], p[1], -1]) cylinder(d=stake_d, h=z_floor+stake_collar+2);
  // hatch lock pilot: into the solid wall/floor corner below the hatch
  if (hatch_lock) translate([-out_w/2-0.1, hatch_y, hatch_zz-cover_s/2+5]) rotate([0,90,0]) cylinder(d=2.6, h=10);
  // tripod inserts, from below
  if (tripod) {
    translate([0, tripod_y, -1]) cylinder(d=insert38_d, h=insert38_len+1);
    translate([0, tripod_y2, -1]) cylinder(d=insert_d, h=insert_len+1);
  }
  // sled thumbscrew insert
  translate([sled_pts[2][0], sled_pts[2][1], z_floor+sled_pad-6]) cylinder(d=m3_insert_d, h=6.1);
  // lid screw pilots (horizontal, through the side walls into the blocks)
  for (sx=[-1,1], y=lid_screw_ys) translate([sx*(out_w/2+0.1), y, lid_screw_z]) rotate([0, -sx*90, 0]) cylinder(d=2.6, h=wall+8-1);
}

module base_all(ribs=true) {
  difference() {
    union() {
      difference() {
        translate([-out_w/2, y_front, foot_h]) cube([out_w, out_d, base_h-foot_h]);
        translate([-inner_w/2, y0, z_floor]) cube([inner_w, inner_d, inner_h+1]);
      }
      for (v=vents, sy=[-1,1])   // screen-cap bosses
        translate([v[0]*(inner_w/2+0.1), v[1], v[2]+sy*cap_tab(vent_open)]) rotate([0, -v[0]*90, 0]) cylinder(d=6, h=cap_h-cap_t+0.1);
      for (sx=[-1,1]) translate([intake_c[0]+sx*cap_tab(intake_open), intake_c[1], z_floor-0.1]) cylinder(d=6, h=cap_h-cap_t+0.1);
      for (sx=[-1,1])   // seam collars (rear tile); stop below the shelf ledges
        translate([sx > 0 ? inner_w/2-collar_t : -inner_w/2, y_pi0-0.01, z_floor-0.1])
          cube([collar_t, collar_d, shelf_zz-ledge_w-3-z_floor+0.1]);
      if (stakes) for (p=stake_pts) translate([p[0], p[1], z_floor-0.1]) cylinder(d=stake_d+5, h=stake_collar+0.1);
      if (tripod) {   // pad flush with the rib bottoms, plus a boss inside so the 3/8 insert has room
        hull() for (y=[tripod_y, tripod_y2]) translate([0, y, 0]) cylinder(d=30, h=foot_h+0.1);
        translate([0, tripod_y, z_floor-0.1]) cylinder(d=18, h=insert38_len+2-z_floor+0.1);   // 2 mm above the insert
      }
      for (x=ribs_x) translate([x-rib_t/2, y_front, 0]) cube([rib_t, out_d, foot_h+0.1]);   // feet
      translate([-inner_w/2, y_div, z_floor-0.1]) cube([inner_w, div_t, base_h-z_floor+0.1]);   // divider
      for (sx=[-1,1], sy=[-1,1]) translate([ped_x+sx*35, ped_y+sy*25, z_floor-0.1]) cylinder(d=9, h=boss_h+0.1);
      for (sx=[-1,1], y=lid_screw_ys) hull() {   // lid screw blocks inside the wall tops, 45 deg underside
        translate([sx > 0 ? inner_w/2-8 : -inner_w/2, y-5, base_h-14]) cube([8.1, 10, 14]);
        translate([sx > 0 ? inner_w/2-0.1 : -inner_w/2, y-5, base_h-22]) cube([0.1, 10, 0.1]);
      }
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
  if (ribs) for (sx=[-1,1]) translate([lens_x+sx*win_w/6-0.4, y_front, win_zc-win_h/2-0.1])
    cube([0.8, fw-pane_t-0.5, win_h-layer_h+0.1]);
}

// 45-degree gusset ledge on the side wall that carries the power shelf
module ledge(sx) {
  translate([sx*inner_w/2, y_pi0+0.05, shelf_zz]) rotate([90,0,0]) mirror([0,0,1])
    linear_extrude(pi_zone_d-0.05) polygon([[0,0],[-sx*ledge_w,0],[sx*0.1,-ledge_w-0.1]]);
}

// Power shelf above the Pi. AC side (left of the barrier): a plate near the rear wall carries two panel-mount NEMA 5-15R
// receptacles, one above the other; the wall-warts plug in facing the divider and stand on their long edges, the stock one
// on the shelf and the second on top of it. Spade terminals and the cord from the gland sit behind the plate.
// Low-voltage side (right): each wart's DC cord comes through the barrier notch to its fused splice; feeds run down to the DigiAMP+.
module power_shelf() {
  bar = bar_x;
  py1 = plate_y1;
  py0 = plate_y0;
  plate_h = rcpt_zc[1] + rcpt_cut[1]/2 + 7;
  gus = 20;                          // 45 deg gussets behind the plate's ends
  difference() {
    union() {
      translate([-shelf_w/2, 0, 0]) cube([shelf_w, shelf_d, 3]);
      translate([plate_x0, py0, 2.9]) cube([plate_w, 3, plate_h]);             // receptacle plate
      for (x=[plate_x0, plate_x0+plate_w-3]) translate([x, py1-0.1, 2.9]) rotate([90,0,90])
        linear_extrude(3) polygon([[0,0],[gus,0],[0,gus]]);
      translate([bar, 0, 2.9]) cube([2.4, shelf_d, barrier_h]);                // barrier
    }
    for (z=rcpt_zc) {                                                          // receptacle cutouts, thinned to rcpt_t from the terminal side for the snap-in clips
      translate([prong_x-rcpt_cut[0]/2, py0-1, z-rcpt_cut[1]/2]) cube([rcpt_cut[0], 5, rcpt_cut[1]]);
      translate([prong_x-rcpt_cut[0]/2-4, py0+rcpt_t, z-rcpt_cut[1]/2-4]) cube([rcpt_cut[0]+8, 5, rcpt_cut[1]+8]);
      if (rcpt_hole_sp > 0) for (sx=[-1,1]) translate([prong_x+sx*rcpt_hole_sp/2, py0-1, z]) rotate([-90,0,0]) cylinder(d=2.6, h=5);
    }
    translate([bar-1, shelf_d/2-10, 2.9]) cube([4.4, 20, 30]);                 // notch: both DC cords cross to the low-voltage side
    for (x=[wart_x0+55, wart_x0+75], y=[py0-max(wart_t, wart2[2])-4, py0+1])  // velcro strap slots round the warts, past the plate's end
      translate([x-10, y, -1]) cube([20, 3, 5]);
    for (x=[-70:20:70], sy=[-1,1]) if (x > bar+6) translate([x-1.6, shelf_d/2+sy*tie_gap/2-3, -1]) cube([3.2, 6, 5]);   // zip-tie slots (low-voltage side)
    for (x=[40, 60, 80]) translate([x-2.5, shelf_d/2-13, -1]) cube([5, 26, 5]);   // vents: Pi/amp heat rises to the Pi-zone fan (low-voltage side only)
    translate([pir_x-6, shelf_d-7, -1]) cube([12, 8, 5]);                     // PIR / low-voltage wires down to the Pi
  }
}

// Wall-wart envelopes hanging on the receptacle plate (shelf coordinates): preview ghost and clash keep-out
module warts() {
  translate([wart_x0, plate_y0-wart_t, 3]) cube([wart_l, wart_t, wart_w]);
  translate([wart_x0, plate_y0-wart2[2], rcpt_zc[1]-wart2[1]/2]) cube([wart2[0], wart2[2], wart2[1]]);
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
    if (hatch_lock) translate([0, -cover_s/2+5, -5]) cylinder(d=3.4, h=9);   // lock screw, through the vertical rib
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
      for (sx=[-1,1], y=lid_screw_ys)   // spacer rings: the skirt bears on the base wall instead of flexing in
        translate([sx*out_w/2, y, lid_screw_z-lid_z0+1]) rotate([0, sx*90, 0]) cylinder(d=8, h=lid_clr+0.1);
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
    // notch the front skirt over the window so upward-tilted light clears it (the visor still shelters it)
    translate([lens_x-(win_w+20)/2, yfl-1, -1]) cube([win_w+20, lid_d/2-out_d/2-lid_clr+1.01, skirt_h-top_t+1]);
    for (sx=[-1,1], y=lid_screw_ys)   // side screw slots: press the lid onto the gasket, then tighten
      hull() for (dz=[-0.5, 1.5]) translate([sx*(out_w/2-1), y, lid_screw_z-lid_z0+dz]) rotate([0, sx*90, 0]) cylinder(d=3.4, h=wall+lid_clr+3);
  }
}

module window_frame() {
  difference() {
    translate([-(pane_w+32)/2, 0, -(pane_h+12)/2]) cube([pane_w+32, frame_t, pane_h+12]);
    translate([-(win_w+8)/2, -1, -(win_h+8)/2]) cube([win_w+8, frame_t+2, win_h+8]);
    for (sx=[-1,1], sz=[-1,1]) translate([sx*(pane_w/2+8), -1, sz*pane_h/4]) rotate([-90,0,0]) cylinder(d=3.4, h=frame_t+2);
  }
}

module assembly() {
  tile_cut(tile, base_seam) base_all();
  translate([ped_x, ped_y, z_floor+boss_h]) pedestal();
  translate([0, y_pi0+0.3, shelf_zz]) power_shelf();
  %translate([0, y_pi0+0.3, shelf_zz]) warts();
  translate([lens_x, y0, win_zc]) window_frame();
  translate([-out_w/2-cover_gasket-3, hatch_y, hatch_zz]) rotate([90,0,90]) hatch_cover();
  translate([0, 0, lid_z0 + explode]) lid_tile(tile) lid();
  translate([0, 0, z_floor+sled_pad]) pi_sled(sled);
  for (v=vents) vent_cap_placed(v);
  intake_cap_placed();
  %pi_stack(sled);
  %pi_hdmi_plug(sled);
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

// Fit-test coupon: every critical hole, the keyhole and the pane slot in one short print.
// Holes are made with the same parameters as the real parts, so tune them here first.
module fit_coupon() {
  holes = [[insert38_d, "3/8", insert38_len+2], [insert_d, "1/4", insert_len+2], [m4_insert_d, "M4i", 10],
           [m3_insert_d, "M3i", 8], [gland_d, "PG9", 3], [3.4, "M3", 3], [2.6, "M3p", 8], [2.2, "M2.5p", 7], [1.8, "M2p", 6]];   // [d, label, boss height]
  difference() {
    union() {
      cube([118, 30, 2]);                                             // strip under the holes
      translate([0, 30, 0]) cube([30, 32, 3]);                        // keyhole tab, cover thickness
      for (i=[0:len(holes)-1]) translate([8 + i*12.5, 15, 0]) cylinder(d=holes[i][0]+5, h=holes[i][2]);   // a boss per hole
      translate([96, -12, 0]) cube([22, 12, 10]);                     // pane slot block
      translate([34, 30, 0]) cube([rcpt_cut[0]+14, 32, rcpt_t]);       // receptacle tab, plate thickness at the cutout
    }
    translate([41, 35, -1]) cube([rcpt_cut[0], rcpt_cut[1], 5]);        // NEMA 5-15R snap-in cutout
    translate([41+rcpt_cut[0]/2, 35+rcpt_cut[1]+2.5, rcpt_t-0.6]) linear_extrude(1) text("5-15R", size=2.4, halign="center");
    for (i=[0:len(holes)-1]) {
      x = 8 + i*12.5;
      translate([x, 15, holes[i][2] > 3 ? 1.2 : -1]) cylinder(d=holes[i][0], h=20);   // blind (1.2 mm floor) except the through-holes
      translate([x, 25, 1.4]) linear_extrude(1) text(holes[i][1], size=2.4, halign="center");
    }
    translate([15, 52, -1]) hull() { cylinder(d=4.8, h=5); translate([0, -kh_drop, 0]) cylinder(d=9, h=5); }   // keyhole
    translate([105, -13, 3]) cube([pane_t+0.5, 14, 8]);   // acrylic slot: same width as the pane rebate
  }
}

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

// Pi + DigiAMP+ envelope. Every generation sits with its GPIO edge at y_gpio, so the HAT lands in the
// same place; full-size boards' ports overhang the +X end by about 3 mm.
module pi_stack(s) {
  translate([-42.5, y_gpio-56, z_board]) cube([s == "zero2w" ? 65 : 88, 56, sled_stack(s)]);
}

// Keep-out for a straight HDMI plug in the Pi, running forward through the divider pass-through
module pi_hdmi_plug(s) {
  translate([-42.5+sled_hdmi_x(s)-hdmi_plug[0]/2, y_gpio-sled_board(s)[1]-hdmi_plug[1], z_board+1.6+3.2-hdmi_plug[2]/2])
    cube(hdmi_plug);
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
      if (s == "zero2w")   // hold up the part of the DigiAMP+ that overhangs the Zero
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

// Light leaving the lens (a pyramid 400 mm long), in the same pose as projector(pan, tilt).
// Anything it touches (window edge, frame, visor) would clip the image.
module light_cone(pan=0, tilt=0, len=400) {
  hw = len / (2*throw_ratio); hh = hw / aspect;
  zc = lens_offset * hh;        // image centre above the axis
  lens = [lens_x, y0+front_gap-0.1, z_pj+lens_z];
  translate(pivot) rotate([0,0,pan]) rotate([-tilt,0,0]) translate(-pivot) translate(lens)
    polyhedron(points=[[0,0,0], [-hw,-len,zc-hh], [hw,-len,zc-hh], [hw,-len,zc+hh], [-hw,-len,zc+hh]],
               faces=[[0,2,1], [0,3,2], [0,4,3], [0,1,4], [1,2,3,4]]);
}

// Keep-out for the plugs behind the projector, in the same pose
module projector_ports(pan=0, tilt=0) {
  translate(pivot) rotate([0,0,pan]) rotate([-tilt,0,0]) translate(-pivot)
    translate([-45, y0+front_gap+proj_d, z_pj+port_band[0]]) cube([90, port_depth, port_band[1]-port_band[0]]);
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
else if (part == "fit_coupon") fit_coupon();
else if (part == "vent_cap") screen_cap(vent_open);
else if (part == "intake_cap") screen_cap(intake_open);
else if (part == "sled") translate([0, -pi_cy, 0]) pi_sled(sled);
