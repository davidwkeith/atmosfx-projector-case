# Assembly

In order. Parts are in [BOM.md](BOM.md); wiring is in [WIRING.md](WIRING.md) and must be followed exactly. Nothing here has been built yet, so expect to adjust.

1. **Fit coupon.** Print `fit_coupon` first. Press in each heat-set insert, drive each screw into its pilot, hang the keyhole on an M4 bolt, snap a receptacle into the 5-15R cutout, and slide the acrylic into its slot. Adjust `insert_d`, `m4_insert_d`, `m3_insert_d`, `clearance` and so on in the SCAD until everything fits, then export the rest.
2. **Clean up the prints.** Snap out the two thin ribs in the window opening. Mask the window rebate, insert holes and screw holes, then spray the inside of both base halves and the lid matte black.
3. **Heat-set inserts.**
   - `base_front`: 4x M4 in the hatch studs (from outside).
   - `base_rear`: 1x M3 for the sled thumbscrew.
   - `pedestal`: 1/4-20 in the top.
4. **Screens.** Glue insect screen inside the three caps (`exhaust_cap`, `intake_cap`, `vent_cap`). Screw them over the right-wall louver banks (front bank: exhaust, rear bank: inlet, high bank over the shelf: the Pi vent), 2x M2 each.
5. **Join the base.** Silicone the joint faces, push the halves together and drive 4x M3 x 12 from the projector side through the divider into the rear half's collars. Wipe off the squeeze-out.
6. **Window.** Run a thin bead of silicone round the rebate, press the pane in, and screw the `window_frame` over it (4x M3 x 8).
7. **PIR.** Push the dome through the rear-wall hole from inside, screw the board on (2x M2), and seal round the dome outside with silicone.
8. **Projector mount.** Screw the `pedestal` to the floor (4x M3 x 10), add the stud and the ball head, and mount the projector. Fit the right-angle HDMI adapter (and a right-angle power plug if its port is on the back).
9. **Power shelf** (lid off, projector aside if needed). Snap the two receptacles into the plate from the front (the plugging side) and wire their tabs, the AC fuse and the cord exactly as in WIRING.md. Seat the shelf on its ledges, run the cord in through the gland with a drip loop outside, then plug the stock wall-wart into the lower receptacle (standing on the shelf, cord end toward the barrier) and the second one into the upper, and strap both through the shelf slots. Fuse and splice their DC leads on the low-voltage side with the DigiAMP+ and (if used) the relay.
10. **Pi sled.** Mount the Pi on its sled (4x M2.5), fit the DigiAMP+ (a Zero 2 W needs a 40-pin header soldered first), and plug the GPIO leads (PIR, IR/relay) into the DigiAMP+'s pass-through header per `pi/README.md`. Set the sled on its pins and fit the thumbscrew. Plug the HDMI cable into the Pi straight through the low part of the divider pass-through (there is no room for the plug behind the divider), loop it under the projector and up to its port. Connect DC to the DigiAMP+, and speaker wire down the chimney. Plug the chimney round the wires with foam.
11. **First power-up.** Follow the checklist at the end of WIRING.md before closing anything.
12. **Lid.** Stick 2 mm foam round the base rim, set the lid on, press it down onto the foam and drive the 4 side screws.
13. **Hatch.** Stick 1.5 mm foam round the hatch opening on the cover, and hang the cover on its keyholes.
14. **Software and aiming.** Flash and pair the Pi (`pi/README.md`), then place, stake, and aim ([AIMING.md](AIMING.md)).
