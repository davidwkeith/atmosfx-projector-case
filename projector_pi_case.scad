// Ground-standing projector + Raspberry Pi 3 case: rain-proof (not sealed), ventilated
// v0.17 - rib feet (rib_foot_w, rib_foot_t): every foot rib flares to 10 mm on the bed with a 45 deg chamfer up to the 4 mm rib (outer ribs flare inward only), after base_front's corners lifted 6 mm
// v0.16 - base tiles back to 0.20 mm layers (layer_h 0.3 -> 0.2: window-rib gap, floor-hole skin) after a 0.30 base_rear split above the floor; ear_layers 2 -> 3 keeps the ears 0.6 mm
// v0.15 - window ribs 0.8 -> 4 mm thick (win_rib_t): PrusaSlicer flagged the 73 mm tall 0.8 mm ribs as a thin fragile part; cut them out after printing
// v0.14 - PIR hood raised: its 45 deg underside started 6 mm below the top of the dome, so the dome could not pass through (found by the new pir clash pair);
//         amp_dc_plug() keep-out (the DigiAMP+'s jack faces the divider: leg 2 takes a right-angle adapter);
//         pir_sensor(), ac_cord() and pi_wiring() ghosts for the assembly preview; assembly steps (step, step_pull) for docs/ASSEMBLY.md
// v0.13 - sacrificial skin (hole_skin) over the floor holes: drains, speaker chimney and stake bores start one layer above the floor's underside
//         so its first bridge layer is solid (PrusaSlicer flagged the hole rims as floating bridge anchors); punch it out after printing
// v0.12 - mouse ears (ears, ear_d, ear_layers) on both base tiles' foot-rib ends (the base stands on ten 4 mm ribs, and base_rear's edge lifted)
//         and on the lid tiles' roof corners and the hatch cover's corners.
// v0.11 - Pi sled fan: an upright plate on the Pi 3/4 sleds for a 30 mm 5 V fan blowing into the Pi-HAT gap (gpio-fan, GPIO 26);
//         pi_fan keep-out and fan-<sled> clash pairs. The case itself still has no fans.
// v0.10 - single supply: one desktop brick on the shelf (receptacle plate, barrier, second adapter and the PG9 gland replaced by a brick envelope, a rear-wall opening and a cord clamp).
// v0.10 - passive airflow: the projector's own fan, exhaust and inlet louver banks on the right wall, a lip baffle between them;
//         no case fans or sensors; photo-derived side-port keep-outs
// v0.9 - the stock supply is a wall-wart, so the shelf grew a receptacle plate: two panel-mount NEMA 5-15R stacked,
//        the stock 21 V wall-wart below and a second (Pi, DigiAMP+) above, hanging on their prongs; the AC gland
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
// Print everything in PETG. Lid prints roof-down. Base+lid split front/rear (MK3S bed 250x210x210); front pieces lie flat with X along the 250 mm axis.

/* [Part] */
part = "assembly"; // [assembly, base, lid, window_frame, pedestal, hatch_cover, power_shelf, sled, ir_holder, vent_cap, exhaust_cap, intake_cap, fit_coupon, split_test]
sled = "pi3";      // [pi3, pi4, pi5, zero2w] sled shown in the assembly / exported by part="sled"
tile = "all";      // [all, front, rear] for base+lid
explode = 0;       // [0:1:80]
aim = [0, 0];      // [pan, tilt] deg of the ghost projector in the assembly preview
step = 0;          // [0:1:14] assembly only: parts in place up to this docs/ASSEMBLY.md step (0 = all); the step's own parts are highlighted and pulled out by step_pull (scripts/render_assembly.sh)
step_pull = 60;    // how far the step's parts sit from their final place

/* [Projector (mm)] */
// Verified 2026-10-05 from the projector's EDID (read on a Mac, docs/BRINGUP.md "Verified so far"):
// generic STK "S2-TEK TV" block (product 0x531A, dated 2014), HDMI input with CEC physical address 2.0.0.0,
// native 1080p60 (VIC 16), 8-bit only, TMDS <= 150 MHz, 2-ch LPCM audio, DPMS standby/active-off flagged.
// CEC itself is NOT proven (the address field is mandatory for any HDMI sink): see BRINGUP row 9.
// The EDID says nothing about size, lens or ports: those come from docs/measurements.yaml (see below).
proj_w = 165;   // width (X): Tkisko TO2 manual says 6.5 x 5 x 2.6 in, lens on the 6.5 in face; confirm with calipers
proj_d = 130;   // depth (Y), lens faces front: measured 130.0 with calipers
proj_h = 66;    // height (Z)
lens_x = -20;   // lens offset from centre (+ = right): estimated from the product photo, measure it
lens_z = 33;    // lens centre height above projector underside: estimated from the product photo, measure it
throw_ratio = 0.95; // throw distance / image width: from the manual's image sizes (36 in at 2.5 ft, 72 in at 5 ft); measure it
aspect = 16/9;
port_depth = 15;    // HDMI + power plugs on the projector's rear face: right-angle plugs with slack (a straight HDMI plug needs ~40)
lens_offset = 0;    // vertical image offset: 0 = image centred on the lens axis, 1 = image bottom on the axis
pane_w = 127;   // pane: 3.5 x 5 in (127 x 88.9 mm) picture-frame glazing, the smallest stock size the light cone clears; the window opening is the pane minus lap
pane_h = 88.9;
pane_top_clear = 7;  // pane top this far below the base rim: the window sits as high as it can, for upward tilt
mount_x = 19;   // 1/4-20 socket offset from projector centre (+ = right): scaled off the underside photo, measure it
mount_y = -4;   // + = toward rear: scaled off the underside photo, measure it

/* [Ball head] */
ball_head_h = 52;  // UTEBIT 20 mm mini head (58 mm overall incl. ~6 mm stud, which screws into the projector): base to the platform the projector sits on, scaled off the vendor drawing
pivot_h = 32;      // ball centre above the head's base (aim pivot); UTEBIT: 30 mm body, 20 mm ball, scaled off the vendor drawing
aim_max = 15;      // tilt range the case must clear (check_clash.sh sweeps it)
pan_max = 10;      // pan range the case must clear: the light cone clips the window frame past this at throw_ratio 0.95 (turn the case for more)
cone_tilt = 11;     // light-cone check: the image must clear the window, frame and visor at +/- this tilt
aim_combo = 8;     // tilt while panned by pan_max (corners): the rear plugs reach the divider past this; more would lengthen base_front past the 210 mm bed axis
ped_mount = "shoe"; // [shoe, insert] how the ball head sits on the pedestal: the UTEBIT hot-shoe adapter in a T-slot (coupon passed 2026-10-15), or a 1/4-20 insert plus double-ended stud
ped_top = 25;      // pedestal top height above floor (the T-slot lips; with "insert" use 30 to keep the projector height)
shoe_rise = 5;     // the hot-shoe adapter's ring: lip top to the head's base (about 5, measure it)
shoe_ch_w = 18.6;  // hot-shoe receiver (ISO 518; the UTEBIT adapter fits the coupon, 2026-10-15): channel width under the lips
shoe_foot_t = 2;   // foot plate thickness (ISO 2 +0.15)
shoe_open = 12.5;  // opening between the lips
shoe_lip_t = 2;    // lip thickness: the adapter's ring clamps on this
shoe_foot_l = 18;  // foot length along the slide (guess: measure the adapter)
shoe_neck_d = 12;  // round neck between foot and ring (guess: measure the adapter)
shoe_clr = 0.3;    // clearance per side
insert_d = 8.2;    // 1/4-20 heat-set insert hole; check your insert's datasheet
insert_len = 9;

/* [Enclosure] */
wall = 3;
floor_t = 6;
foot_h = 6;        // ground clearance so rain drains out underneath
foot_ribs = [-88, -68, -40, -15, 15, 40, 68, 88];   // inner front-to-back ribs; two more run under the side walls. Floor bridges <= max_bridge (asserted); channels drain/vent/route wires
rib_t = 4;
layer_h = 0.2;     // base tiles' layer height (0.20mm SPEED, docs/PRINTING.md): gap above the window ribs, floor-hole skin, ear thickness
clearance = 0.3;
side_air = 25;     // gap each side of projector: clears the +/-10 deg pan sweep of the right face, the HDMI plug and the baffle; could shrink to about 19 mm (separate change)
top_air  = 25;
front_gap = 30;      // lens-down tilt swings the top front corner forward (more so panned, now the body is 165 wide); aim-sweep and light-cone checks size this
rear_gap  = 34;      // lens-up tilt swings the rear plugs back (port_depth) toward the divider; aim-sweep sizes this
pi_zone_d = 85;    // Pi compartment depth: the brick sits on the shelf toward the rear wall (asserted) and the shelf's low-voltage side needs wiring room
pane_t = 2;        // pane thickness: 2 mm (typical frame glazing; measure yours, 1/8 in = 3.2 also fits)
lap = 8;           // pane overlap past the window opening
boss_h = 4;

/* [Aim hatch (-X wall)] */
hatch = 108;         // diamond opening, tip to tip: reach in to loosen/aim the ball head (45 deg edges print unsupported); its hood must clear the lid skirt
hatch_flange = 10;   // cover overlap past the diamond's tips
hatch_zc = 56;       // opening centre height above floor: lower tip just above the floor, hood under the lid skirt (cover must lift kh_drop under the hood)
stud_off = 56;       // hatch stud spacing from opening centre
stud_d = 5;          // hatch bolt thread: M5 button head (ISO 7380: head about 9.5 across); M4 also works (stud_d 4, stud_head_d 7.6, stud_insert_d 5.6)
stud_head_d = 9.5;   // button head diameter
kh_drop = 8;         // keyhole slide distance: cover lifts this much to come off
stud_insert_d = 6.4; // heat-set insert hole for the hatch bolt (M5); check your insert on the coupon
hood_d = 10;         // rain hood depth over the hatch (must stay below the lid skirt)
cover_gasket = 1.5;  // foam tape thickness
hatch_lock = true;   // optional M3 (security) screw through the cover's bottom edge: stops it lifting off its keyholes

/* [Power] */
shelf_z = 60;       // power shelf height above floor: clears the tallest sled stack (asserted)
ledge_w = 9;        // shelf ledge on the side walls
tie_gap = 34;       // zip-tie slot spacing across the shelf (module sits between)
cord_x = -75;       // centre of the AC cord opening in the rear wall: the opening, its bosses and the clamp all have to sit inside the left wall (asserted)
cord_dz = 30;       // opening centre above the shelf's top face: the clamp's lower screws clear the shelf, the clamp's top clears the lid skirt (asserted)
cord_open = [40, 30];   // rear-wall opening [X, Z]: passes a molded IEC plug (a C13 body is about 28 x 21 mm) with room; the clamp covers it
cord_d = 9;             // AC cord jacket diameter: PROVISIONAL, measure the cord you use
clamp_t = 6;            // clamp half thickness
clamp_flange = 10;      // each half overlaps the opening by this much all round
cord_boss = 5;          // pilot bosses inside the wall, at the clamp's four screws (must stay <= brick_gap, or they hit the brick: checked)
// Supply (spec 2026-10-06, rev 2): the Auplf XGM-2406 24 V 6 A desktop brick lies on the shelf under a velcro strap, fed by a
// standard cord that plugs into its AC inlet; its DC cord goes uncut into a 5.5 x 2.5 mm Y-splitter. The stock 21 V adapter is
// retired from the case. Its size is the Amazon listing's (2026-10-12), not yet calipered.
brick = [170, 71, 41];   // PROVISIONAL (Amazon listing: 6.7 x 2.8 x 1.6 in): length along X, width along Y, height. Caliper the real one (Task 7)
brick_gap = 5;           // PROVISIONAL strap gap only between the brick and the rear wall; 5 mm cannot hold the connector and its cord bend. The real cord path and placement are set in BRINGUP row 4 / plan Task 7
wire_slot = [20, 14];    // shelf slot for the DigiAMP+ leg and the PIR wires: the DC barrel plug (about 11 x 16) must pass; check with the real splitter

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
pir_x = 76;         // low-voltage side, clear of the rear lid screw block; sits right of the 170 mm brick (asserted)
pir_dz = 45;        // dome centre above the shelf's top face
pir_dome_d = 23.5;  // lens dome; check yours
pir_hole_sp = 28.7; // board mounting holes (M2), check yours
pir_stand = 3;      // lens frame thickness: board sits this far off the wall
pir_board = [32, 24, 1.6];  // board [X, Z, thickness] (HC-SR501 size; the preview ghost and clash check only)
pir_dome_h = 9;     // how far the dome stands proud of the wall outside (dome radius less the wall; preview ghost and clash check)

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

/* [Insect screen] */
cap_h = 3;          // screen caps stand this far off the wall/floor; screen glues inside the plate
cap_t = 2;          // cap ring and plate thickness

/* [Airflow (projector's own fan; photo-measured, confirm with calipers)] */
exh_y = [0, 42];        // exhaust grille span behind the projector's front face, right side (slots measured 10-42; the owner says the first 40)
in_size = 40;           // rear intake patch, square
in_top = 15;            // intake patch inset from the projector's top
dc_jack = [15, 13];     // DC barrel centre: inset from the right edge, below the top
side_port_h = 18;       // I/O strip height on the right face, from the top
hdmi_y = 56;            // HDMI centre behind the front face (right face)
side_port_depth = 15;   // right-angle HDMI plug standing out of the right face
side_cable_d = 8;       // the cable run behind the plug, standing out of the right face
air_margin = 8;         // opening grows past the patch this much each way along Y (partial pan margin: at the extremes some exhaust leaves into the side gap, which is the plenum)
air_margin_z = 4;       // and along Z (partial tilt margin, same caveat)
lv_pitch = 8;           // louver slat pitch
baffle_d = 10;          // lip baffle depth from the right wall (aim sweep checks it)
baffle_t = 4;
baffle_gap = side_port_h + 4;   // baffle top stops this far below the projector's top, under the HDMI plug
ir_x = 35;              // IR receiver on the projector's front face, right of centre (above the logo)
ir_z = 50;              // and its height above the projector underside
ir_holder_h = 7;        // ir_holder body height off the front face

/* [Pi sled] */
sled_pad = 2;       // floor pads lift the sled so floor water drains underneath
sled_t = 3;         // sled plate
sled_post = 3;      // board standoffs on the sled
m3_insert_d = 4.0;  // M3 heat-set insert for the sled thumbscrew; check your insert
hdmi_plug = [22, 45, 13];   // straight HDMI plug at the Pi, with strain relief: [width, length, height] (check_clash.sh keep-out)
pass_x = [-40, 25];         // divider pass-through, left/right edge: spans every board's HDMI port
pi_fan = [30, 10];          // 5 V axial fan on the Pi 3/4 sleds [frame side, thickness]: stands at the SD-card end, blows into the Pi-HAT gap (Pi 5: Active Cooler; Zero: no room past the thumbscrew)
pi_fan_sp = 24;             // fan screw spacing (24 for 30 mm fans)
amp_jack_x = 13;            // DigiAMP+ barrel jack centre from the HAT's pin-1 end (the Pi's SD-card end), on the edge opposite the GPIO header, facing the divider (scaled off the Raspberry Pi product photo)
amp_jack_dz = 8;            // jack centre below the top of the Pi stack (guess: check yours)
amp_spk_x = [30, 50];       // the two speaker terminal blocks on the same edge, from the pin-1 end (product photo)
pi_fan_dy = -8;             // fan centre in Y from pi_cy: clear of the thumbscrew (pi_cy+18)
pi_fan_gap = 4;             // fan outlet face to the board's SD-card end (the card sticks out about 2.5 mm)
pi_fan_t = 3.5;             // upright bracket plate the fan screws to

/* [Printer] */
bed = [250, 210, 210];   // print volume; every tile is asserted to fit (either way round)
max_bridge = 30;         // longest unsupported bridge under the floor
ears = true;             // mouse ears against warping (cut or peel off after printing): base tiles on every foot-rib end, lid tiles and hatch cover on their corners
ear_d = 18;              // ear diameter: half of each ear lies inside the tile, so only the outer ribs' ears widen it in X; ribs 20 mm apart, so 20 would make neighbouring ears touch (non-manifold)
rib_foot_w = 10;         // foot ribs' width on the bed: the 4 mm ribs flare to this with a 45 deg chamfer (outer ribs inward only), against warping (base_front's corners lifted 6 mm at Z 7, 2026-10-24)
rib_foot_t = 0.6;        // flat height of that flare before the chamfer starts
ear_layers = 3;          // ear thickness in layers of layer_h: 0.6 mm, so 3 layers on the base tiles and hatch cover (0.20 mm) and 2 on the lid tiles (0.30 mm)
win_rib_t = 4;           // window ribs' thickness: they hold up the window's top bridge while printing; under 4 mm PrusaSlicer flags them (73 mm tall) as a thin fragile part
split_test_d = 50;       // split_test: depth of the strip cut from the back of base_rear (full width, so the floor shrinks over the real 231 mm)
split_test_h = 30;       // split_test: wall height above the floor top, past where the 2026-10-22 base_rear split
hole_skin = 1;           // sacrificial layers (of layer_h) closing the floor holes from below, so the floor's first bridge layer has no floating rims; punch out after printing (0 = open)

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
z_skin = hole_skin > 0 ? foot_h + hole_skin*layer_h : foot_h - 1;   // floor holes start here (above their sacrificial skin)
head_z = ped_top + (ped_mount == "shoe" ? shoe_rise : 0);   // ball head base above floor
proj_z0 = head_z + ball_head_h;           // projector underside above floor
fw = wall + pane_t + 4;
div_t = 3;
inner_w = proj_w + 2*side_air;
proj_zone_d = front_gap + proj_d + rear_gap;
inner_d = proj_zone_d + div_t + pi_zone_d;
inner_h = proj_z0 + proj_h + top_air;
out_w = inner_w + 2*wall;
out_d = inner_d + fw + wall;
ribs_x = concat([-(out_w-rib_t)/2], foot_ribs, [(out_w-rib_t)/2]);   // outer ribs sit under the side walls: no floor past them
assert(ped_mount == "insert" || ped_top - boss_h >= shoe_lip_t + shoe_foot_t + 0.45 + 4, "pedestal column too short for the hot-shoe slot: raise ped_top");
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
lid_screw_ys = [y0 + 10, y_back - 8];     // lid screw stations: side screws through the skirt, none in the roof; front block (y-5) stays behind the window frame (y0..y0+frame_t)
lid_screw_z = base_h - 7;
base_seam = y_div + div_t + 0.01;
shelf_zz = z_floor + shelf_z;
stake_pts = [for (sx=[-1,1], y=[y0+12, y_back-12]) [sx*stake_x, y]];
vents = [[1, pi_cy, shelf_zz+26]];         // the one passive Pi-zone louver bank [side, y, centre z] (right wall, over the low-voltage side)
vent_open = [26, 42];                      // louver bank opening a wall cap covers (Z, Y); tabs go top/bottom (clear driver access)
y_pf = y0 + front_gap;                     // projector front face
exh_open = [proj_h + 2*air_margin_z, exh_y[1] - exh_y[0] + 2*air_margin];   // exhaust wall opening [Z, Y]
exh_c = [y_pf + (exh_y[0] + exh_y[1])/2, z_pj + proj_h/2];
in_open = [in_size + 2*air_margin_z, rear_gap + 2];                         // inlet wall opening [Z, Y]
in_c = [y_div - in_open[1]/2 - 1 - cap_t, z_pj + proj_h - in_top - in_size/2];
function air_n(h, pitch) = floor((h - 7)/pitch) + 1;   // slats that fit an opening of height h (floor: the outer slots must not reach past the opening, or past the screen cap's rim)
assert(exh_open[1] >= exh_y[1] - exh_y[0] + 2*air_margin - 0.01 && exh_open[0] >= proj_h + 2*air_margin_z - 0.01, "exhaust opening does not cover the exhaust grille plus its sweep margin");
assert(in_open[0] >= in_size + 2*air_margin_z - 0.01 && in_c[1] + in_open[0]/2 <= z_pj + proj_h + air_margin_z + 0.01, "inlet opening does not span the intake patch, or rises past the projector's top");
assert((air_n(exh_open[0], lv_pitch)-1)*lv_pitch/2 + wall/2 + 1.2*sqrt(2) <= exh_open[0]/2, "exhaust louver slots reach past the opening (and the screen cap's rim)");
assert((air_n(in_open[0], lv_pitch)-1)*lv_pitch/2 + wall/2 + 1.2*sqrt(2) <= in_open[0]/2, "inlet louver slots reach past the opening (and the screen cap's rim)");
assert(in_c[0] + in_open[1]/2 <= y_div, "inlet opening runs into the divider");
assert(in_c[0] - in_open[1]/2 >= y_pf + proj_d - 6, "inlet opening starts too far in front of the projector's rear face");
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
function sled_fan(s) = s == "pi3" || s == "pi4";
pi_fan_x0 = -42.5 - pi_fan_gap - pi_fan[1];  // fan intake face (the bracket plate is behind it)
function sled_hdmi_x(s) = s == "pi3" ? 32 : s == "zero2w" ? 12.4 : 26;   // HDMI (HDMI0) centre from the board's SD-card end
assert(z_board + max([for (s=SLEDS) sled_stack(s)]) + 1 <= shelf_zz, "raise shelf_z: a sled stack hits the shelf");
assert(pi_fan_x0 - pi_fan_t >= sled_x[0] - 0.01, "the Pi fan bracket hangs off the sled's left edge: shrink pi_fan_gap or pi_fan_t");
assert(pi_cy + pi_fan_dy + pi_fan[0]/2 + 5 <= sled_pts[2][1], "the Pi fan crowds the sled thumbscrew: lower pi_fan_dy");
shelf_w = inner_w - 1;
shelf_d = pi_zone_d - 1;
brick_x0 = -shelf_w/2 + 3;                 // the brick's left end, against the left wall side of the shelf
brick_y0 = shelf_d - brick[1] - brick_gap; // its front edge: it sits toward the rear wall

lid_w = out_w + 2*(lid_clr + wall);
lid_d = out_d + 2*(lid_clr + wall);
lid_a = atan(rise/lid_d);
yfl = -lid_d/2;
lid_seam = yfl - visor_len + lid_front_len;
seam_t = top_t + seam_rib;                // roof thickness across the scarf
pivot = [ped_x, ped_y, z_floor + head_z + pivot_h];
lid_z0 = base_h + gasket - (skirt_h - top_t);
clamp_w = cord_open[0] + 2*clamp_flange;
clamp_h = cord_open[1] + 2*clamp_flange;      // both halves together
cord_z = shelf_zz + 3 + cord_dz;              // opening centre, from the ground
cord_screws = [for (sx=[-1,1], sz=[-1,1]) [cord_x + sx*(cord_open[0]/2 + clamp_flange/2), cord_z + sz*(cord_open[1]/2 + clamp_flange/2)]];
assert(cord_x - clamp_w/2 >= -out_w/2, "move cord_x right: the cord clamp hangs off the rear wall's left edge");
assert(cord_x - cord_open[0]/2 - 4 >= -inner_w/2, "move cord_x right: the cord opening must sit inside the left wall");
assert(cord_dz - cord_open[1]/2 - clamp_flange >= 3, "raise cord_dz: the clamp's lower screws land on the shelf");
assert(pir_zz + pir_dome_d/2 + hood_d + 4 <= lid_z0, "the PIR hood runs into the lid skirt: lower pir_dz");
assert(cord_z + clamp_h/2 <= lid_z0 - 2, "lower cord_dz: the cord clamp runs into the lid skirt");
assert(cord_d >= 5 && cord_d <= cord_open[1] - 6, "cord_d: measure the cord; it must fit the opening and the clamp channel");
assert(brick_x0 + brick[0] + 3 <= pir_x - 6, "the brick runs into the PIR / wire slot: measure it, or shorten it");
assert(brick_y0 >= 0 && brick[1] + brick_gap <= shelf_d, "the brick is deeper than the shelf");
assert(shelf_zz + 3 + brick[2] + 2 <= lid_z0, "the brick hits the lid skirt: raise top_air (or lower shelf_z)");
assert(pane_top_clear >= pane_t + clearance + 2.5, "raise pane_top_clear: the rebate's 45 deg ceiling would cut through the base rim");

// Every tile must fit the bed, either way round. These fire when the projector parameters grow the case.
function fits_bed(x, y, z) = z <= bed[2] && ((x <= bed[0] && y <= bed[1]) || (x <= bed[1] && y <= bed[0]));
base_front_len = base_seam - y_front;
assert(fits_bed(base_front_len, out_w + hood_d, base_h), str("base_front is ", base_front_len, " x ", out_w + hood_d, " x ", base_h,
  " mm, too big for the bed: trim front_gap / rear_gap / side_air / top_air, or it needs another split"));
assert(fits_bed(out_w, out_d/2 - base_seam + (pir ? hood_d : 0), base_h), "base_rear does not fit the bed");
assert(fits_bed(lid_seam + seam_t - (yfl - visor_len), lid_w, skirt_h + rise + lip_h), "lid_front does not fit the bed");
assert(fits_bed(lid_d/2 - lid_seam + skirt_h + rise, lid_w, skirt_h + rise), "lid_rear does not fit the bed: the lid needs a third tile");
assert(!ears || fits_bed(lid_seam + seam_t - (yfl - visor_len), lid_w + ear_d, skirt_h + rise + lip_h), "lid_front's mouse ears push it off the bed: shrink ear_d");
assert(!ears || fits_bed(lid_d/2 - lid_seam + skirt_h + rise, lid_w + ear_d, skirt_h + rise), "lid_rear's mouse ears push it off the bed: shrink ear_d");
assert(!ears || min([for (i=[1:len(ribs_x)-1]) ribs_x[i]-ribs_x[i-1]]) >= ear_d + 1, "mouse ears on neighbouring ribs touch or merge oddly: shrink ear_d");
assert(!ears || fits_bed(base_front_len, out_w + max(hood_d, ear_d/2 - rib_t/2) + ear_d/2 - rib_t/2, base_h), "base_front's mouse ears push it off the bed: shrink ear_d");
assert(!ears || fits_bed(out_w + ear_d - rib_t, out_d/2 - base_seam + (pir ? hood_d : 0), base_h), "base_rear's mouse ears push it off the bed: shrink ear_d");
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

// Mouse ears for a base tile: thin half-discs at both ends of every foot rib, kept inside the case in Y
// (base_front has only 3 mm spare on the bed's 210 mm axis); the outer ribs' ears reach past the side walls in X.
// tile_cut trims them at the seam.
module ears_tile(t) {
  intersection() {
    for (x=ribs_x, y=(t == "front") ? [y_front, base_seam] : [base_seam, out_d/2]) translate([x, y, 0]) cylinder(d=ear_d, h=ear_layers*layer_h);
    translate([-big/2, y_front, -1]) cube([big, out_d, ear_layers*layer_h + 2]);
  }
}

// Warp and layer-bond test: the back split_test_d of base_rear, full width, cut split_test_h above the floor. Same ribs,
// floor, rear wall, corners and stake tubes as the tile, so it splits where the tile would, in a few hours instead
// of a day. Ears on both rib ends, including the cut ones.
module split_test() {
  y_cut = out_d/2 - split_test_d;
  intersection() {
    base_all();
    translate([-big/2, y_cut, -1]) cube([big, split_test_d + 1, z_floor + split_test_h + 1]);
  }
  if (ears) for (x=ribs_x, y=[y_cut, out_d/2]) translate([x, y, 0]) cylinder(d=ear_d, h=ear_layers*layer_h);
}

// Mouse ears for a lid tile, which prints roof-down: thin discs at the roof's corners, lying in the roof
// plane and reaching into the lid (up, as printed); kept inside the roof in Y, past the skirts in X.
// The seam pair sits where the scarf meets the roof top, and lid_tile trims them there.
function lid_scarf_c() = lid_seam + seam_t/2 - zp(lid_seam);
function lid_seam_top() = (lid_scarf_c() + skirt_h + rise + rise*yfl/lid_d) / (1 + rise/lid_d);   // y - zp(y) = c on the roof top
module ears_lid(t) {
  intersection() {
    for (sx=[-1,1], y=(t == "front") ? [yfl - visor_len, lid_seam_top()] : [lid_seam_top(), yfl + lid_d])
      translate([sx*lid_w/2, y, zp(y)]) rotate([-lid_a,0,0]) translate([0, 0, -ear_layers*layer_h]) cylinder(d=ear_d, h=ear_layers*layer_h);
    translate([-big/2, yfl - visor_len, -big/2]) cube([big, lid_d + visor_len, big]);
  }
}

// Lid split with a 45-degree scarf: the front (uphill) tile laps over the rear one like a shingle,
// and both print roof-down without supports. front = everything forward of the plane y - z = c.
module lid_tile(t) {
  c = lid_scarf_c();
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
  // aim hatch opening + hatch stud inserts (from outside)
  translate([-out_w/2-1, hatch_y, hatch_zz]) rotate([0,90,0]) linear_extrude(wall+2) rotate(45) square(hatch/sqrt(2), center=true);
  for (sy=[-1,1], sz=[-1,1])
    translate([-out_w/2-0.1, hatch_y+sy*stud_off, hatch_zz+sz*stud_off]) rotate([0,90,0]) cylinder(d=stud_insert_d, h=8.1);
  // exhaust bank (+X wall, front): the projector's own fan blows out through here
  translate([out_w/2-wall/2, exh_c[0], exh_c[1]-(air_n(exh_open[0], lv_pitch)-1)*lv_pitch/2]) louvers(exh_open[1], air_n(exh_open[0], lv_pitch), lv_pitch, 1);
  // inlet bank (+X wall, rear gap): air reaches the projector's rear intake
  translate([out_w/2-wall/2, in_c[0], in_c[1]-(air_n(in_open[0], lv_pitch)-1)*lv_pitch/2]) louvers(in_open[1], air_n(in_open[0], lv_pitch), lv_pitch, 1);
  // passive Pi-side louver
  for (v=vents) translate([v[0]*(out_w/2-wall/2), v[1], v[2]-8]) louvers(40, 3, 8, v[0]);
  // screen-cap screw pilots (M2 self-tap)
  for (v=vents, sy=[-1,1]) translate([v[0]*(inner_w/2+2), v[1], v[2]+sy*cap_tab(vent_open)]) rotate([0, -v[0]*90, 0]) cylinder(d=1.8, h=cap_h+2);
  // screen-cap pilots for the two projector banks (M2 self-tap)
  for (c=[[exh_c[0], exh_c[1], exh_open], [in_c[0], in_c[1], in_open]], sy=[-1,1])
    translate([inner_w/2+2, c[0], c[1]+sy*cap_tab(c[2])]) rotate([0, -90, 0]) cylinder(d=1.8, h=cap_h+2);
  // AC cord opening (rear wall, above the shelf): passes a molded plug; the cord clamp covers it and grips the jacket
  translate([cord_x - cord_open[0]/2, y_back - 1, cord_z - cord_open[1]/2]) cube([cord_open[0], wall + 2, cord_open[1]]);
  // clamp screw pilots (M3 self-tapping) from the outside through the wall into the bosses
  for (p = cord_screws) translate([p[0], y_back + wall + 1, p[1]]) rotate([90, 0, 0]) cylinder(d=2.6, h=wall + cord_boss + 1);
  // divider pass-through (HDMI + projector power). Open down to the sled: the Pi's HDMI edge sits about 10 mm
  // behind the divider, so the plug goes straight through and the cable loops under the projector
  translate([0, y_div+div_t+1, 0]) rotate([90,0,0]) linear_extrude(div_t+2)   // gabled top prints unsupported
    polygon([[pass_x[0], z_floor+sled_pad], [pass_x[1], z_floor+sled_pad], [pass_x[1], shelf_zz+23],
             [(pass_x[0]+pass_x[1])/2, shelf_zz+23+(pass_x[1]-pass_x[0])/2], [pass_x[0], shelf_zz+23]]);
  // drains (exit into the gap under the floor)
  for (sx=[-1,1], y=[y0+8, y_back-10]) translate([sx*55, y, z_skin]) cylinder(d=4, h=z_floor-z_skin+1);
  // pedestal plate pilots
  for (sx=[-1,1], sy=[-1,1])
    translate([ped_x+sx*35, ped_y+sy*25, z_floor+boss_h-8]) cylinder(d=2.6, h=8.1);
  // speaker-wire chimney bore: wires come up from the gap under the floor
  translate([spk_x, pi_cy, z_skin]) cylinder(d=spk_d, h=z_floor-z_skin+spk_collar+1);
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
  if (stakes) for (p=stake_pts) translate([p[0], p[1], z_skin]) cylinder(d=stake_d, h=z_floor-z_skin+stake_collar+1);
  // hatch lock pilot: into the solid wall/floor corner below the hatch
  if (hatch_lock) translate([-out_w/2-0.1, hatch_y, hatch_zz-cover_s/2+5]) rotate([0,90,0]) cylinder(d=2.6, h=10);
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
      for (c=[[exh_c[0], exh_c[1], exh_open], [in_c[0], in_c[1], in_open]], sy=[-1,1])   // screen-cap bosses, projector banks
        translate([inner_w/2+0.1, c[0], c[1]+sy*cap_tab(c[2])]) rotate([0, -90, 0]) cylinder(d=6, h=cap_h-cap_t+0.1);
      baffle();
      for (sx=[-1,1])   // seam collars (rear tile); stop below the shelf ledges
        translate([sx > 0 ? inner_w/2-collar_t : -inner_w/2, y_pi0-0.01, z_floor-0.1])
          cube([collar_t, collar_d, shelf_zz-ledge_w-3-z_floor+0.1]);
      if (stakes) for (p=stake_pts) translate([p[0], p[1], z_floor-0.1]) cylinder(d=stake_d+5, h=stake_collar+0.1);
      for (p = cord_screws) translate([p[0], y_back - cord_boss, p[1]]) rotate([-90, 0, 0]) cylinder(d=8, h=cord_boss + 0.01);   // pilot bosses for the cord clamp
      for (x=ribs_x) translate([x-rib_t/2, y_front, 0]) cube([rib_t, out_d, foot_h+0.1]);   // feet
      for (x=ribs_x) let(fl = (rib_foot_w-rib_t)/2,   // rib feet: wider on the bed, 45 deg up to the rib
                         el = x < -inner_w/2 ? 0 : x > inner_w/2 ? 2*fl : fl,
                         er = x < -inner_w/2 ? 2*fl : x > inner_w/2 ? 0 : fl)
        hull() {
          translate([x-rib_t/2-el, y_front, 0]) cube([rib_t+el+er, out_d, rib_foot_t]);
          translate([x-rib_t/2, y_front, 0]) cube([rib_t, out_d, rib_foot_t+max(el, er)]);
        }
      translate([-inner_w/2, y_div, z_floor-0.1]) cube([inner_w, div_t, base_h-z_floor+0.1]);   // divider
      for (sx=[-1,1], sy=[-1,1]) translate([ped_x+sx*35, ped_y+sy*25, z_floor-0.1]) cylinder(d=9, h=boss_h+0.1);
      for (sx=[-1,1], y=lid_screw_ys) hull() {   // lid screw blocks inside the wall tops, 45 deg underside
        translate([sx > 0 ? inner_w/2-8 : -inner_w/2, y-5, base_h-14]) cube([8.1, 10, 14]);
        translate([sx > 0 ? inner_w/2-0.1 : -inner_w/2, y-5, base_h-22]) cube([0.1, 10, 0.1]);
      }
      for (p=sled_pts) translate([p[0], p[1], z_floor-0.1]) cylinder(d=10, h=sled_pad+0.1);   // sled pads
      for (p=[sled_pts[0], sled_pts[1]]) translate([p[0], p[1], z_floor]) cylinder(d=4, h=sled_pad+sled_t-0.4);   // locating pins
      for (sy=[-1,1], sz=[-1,1])   // inner bosses behind the hatch studs
        translate([-inner_w/2-0.1, hatch_y+sy*stud_off, hatch_zz+sz*stud_off]) rotate([0,90,0]) cylinder(d=stud_insert_d+5, h=6.1);
      hood();
      if (pir) {
        for (sx=[-1,1]) translate([pir_x+sx*pir_hole_sp/2, y_back+0.1, pir_zz]) rotate([90,0,0]) cylinder(d=5, h=pir_stand+0.1);
        translate([pir_x-20, out_d/2, pir_zz+pir_dome_d/2+hood_d+1]) rotate([90,0,90])   // 45 deg rain hood over the dome; its underside starts 1 mm above the dome
          linear_extrude(40) polygon([[-0.1, 3], [hood_d, 0], [-0.1, -hood_d]]);
      }
      translate([spk_x, pi_cy, z_floor-0.1]) cylinder(d=spk_d+4.8, h=spk_collar+0.1);   // speaker-wire chimney
      for (sx=[-1,1]) ledge(sx);
    }
    cuts();
  }
  // window ribs: cut the window's top bridge into thirds; one layer gap at the top so they come away. Cut them
  // off at the sill after printing
  if (ribs) for (sx=[-1,1]) translate([lens_x+sx*win_w/6-win_rib_t/2, y_front, win_zc-win_h/2-0.1])
    cube([win_rib_t, fw-pane_t-0.5, win_h-layer_h+0.1]);
}

// 45-degree gusset ledge on the side wall that carries the power shelf
module ledge(sx) {
  translate([sx*inner_w/2, y_pi0+0.05, shelf_zz]) rotate([90,0,0]) mirror([0,0,1])
    linear_extrude(pi_zone_d-0.05) polygon([[0,0],[-sx*ledge_w,0],[sx*0.1,-ledge_w-0.1]]);
}

// Power shelf above the Pi. The desktop brick lies on it toward the rear wall, held by a velcro strap through the slots; its
// AC cord comes in through the rear wall, its DC cord goes to the Y-splitter. Mains is only in the brick and its inlet connector.
module power_shelf() {
  difference() {
    translate([-shelf_w/2, 0, 0]) cube([shelf_w, shelf_d, 3]);
    for (x=[brick_x0 + brick[0]*0.3, brick_x0 + brick[0]*0.7], y=[brick_y0 - 4, brick_y0 + brick[1] + 1])   // velcro strap slots round the brick
      translate([x-10, y, -1]) cube([20, 3, 5]);
    for (x=[-70:20:70], sy=[-1,1]) if (x > brick_x0 + brick[0] + 6) translate([x-1.6, shelf_d/2+sy*tie_gap/2-3, -1]) cube([3.2, 6, 5]);   // zip-tie slots (low-voltage side)
    translate([pir_x-6, shelf_d-wire_slot[1], -1]) cube([wire_slot[0], wire_slot[1]+1, 5]);   // PIR wires and the DigiAMP+ leg (with its plug) down to the Pi
  }
}

// The brick's envelope on the shelf (shelf coordinates): preview ghost and clash keep-out
module brick_env() {
  translate([brick_x0, brick_y0, 3]) cube(brick);
}

// The PIR as fitted (preview ghost, clash keep-out): board on the lens frame inside the rear wall, dome through the wall.
module pir_sensor() {
  translate([pir_x, 0, pir_zz]) {
    translate([-pir_board[0]/2, y_back-pir_stand-pir_board[2], -pir_board[1]/2]) cube([pir_board[0], pir_board[2], pir_board[1]]);
    translate([0, y_back-pir_stand, 0]) rotate([-90,0,0]) cylinder(d=pir_dome_d, h=pir_stand+wall);
    translate([0, y_back+wall, 0]) scale([1, pir_dome_h/(pir_dome_d/2), 1]) difference() {
      sphere(d=pir_dome_d);
      translate([-pir_dome_d, -2*pir_dome_d, -pir_dome_d]) cube(2*pir_dome_d);
    }
  }
}

// The AC cord as routed (preview ghost): in through the clamp, then outside a drip loop below the clamp and down to the ground.
module wire(pts, d) { for (i=[0:len(pts)-2]) hull() for (p=[pts[i], pts[i+1]]) translate(p) sphere(d=d, $fn=12); }
module ac_cord() {
  yo = y_back + wall + clamp_t;
  wire([[cord_x, y_back-3, cord_z], [cord_x, yo+20, cord_z], [cord_x, yo+40, cord_z-20], [cord_x, yo+35, cord_z-clamp_h/2-20],
        [cord_x, yo+60, cord_z-clamp_h/2-15], [cord_x, yo+90, cord_d/2]], cord_d);
}

// Pi-zone wiring as routed in docs/ASSEMBLY.md step 10 and docs/WIRING.md (preview ghost only; the DigiAMP+'s
// jack and terminals are on its edge facing the divider, amp_jack_x, amp_spk_x): HDMI from the Pi forward through the divider
// pass-through, across the rear gap, up the side gap and forward over the baffle to the projector's right-face plug;
// the Y-splitter's leg 2 from the brick down the shelf's wire slot to the DigiAMP+; the PIR leads down the same slot
// to the header; the fan lead; speaker wire down the floor chimney and out under the floor.
module pi_wiring(s) {
  top = z_board + sled_stack(s) + 2;                       // leads land on the HAT's top
  hx = -42.5 + sled_hdmi_x(s);
  hz = z_board + 1.6 + 3.2;
  sx = proj_w/2 + side_cable_d/2;                          // side-gap run, inside the plug's cable keep-out
  slot = [pir_x + 4, y_pi0 + 0.3 + shelf_d - wire_slot[1]/2];
  wire([[hx, y_gpio-sled_board(s)[1]-hdmi_plug[1], hz], [hx, y_pf+proj_d+4, hz], [sx, y_pf+proj_d+4, hz],
        [sx, y_pf+proj_d+4, z_pj+proj_h-side_port_h/2], [sx, y_pf+hdmi_y, z_pj+proj_h-side_port_h/2]], 7);   // HDMI
  j = amp_jack(s);
  wire([[brick_x0+brick[0], y_pi0+0.3+brick_y0+brick[1]-8, shelf_zz+3+brick[2]/2], [slot[0], slot[1], shelf_zz+10],
        [slot[0], slot[1], top+6], [j[0], j[1]-port_depth/2, top+6], [j[0], j[1]-port_depth/2, j[2]+7]], 4);       // Y-splitter leg 2, into the right-angle adapter
  wire([[pir_x, y_back-pir_stand-3, pir_zz-pir_board[1]/2], [slot[0]-4, slot[1], shelf_zz+6], [slot[0]-4, slot[1], top+8],
        [0, y_gpio-3, top]], 2.5);                                                                                  // PIR leads
  if (sled_fan(s)) wire([[pi_fan_x0+pi_fan[1]/2, pi_cy+pi_fan_dy+pi_fan[0]/2, z_floor+sled_pad+sled_t+pi_fan[0]],
                         [-30, y_gpio-3, top]], 2.5);                                                               // fan
  for (tx=amp_spk_x) wire([[-42.5+tx, y_gpio-56, top-6], [-42.5+tx, y_gpio-62, top-6], [spk_x, y_gpio-62, top],
        [spk_x, pi_cy, top+5], [spk_x, pi_cy, z_floor+spk_collar+5], [spk_x, pi_cy, foot_h/2],
        [spk_x, y_back+wall+30, foot_h/2]], 4);                                                                    // speaker wire
}

// Lip baffle on the right wall between the exhaust and the rear inlet: exhaust that stays in the case does not creep back to the
// intake along the side gap. Runs from the floor (so the upright print has no cantilever) up to baffle_gap below the projector's
// top so the HDMI plug passes over it. A lip, not a seal.
module baffle() {
  by = exh_c[0] + exh_open[1]/2 + cap_t + 1;   // clear of the exhaust cap rim
  translate([inner_w/2 - baffle_d, by, z_floor - 0.1]) cube([baffle_d + 0.1, baffle_t, z_pj + proj_h - baffle_gap - z_floor + 0.1]);
}

// 45-degree rain hood over the aim hatch (prints without supports)
module hood() {
  translate([-out_w/2, hatch_y+cover_s/2, hatch_zz+cover_s/2+hood_lift]) rotate([90,0,0])
    linear_extrude(cover_s) polygon([[0.1, 3], [-hood_d, 0], [0.1, -hood_d]]);
}

// Hatch cover: hangs on four M5 button-head bolts (see stud_d) through keyholes; lift kh_drop and pull off, no tools.
// Foam-tape gasket on the wall side. Prints ribs-up (part="hatch_cover").
// with_ears: mouse ears at the corners, in the outer face's plane (export only); the keyholes cut through them.
module hatch_cover(with_ears=false) {
  difference() {
    union() {
      translate([-cover_s/2, -cover_s/2, 0]) cube([cover_s, cover_s, 3]);
      if (with_ears) for (sx=[-1,1], sy=[-1,1]) translate([sx*cover_s/2, sy*cover_s/2, 3-ear_layers*layer_h]) cylinder(d=ear_d, h=ear_layers*layer_h);
      translate([-cover_s/2+4, -1.5, -4]) cube([cover_s-8, 3, 4.1]);
      translate([-1.5, -cover_s/2+4, -4]) cube([3, cover_s-8, 4.1]);
    }
    for (sx=[-1,1], sz=[-1,1]) hull() {
      translate([sx*stud_off, sz*stud_off, -5]) cylinder(d=stud_d+0.8, h=9);
      translate([sx*stud_off, sz*stud_off-kh_drop, -5]) cylinder(d=stud_head_d+1.5, h=9);   // local +Y is up when hung
    }
    if (hatch_lock) translate([0, -cover_s/2+5, -5]) cylinder(d=3.4, h=9);   // lock screw, through the vertical rib
  }
}

// Screws to the floor bosses and carries the ball head: the head's hot-shoe adapter slides into a
// T-slot from the left (hatch side) and its ring clamps on the lips; or a 1/4-20 insert + short stud.
module pedestal() {
  difference() {
    union() {
      translate([-50, -35, 0]) cube([100, 70, 4]);
      cylinder(d=40, h=ped_top-boss_h);
    }
    for (sx=[-1,1], sy=[-1,1]) translate([sx*35, sy*25, -1]) cylinder(d=3.4, h=6);
    if (ped_mount == "shoe") translate([0, 0, ped_top-boss_h]) hot_shoe_cut(25);
    else translate([0, 0, ped_top-boss_h-insert_len]) cylinder(d=insert_d, h=insert_len+0.1);
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

// One assembly step (step > 0): parts from step n on show from that step, in their print colour,
// and on step n itself highlighted and moved by dir * step_pull. hw_stage is the same for bought hardware,
// which is a % ghost except on its own step.
out_c = "#5b6b3a"; petg_c = "#3a3a3a"; new_c = "#ff8c1a"; wire_c = "#d0102a";   // wire_c: the step's wiring
module stage(n, mat, dir=[0,0,1]) {
  if (step == 0) children();
  else if (step == n) translate(dir*step_pull) color(new_c) children();
  else if (step > n) color(mat) children();
}
module hw_stage(n, dir=[0,0,1], c=new_c) {
  if (step == 0 || step > n) %children();
  else if (step == n) translate(dir*step_pull) color(c) children();
}

module assembly() {
  if (step == 0 || tile != "all") tile_cut(tile, base_seam) base_all();
  else {
    stage(2, out_c) tile_cut("front", base_seam) base_all();
    // the tiles stand apart until step 6; no highlight on step 5, as OpenCSG bleeds one tile's colour into the other
    translate([0, step <= 5 ? step_pull : 0, 0]) stage(2, out_c) tile_cut("rear", base_seam) base_all();
  }
  stage(8, petg_c, [0,0,2]) translate([ped_x, ped_y, z_floor+boss_h]) pedestal();
  // step 10 leaves the shelf and brick out, so the picture shows the Pi zone under them
  if (step != 10) stage(9, petg_c, [0,0,2]) translate([0, y_pi0+0.3, shelf_zz]) power_shelf();
  stage(9, out_c, [0,1,0]) cord_clamp_placed();
  if (step != 10) hw_stage(9, [0,0,2]) translate([0, y_pi0+0.3, shelf_zz]) brick_env();
  hw_stage(9, [0,1,0]) ac_cord();
  if (pir) hw_stage(7, [0,-0.4,1.3]) pir_sensor();   // up and in: behind the divider it would be hidden
  stage(6, petg_c, [0,1,0]) translate([lens_x, y0, win_zc]) window_frame();
  stage(13, out_c, [-1,0,0]) translate([-out_w/2-cover_gasket-3, hatch_y, hatch_zz]) rotate([90,0,90]) hatch_cover();
  stage(12, out_c, [0,0,1.5]) translate([0, 0, lid_z0 + explode]) lid_tile(tile) lid();
  stage(10, petg_c, [0,0,0]) translate([0, 0, z_floor+sled_pad]) pi_sled(sled);   // in place, so the wiring meets it
  stage(4, petg_c, [-1,0,0]) { for (v=vents) vent_cap_placed(v); exhaust_cap_placed(); intake_cap_placed(); }
  hw_stage(10, [0,0,0]) { pi_stack(sled); pi_fan(sled); pi_hdmi_plug(sled); amp_dc_plug(sled); }
  hw_stage(10, [0,0,0], wire_c) pi_wiring(sled);
  // ghosts (preview only): ball head + projector
  if (step == 0 || step >= 8) {
    if (ped_mount == "shoe") %translate([ped_x, ped_y, z_floor+ped_top]) cylinder(d=24, h=shoe_rise);   // adapter ring
    %translate([ped_x, ped_y, z_floor+head_z]) cylinder(d=32, h=ball_head_h);
    %projector(aim[0], aim[1]);
    %ir_holder_placed(aim[0], aim[1]);
  }
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
module exhaust_cap_placed() { translate([inner_w/2-cap_h, exh_c[0], exh_c[1]]) rotate([0, 90, 0]) screen_cap(exh_open); }
module intake_cap_placed()  { translate([inner_w/2-cap_h, in_c[0], in_c[1]]) rotate([0, 90, 0]) screen_cap(in_open); }

// Fit-test coupon: every critical hole, the keyhole and the pane slot in one short print.
// Holes are made with the same parameters as the real parts, so tune them here first.
// Hot-shoe receiver cut, stud centre at the origin, top of the lips at z=0, open toward -X for open_len;
// the far end of the channel is the stop. Overhangs are about 3 mm per lip, so it prints without supports.
module hot_shoe_cut(open_len=25) {
  ch_h = shoe_foot_t + 0.15 + 0.3;
  translate([-open_len, -shoe_ch_w/2-shoe_clr, -shoe_lip_t-ch_h]) cube([open_len+shoe_foot_l/2+0.5, shoe_ch_w+2*shoe_clr, ch_h]);
  translate([-open_len, -shoe_open/2-shoe_clr, -shoe_lip_t-1]) cube([open_len+shoe_neck_d/2+shoe_clr, shoe_open+2*shoe_clr, shoe_lip_t+2]);
}

module fit_coupon() {
  holes = [[insert_d, "1/4", insert_len+2], [stud_insert_d, "M5i", 10], [m3_insert_d, "M3i", 8], [3.4, "M3", 3], [2.6, "M3p", 8], [2.2, "M2.5p", 7], [1.8, "M2p", 6]];   // [d, label, boss height]
  difference() {
    union() {
      cube([118, 30, 2]);                                             // strip under the holes; 118 is the shrink gauge (coupon.strip_len in docs/measurements.yaml)
      translate([0, 30, 0]) cube([30, 32, 3]);                        // keyhole tab, cover thickness
      for (i=[0:len(holes)-1]) translate([8 + i*12.5, 15, 0]) cylinder(d=holes[i][0]+5, h=holes[i][2]);   // a boss per hole
      translate([96, -12, 0]) cube([22, 12, 10]);                     // pane slot block
      translate([0, -31, 0]) cube([34, 31, 2 + shoe_foot_t + 0.45 + shoe_lip_t]);   // hot-shoe block: floor 2, channel, lips
    }
    for (i=[0:len(holes)-1]) {
      x = 8 + i*12.5;
      translate([x, 15, holes[i][2] > 3 ? 1.2 : -1]) cylinder(d=holes[i][0], h=20);   // blind (1.2 mm floor) except the through-holes
      translate([x, 25, 1.4]) linear_extrude(1) text(holes[i][1], size=2.4, halign="center");
    }
    translate([15, 52, -1]) hull() { cylinder(d=stud_d+0.8, h=5); translate([0, -kh_drop, 0]) cylinder(d=stud_head_d+1.5, h=5); }   // keyhole
    translate([105, -13, 3]) cube([pane_t+0.5, 14, 8]);   // acrylic slot: same width as the pane rebate
    translate([18, -15.5, 2 + shoe_foot_t + 0.45 + shoe_lip_t]) hot_shoe_cut(19);   // slide the ball head's hot-shoe adapter in from the left edge
  }
}

// IR LED holder for the projector-power fallback: sticks on with VHB tape near the projector's
// IR receiver, 5 mm LED aimed ir_angle off the pad's normal. Prints pad-down.
module ir_holder() {
  difference() {
    translate([-8, -8, 0]) cube([16, 16, ir_holder_h]);
    translate([0, 0, 2]) rotate([ir_angle, 0, 0]) cylinder(d=5.2, h=30);
    translate([-1.5, -9, 1]) cube([3, 9, 3]);   // lead channel out the side, clear of the taped face
  }
}

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

// Pi + DigiAMP+ envelope. Every generation sits with its GPIO edge at y_gpio, so the HAT lands in the
// same place; full-size boards' ports overhang the +X end by about 3 mm.
module pi_stack(s) {
  translate([-42.5, y_gpio-56, z_board]) cube([s == "zero2w" ? 65 : 88, 56, sled_stack(s)]);
}

// The fan on its sled bracket (keep-out and preview ghost); nothing for sleds without one
module pi_fan(s) {
  if (sled_fan(s)) translate([pi_fan_x0, pi_cy+pi_fan_dy-pi_fan[0]/2, z_floor+sled_pad+sled_t]) cube([pi_fan[1], pi_fan[0], pi_fan[0]]);
}

// Keep-out for a straight HDMI plug in the Pi, running forward through the divider pass-through
module pi_hdmi_plug(s) {
  translate([-42.5+sled_hdmi_x(s)-hdmi_plug[0]/2, y_gpio-sled_board(s)[1]-hdmi_plug[1], z_board+1.6+3.2-hdmi_plug[2]/2])
    cube(hdmi_plug);
}

// Keep-out for the Y-splitter's leg 2 in the DigiAMP+'s jack: a right-angle adapter (port_depth out of the HAT's edge
// toward the divider, the pass-through is open there) with the plug turned up
function amp_jack(s) = [-42.5 + amp_jack_x, y_gpio - 56, z_board + sled_stack(s) - amp_jack_dz];
module amp_dc_plug(s) {
  translate(amp_jack(s) - [7, port_depth, 7]) cube([14, port_depth, 14]);
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
      if (sled_fan(s))     // upright fan plate: the fan screws to its +X face
        translate([pi_fan_x0-pi_fan_t, pi_cy+pi_fan_dy-pi_fan[0]/2, 0]) cube([pi_fan_t, pi_fan[0], sled_t+pi_fan[0]]);
    }
    if (sled_fan(s)) translate([pi_fan_x0-pi_fan_t/2, pi_cy+pi_fan_dy, sled_t+pi_fan[0]/2]) {
      rotate([45, 0, 0]) cube([pi_fan_t+2, pi_fan[0]*0.65, pi_fan[0]*0.65], center=true);   // diamond intake: 45 deg top, no supports
      for (dy=[-1,1], dz=[-1,1]) translate([0, dy*pi_fan_sp/2, dz*pi_fan_sp/2]) rotate([0, 90, 0]) cylinder(d=2.9, h=pi_fan_t+2, center=true);   // M2.5 x 16 through the fan, nut on its outlet side
    }
    for (p=[sled_pts[0], sled_pts[1]]) translate([p[0], p[1], -1]) cylinder(d=4.4, h=sled_t+2);
    translate([sled_pts[2][0], sled_pts[2][1], -1]) cylinder(d=3.4, h=sled_t+2);
    for (h=sled_holes(s)) translate([x0+h[0], y0b+h[1], 0.6]) cylinder(d=2.2, h=20);   // M2.5 self-tap
    if (s == "zero2w") for (hx=[3.5, 61.5]) translate([x0+hx, y_gpio-52.5, 0.6]) cylinder(d=2.2, h=40);
    translate([sled_fan(s) ? -50 : -56, (sled_pts[0][1]+sled_pts[2][1])/2, sled_t-0.6]) rotate([0,0,90]) linear_extrude(1)
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

// Keep-out for the DC barrel plug in the rear face's top-right corner (a right-angle plug pointing back), in the same pose
module projector_ports(pan=0, tilt=0) {
  translate(pivot) rotate([0,0,pan]) rotate([-tilt,0,0]) translate(-pivot)
    translate([proj_w/2 - dc_jack[0] - 7, y_pf + proj_d, z_pj + proj_h - dc_jack[1] - 7]) cube([14, port_depth, 14]);
}
// Keep-out for the right-angle HDMI plug on the right face's I/O strip and its cable run back to the projector's rear plane
module projector_side_ports(pan=0, tilt=0) {
  translate(pivot) rotate([0,0,pan]) rotate([-tilt,0,0]) translate(-pivot) {
    translate([proj_w/2, y_pf + hdmi_y - 8, z_pj + proj_h - side_port_h]) cube([side_port_depth, 16, side_port_h]);
    translate([proj_w/2, y_pf + hdmi_y + 8, z_pj + proj_h - side_port_h]) cube([side_cable_d, proj_d - hdmi_y - 8, side_port_h]);
  }
}
// IR LED holder stuck to the projector's front face above the logo, in the same pose (pad on the face, body toward the window)
module ir_holder_placed(pan=0, tilt=0) {
  translate(pivot) rotate([0,0,pan]) rotate([-tilt,0,0]) translate(-pivot)
    translate([ir_x, y_pf, z_pj + ir_z]) rotate([90,0,0]) ir_holder();
}

// Projector block panned (about Z) and tilted (about X, + = lens up) around the ball-head pivot
module projector(pan=0, tilt=0) {
  translate(pivot) rotate([0,0,pan]) rotate([-tilt,0,0]) translate(-pivot)
    translate([-proj_w/2, y0+front_gap, z_pj]) cube([proj_w, proj_d, proj_h]);
}

if (part == "assembly") assembly();
else if (part == "base") tile_cut(tile, base_seam) union() { base_all(); if (ears && tile != "all") ears_tile(tile); }
else if (part == "lid") rotate([180,0,0]) rotate([lid_a,0,0]) lid_tile(tile) union() { lid(); if (ears && tile != "all") ears_lid(tile); }
else if (part == "window_frame") rotate([90,0,0]) window_frame();
else if (part == "pedestal") pedestal();
else if (part == "power_shelf") power_shelf();
else if (part == "hatch_cover") rotate([180,0,0]) hatch_cover(ears);
else if (part == "ir_holder") ir_holder();
else if (part == "cord_clamp") cord_clamp();
else if (part == "fit_coupon") fit_coupon();
else if (part == "split_test") split_test();
else if (part == "vent_cap") screen_cap(vent_open);
else if (part == "exhaust_cap") screen_cap(exh_open);
else if (part == "intake_cap") screen_cap(in_open);
else if (part == "sled") translate([0, -pi_cy, 0]) pi_sled(sled);
