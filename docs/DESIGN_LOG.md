# Design log

Chronological record of decisions, including dead ends, so the reasoning survives a change of tools.

## Requirements (from the owner)

- Waterproof case for a small projector and a Raspberry Pi 3 that controls an AtmosFX pumpkin effect
- Sits on the ground; projector on an internal ball joint for easy aiming
- Aiming should be as quick as possible (it is the primary setup task)
- A single power cord for the box; the projector uses a DC brick that can be modified to feed both projector and Pi; the brick goes inside the case

## Versions

| Ver | What changed | Why |
|---|---|---|
| v0.1 | First parametric box: base, sloped lid with visor, acrylic window, louvers, fan, Pi compartment, 1/4-20 plate | Assumed a projector twice a DSLR wide (260 mm) |
| v0.2 | Ground-standing on feet; tripod insert and plate replaced by a ball-head pedestal | Owner: case sits on ground, projector on a ball joint |
| v0.3 | Resized to a real mini projector (about 171 x 134 x 75 mm, 0.72 kg); split front/rear instead of quarters | Listing dimensions; smaller box fits the MK3S bed in two pieces |
| v0.4 | Tool-free aim hatch on the left wall, keyhole cover, rain hood; intake moved from wall louvers to floor slots | Aiming must be quick; the wall space was needed for the hatch |
| v0.5 | One AC cord, power shelf on 45 deg ledges above the Pi | Owner: single power cord |
| v0.6 | Low-voltage DC variant: brick outside, buck converter for the Pi, zip-tie shelf | Owner: projector has a DC brick that can feed both |
| v0.7 | Brick inside on the shelf: cradle, barrier, cord notch, heat louvers above the shelf | Owner: brick should be inside |
| v0.8 | Gland above the shelf; barrier 40 mm; keyholes flipped; hatch 8 mm lower and hood raised for the lift; lid scarf joint, seam rib, gasket land; front/rear gaps 30/26 | Review: mains ran through the Pi zone, cover would fall off, lid seam leaks onto the projector, aim range did not fit |

## Decisions and dead ends

- **Sealed vs rain-proof.** Sealing overheats projectors. AtmosFX says any enclosure must allow air circulation; a forum builder who put a projector in a louvered plastic tub felt it would just melt it. So: rain-shedding louvers, floor intake, exhaust fan.
- **Mini ball head, not a printed ball joint.** Commercial heads are cheap and lock reliably; printed friction joints creep. Rating matters: the Tilta mini head is rated 1.5 kg, the projector is about 0.72 kg. A heavy-duty head (Kessler low-profile, about 3.5 in tall) would push the base past the 210 mm Z limit and force a horizontal split.
- **Tripod insert removed** in v0.2 when the case became ground-standing.
- **Quarters to halves.** With a 260 mm projector the box needed four tiles. With the real projector, front/rear halves are enough. The divider sits at the seam.
- **Aim hatch.** Options weighed: tool-free lid latches (still lift the whole lid), a side hatch with screws, a keyhole cover. Keyholes won: nothing to unscrew, cover hangs on four M4 bolts, lift up and off. Hood is a 45 deg wedge (no supports). It first collided with the cover top and then with the lid skirt; shrunk to 10 mm and lifted; verified clear.
- **Floor intake.** Wall louvers moved out of the way of the hatch; intake now comes through slots in the raised floor. Risk: ground splash. Keep off wet ground.
- **Power.** Mains inside is the least safe option but the owner asked for it. Mitigations: barrier wall, GFCI, fuse, cord grip, PETG/ASA. If the owner changes their mind, v0.6 (brick outside) is the safer variant: revert `power_shelf` and `gland_d`.
- **Review fixes (v0.8).** The keyholes had the big end above the bolt, so gravity would have released the cover; now the narrow end is up and the hood sits `kh_drop` higher so the cover can lift. The AC cord entered below the shelf and ran past the Pi; the barrier only existed above the shelf, so the gland moved up to the AC side. The barrier (25 mm) was shorter than the brick (32 mm). The lid seam lands over the projector and cannot move behind the divider (the front lid tile would be about 258 mm), so it became a 45 deg scarf with a rib under the roof; a horizontal shiplap would have needed supports on the rear tile. The sloped roof only met the gasket at the rear edge, so the lid gained a flat land. Owner chose fuses on both AC and DC.
- **Aim range.** The new aim sweep in `check_clash.sh` showed the claimed +/-15 deg never fit: the ball pivot is about 90 mm below the top corners, so tilt swings them about 20 mm into the window frame or the divider. Gaps grew to 30/26 mm (base_front 241 mm). 15 deg pan and tilt together would need about 254 mm, so combined aim is limited to 10 deg. Setting the case roughly on target covers the rest.
- **Stock pane.** The pane was 96 x 76 mm, not a stock size. It is now a parameter set to 3 x 5 in (127 x 76.2 mm, 1/8 in thick) and the window is derived from it, 111 x 60 mm, which also gives the light cone more room when panned. 4 x 4 in would push the frame above the base rim; 4 x 6 in is wider than the space between the front lid posts.
- **Audio.** Owner wants an amp inside and speakers behind the projection on standard speaker wire. HiFiBerry Amp4 HAT: I2S DAC plus stereo class D amp on one board, runs from the 12-24 V splice and powers the Pi, so the buck converter goes. The Pi 3's analog jack is too noisy to feed an amp. Speaker zip cord is flat and won't seal in a PG gland, so it goes down a 15 mm floor chimney and out under the case. The shelf rose 5 mm to clear the HAT; the louvers and AC gland above it moved with it.
- **Pi sleds.** Owner wants multiple Pi generations. The Pi 3B/3B+, 4B and 5 share the 85 x 56 board and 58 x 49 hole pattern, so the sled is mainly a fixed interface plus easy removal. The Zero 2 W (58 x 23) is the real outlier. Lift-out from the top was chosen over a rear slide-out door: no new wall opening to keep dry. Sleds carry only the Pi and HAT; power and speaker wires unplug. Aligning every board's GPIO edge keeps the Amp4 in one place; the Zero sled supports the overhanging half of the HAT. The Pi 5 with Active Cooler needs a taller stack, so the shelf rose to 60 mm and the AC gland and pass-through now follow the shelf.
- **Startle scares.** Customer research: AtmosFX sells a motion-sensor player for buffer-plus-scare clips, and people build the same on Pis. The PIR goes in the rear wall because the case faces the projection surface, so visitors approach from behind it. A PIR can't see through the acrylic window (it blocks IR), so the dome sits in its own hole under a hood. Home automations can trigger scares too, so a remote or existing sensor works without the built-in one. Multi-projector sync was left for later.
- **Printability pass.** The base prints upright, and the floor was floating 6 mm up on two ribs and corner pads, a 148 mm bridge across the whole floor; it now stands on eight front-to-back ribs. The hatch became a 45 deg diamond (still 120 mm wide at the ball head). The window can't take a pointed top because the pane has to cover it, so two 0.8 mm snap-out ribs split its 111 mm bridge into thirds. The divider pass-through got a gabled top.
- **Projector power.** Owner chose HDMI-CEC, plus a fallback for projectors without it: a relay on the DC + line and an IR LED sending the remote's power code after the relay closes.
- **Heat.** The Pi zone held the brick, the amp and possibly a Pi 5 with only passive vents, and the original fan's power and control were never specified. Now both zones have 12 V PWM fans driven by the Pi from temperature sensors, the shelf has vents on its low-voltage side so heat from below reaches the Pi-zone fan, and the upper right-wall louvers gave way to that fan. The fan bodies are now in the aim sweep. A top-level variable used before its definition (`pi_fan_z` before `shelf_zz`) came back as undef; the new clash check caught it.
- **Insect screen.** A warm vented box outdoors invites wasps and spiders. Printed mesh is too coarse, so real screen is glued into printed caps over each louver bank and the floor intake, and clamped behind the fans. The first cap layout put a screw tab behind the rear lid post where no driver could reach; the tabs moved to top and bottom.
- **Tripod.** Owner wants the whole case tripod-mountable. 3/8-16 is the heavy-head standard and 1/4-20 fits quick-release plates, so both are fitted, in a solid pad flush with the rib bottoms so a plate seats flat and the ribs carry the load. The 3/8 insert is longer than the floor is thick, so it gets a small boss inside. Its position is an estimate of the centre of mass.
- **Dew.** Considered a pane heater switched on dew point; owner decided against it. The visor and fan airflow are the only defence against condensation on the window.
- **Keyhole leak, resolved by the diamond hatch.** With the square opening, the wide ends of the upper keyholes sat over the opening. The studs are at the square's corners (+/-56, +/-56), so the nearest wide end is about 98 mm (|y|+|z|) from the centre, far outside the diamond's 60 mm edge: every keyhole now sits over solid wall.
- **Clash script.** The OpenSCAD snapshot uses the manifold backend, which never prints "Volumes: 1", so zero-volume contact (the shelf on its ledges) read as a clash. The script now measures intersection volume. It also used to report CLASH when OpenSCAD failed to run.
- **Bugs hit:** shell `brace expansion` failing under sh (use bash), top-level variable used before definition (`lid_seam`/`yfl`), phony `make stl` clashing with the `stl/` directory (target is `parts`), tiny preview renders from `--viewall`.

## References

- AtmosFX, DIY outdoor projector enclosures: https://atmosfx.com/blogs/community/digital-decorating-101-outdoor-decorating-part-3-diy-outdoor-enclosures
- AtmosFX Illumibot large enclosure (size/fan reference): https://atmosfx.com/products/illumibot-large-projector-enclosure
- ControlBooth thread on weatherproofing a projector: https://www.controlbooth.com/threads/weatherproof-a-projector.26853/latest
- Smart Home Hookup, outdoor projector + Pi install: https://www.thesmarthomehookup.com/test_install/?p=1849
- Tilta mini ball head (1.5 kg rating): https://tilta.com/shop/tilta-mini-ball-head-mount/
- Nanlite mini ball head (male 1/4-20 top, 66 x 35.5 x 25.4 mm): https://www.adorama.com/nanlite-mini-ball-head-hot-shoe-adapter-1-4-20-mount/p/nnasbh14
- Kessler low-profile ball head (40 lb, about 3.5 in): https://kesslercrane.com/products/low-profile-ball-head-1-4-20-mg1007
- Typical dimensions for this projector class (6.74 x 5.28 x 2.96 in, 0.72 kg), Amazon listing for a similar unit: https://www.amazon.com/Projector-CLOKOWE-Upgraded-Portable-Compatible/dp/B09Q5GJ7J7 (a different brand of the same class is not guaranteed to match; measure the real unit)
- OpenSCAD Playground (browser preview, works on iOS): https://github.com/openscad/openscad-playground
