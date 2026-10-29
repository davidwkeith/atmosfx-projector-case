#!/usr/bin/env bash
# Renders docs/assembly/step-NN.png for docs/ASSEMBLY.md: the assembly built up to each step (part=assembly, step=N),
# the step's own parts highlighted and pulled out. Uses xvfb-run on headless Linux; plain openscad on macOS.
set -e
OPENSCAD=${OPENSCAD:-openscad}
cd "$(dirname "$0")/.."
RUN="$OPENSCAD"; command -v xvfb-run >/dev/null && RUN="xvfb-run -a $OPENSCAD"
mkdir -p docs/assembly
# --camera needs all 7 values (tx,ty,tz,rx,ry,rz,dist)
r() { n=$1; cam=$2; shift 2; $RUN -o "docs/assembly/step-$n.png" --preview --imgsize=1200,900 --colorscheme=Tomorrow --camera=$cam "$@" projector_pi_case.scad; }
s() { n=$1; cam=$2; shift 2; r "$n" "$cam" -D part=\"assembly\" -D step="${n#0}" "$@"; }
r 01 30,30,0,50,0,20,330 -D part=\"fit_coupon\"
s 02 0,30,40,120,0,330,1700
s 03 -60,30,70,70,0,300,1300
s 04 20,20,60,40,0,250,1400
s 05 0,30,80,60,0,330,1200
s 06 0,0,80,40,0,200,1000
s 07 50,110,140,50,0,20,600
s 08 0,-20,120,45,0,30,1300
s 09 10,50,40,12,0,200,650
s 10 0,80,110,45,0,200,1400
s 12 0,0,140,60,0,30,1300
s 13 -80,0,80,72,0,300,1200
s 14 0,-20,90,62,0,28,1200 -D aim=[0,10]
