#!/bin/bash
# Regenerates src/default/videofx-default.mp4: the clip a fresh VideoFX plays
# until real videos are uploaded. "VideoFX" bounces around a light alignment
# grid, which doubles as a focus / keystone / aim check for the projector.
# Needs ffmpeg and ImageMagick. The mp4 is committed, so only run this to change it.
#   FONT=/path/to/bold.ttf tools/make-default-video.sh
set -euo pipefail
cd "$(dirname "$0")/.."
out=src/default/videofx-default.mp4
font=${FONT:-/System/Library/Fonts/Supplemental/Arial Bold.ttf}   # on Linux: .../dejavu/DejaVuSans-Bold.ttf
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT

W=1920 H=1080
# The word, rendered once; ffmpeg only moves it.
magick -background none -fill '#2b2b2b' -font "$font" -pointsize 190 label:VideoFX \
  -bordercolor none -border 12 "$tmp/word.png"
set -- $(magick identify -format '%w %h' "$tmp/word.png")
TW=$1 TH=$2

# Loop = 30 s: x bounces every 10 s and y every 6 s (both divide 30), so the
# last frame leads straight into the first with no jump.
tri() { echo "abs(2*mod(t/$1\,1)-1)"; }   # triangle wave 0..1..0
ffmpeg -y -loglevel error -f lavfi -i "color=c=0xf4f1ea:s=${W}x${H}:r=30:d=30" -loop 1 -i "$tmp/word.png" -filter_complex "
 [0]drawgrid=w=60:h=60:t=1:c=0xd9d4c8,
    drawgrid=w=240:h=240:t=2:c=0xb9b2a2,
    drawbox=x=0:y=0:w=iw:h=ih:c=0xb9b2a2:t=6,
    drawbox=x=iw/2-1:y=0:w=2:h=ih:c=0xe07b39,
    drawbox=x=0:y=ih/2-1:w=iw:h=2:c=0xe07b39[bg];
 [bg][1]overlay=x='($W-$TW)*$(tri 10)':y='($H-$TH)*$(tri 6)':shortest=1" \
  -t 30 -c:v libx264 -preset slow -crf 22 -profile:v high -level 4.1 -pix_fmt yuv420p -movflags +faststart -an "$out"
ls -l "$out"
