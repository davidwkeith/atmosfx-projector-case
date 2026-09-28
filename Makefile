# Export every printable part to stl/ (set OPENSCAD=/path/to/openscad if it is not on PATH)
OPENSCAD ?= openscad
SCAD = projector_pi_case.scad
OUT  = stl

.PHONY: parts clean
parts: $(OUT)/base_front.stl $(OUT)/base_rear.stl $(OUT)/lid_front.stl $(OUT)/lid_rear.stl \
     $(OUT)/window_frame.stl $(OUT)/pedestal.stl $(OUT)/hatch_cover.stl $(OUT)/power_shelf.stl \
     $(OUT)/sled_pi3.stl $(OUT)/sled_pi4.stl $(OUT)/sled_pi5.stl $(OUT)/sled_zero2w.stl $(OUT)/ir_holder.stl \
     $(OUT)/vent_cap.stl $(OUT)/intake_cap.stl

$(OUT):
	mkdir -p $(OUT)

$(OUT)/base_front.stl: $(SCAD) | $(OUT)
	$(OPENSCAD) -o $@ -D 'part="base"' -D 'tile="front"' $(SCAD)
$(OUT)/base_rear.stl: $(SCAD) | $(OUT)
	$(OPENSCAD) -o $@ -D 'part="base"' -D 'tile="rear"' $(SCAD)
$(OUT)/lid_front.stl: $(SCAD) | $(OUT)
	$(OPENSCAD) -o $@ -D 'part="lid"' -D 'tile="front"' $(SCAD)
$(OUT)/lid_rear.stl: $(SCAD) | $(OUT)
	$(OPENSCAD) -o $@ -D 'part="lid"' -D 'tile="rear"' $(SCAD)
$(OUT)/window_frame.stl: $(SCAD) | $(OUT)
	$(OPENSCAD) -o $@ -D 'part="window_frame"' $(SCAD)
$(OUT)/pedestal.stl: $(SCAD) | $(OUT)
	$(OPENSCAD) -o $@ -D 'part="pedestal"' $(SCAD)
$(OUT)/hatch_cover.stl: $(SCAD) | $(OUT)
	$(OPENSCAD) -o $@ -D 'part="hatch_cover"' $(SCAD)
$(OUT)/power_shelf.stl: $(SCAD) | $(OUT)
	$(OPENSCAD) -o $@ -D 'part="power_shelf"' $(SCAD)

$(OUT)/ir_holder.stl: $(SCAD) | $(OUT)
	$(OPENSCAD) -o $@ -D 'part="ir_holder"' $(SCAD)

$(OUT)/vent_cap.stl: $(SCAD) | $(OUT)
	$(OPENSCAD) -o $@ -D 'part="vent_cap"' $(SCAD)
$(OUT)/intake_cap.stl: $(SCAD) | $(OUT)
	$(OPENSCAD) -o $@ -D 'part="intake_cap"' $(SCAD)

$(OUT)/sled_%.stl: $(SCAD) | $(OUT)
	$(OPENSCAD) -o $@ -D 'part="sled"' -D 'sled="$*"' $(SCAD)

clean:
	rm -rf $(OUT)
