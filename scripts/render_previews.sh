#!/usr/bin/env bash
# Renders preview/*.png (crop by hand). Uses xvfb-run on headless Linux; plain openscad on macOS.
set -e
OPENSCAD=${OPENSCAD:-openscad}
cd "$(dirname "$0")/.."
RUN="$OPENSCAD"; command -v xvfb-run >/dev/null && RUN="xvfb-run -a $OPENSCAD"
r() { n=$1; shift; $RUN -o "preview/$n.png" --preview --imgsize=1400,1000 "$@" projector_pi_case.scad; }
# NOTE: --camera needs all 7 values (tx,ty,tz,rx,ry,rz,dist); --viewall gave tiny renders, so distance is set by hand.
r exploded --camera=0,-20,100,62,0,28,1500 -D part=\"assembly\" -D explode=90
r interior --camera=0,0,60,35,0,200,1300  -D part=\"assembly\" -D explode=400
r aim-hatch --camera=100,-30,80,72,0,240,1000 -D part=\"assembly\" -D explode=0
r power-shelf-top --camera=0,42,40,55,0,25,460 -D part=\"power_shelf\"
