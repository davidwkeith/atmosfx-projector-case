#!/usr/bin/env bash
# Slice STLs with PrusaSlicer's CLI and print time and weight per part (docs/PRINTING.md).
#   scripts/slice.sh                  # every stl/*.stl (run `make parts` first)
#   scripts/slice.sh base_front pedestal
# G-code goes to gcode/ (gitignored). Stock MK3S profiles, flattened from the vendor
# bundle by scripts/prusa_profile.py; ASA for outside parts, PETG for inside ones, and
# slicer/asa_tiles.ini (+ asa_base_front.ini) on the base and lid tiles. The four tiles
# slice at "0.30mm DRAFT @MK3" (layer_h = 0.3 in the SCAD), everything else at "0.20mm SPEED @MK3".
# Env: PRUSASLICER (binary), PRUSA_BUNDLE (PrusaResearch.ini), PRINT_PROFILE (one profile for every part).
set -euo pipefail
cd "$(dirname "$0")/.."

PRINTER="Original Prusa i3 MK3S & MK3S+"
SPEED="0.20mm SPEED @MK3" DRAFT="0.30mm DRAFT @MK3"

first() { for f in "$@"; do [ -n "$f" ] && [ -e "$f" ] && { echo "$f"; return; }; done; }

PS=${PRUSASLICER:-$(first "$(command -v prusa-slicer || true)" "$(command -v PrusaSlicer || true)" \
  "/Applications/Original Prusa Drivers/PrusaSlicer.app/Contents/MacOS/PrusaSlicer" \
  "/Applications/PrusaSlicer.app/Contents/MacOS/PrusaSlicer")}
[ -n "$PS" ] || { echo "PrusaSlicer not found: install it or set PRUSASLICER=/path/to/binary" >&2; exit 1; }

# The GUI's own copy (kept up to date by its config updates) first, then the one bundled with the app
bin_dir=$(dirname "$(realpath "$PS")")
BUNDLE=${PRUSA_BUNDLE:-$(first \
  "$HOME/Library/Application Support/PrusaSlicer/vendor/PrusaResearch.ini" \
  "${XDG_CONFIG_HOME:-$HOME/.config}/PrusaSlicer/vendor/PrusaResearch.ini" \
  "$bin_dir/../Resources/profiles/PrusaResearch.ini" \
  "$bin_dir/../share/PrusaSlicer/profiles/PrusaResearch.ini" \
  "/usr/share/PrusaSlicer/profiles/PrusaResearch.ini")}
[ -n "$BUNDLE" ] || { echo "PrusaResearch.ini not found: set PRUSA_BUNDLE=/path/to/PrusaResearch.ini" >&2; exit 1; }

tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
# profile MATERIAL PRINT_PROFILE -> path of the flattened config (made once per pair)
profile() {
  local f="$tmp/$1 $2.ini"
  [ -e "$f" ] || scripts/prusa_profile.py "$BUNDLE" "printer:$PRINTER" "print:$2" "filament:Prusament $1" > "$f"
  echo "$f"
}

if [ $# -eq 0 ]; then
  set -- stl/*.stl
  [ -e "$1" ] || { echo "no STLs in stl/: run make parts" >&2; exit 1; }
fi

# "1d 12h 32m 5s" -> "36 h 32 m"
hm() { awk '{d=h=m=0; for(i=1;i<=NF;i++){v=$i+0; if($i~/d$/)d=v; else if($i~/h$/)h=v; else if($i~/m$/)m=v}
  h+=24*d; if(h) printf "%d h %d m", h, m; else printf "%d m", m}'; }

for arg in "$@"; do
  [ -e "stl/$(basename "$arg" .stl).stl" ] || { echo "stl/$(basename "$arg" .stl).stl missing: run make parts" >&2; exit 1; }
done

mkdir -p gcode
echo "$("$PS" --help | head -1)"
echo "$(head -1 "$(profile PETG "$SPEED")" | sed 's/^# //')"
echo
echo "| Part | Profile | Time | Material, weight |"
echo "|---|---|---|---|"
for arg in "$@"; do
  p=$(basename "$arg" .stl)
  stl=stl/$p.stl
  case $p in base_*|lid_*|hatch_cover|cord_clamp|fit_coupon) m=ASA ;; *) m=PETG ;; esac
  case $p in base_*|lid_*) pp=$DRAFT ;; *) pp=$SPEED ;; esac
  pp=${PRINT_PROFILE:-$pp}
  loads=(--load "$(profile "$m" "$pp")")
  case $p in base_*|lid_*) loads+=(--load slicer/asa_tiles.ini) ;; esac
  [ "$p" = base_front ] && loads+=(--load slicer/asa_base_front.ini)
  "$PS" "${loads[@]}" --export-gcode --output "gcode/$p.gcode" "$stl" > "$tmp/$p.log" 2>&1 \
    || { cat "$tmp/$p.log" >&2; echo "$p: slicing failed" >&2; exit 1; }
  t=$(sed -n 's/^; estimated printing time (normal mode) = //p' "gcode/$p.gcode" | hm)
  g=$(sed -n 's/^; total filament used \[g\] = //p' "gcode/$p.gcode")
  printf '| `%s` | %s | %s | %s %.0f g |\n' "$p" "${pp%% @*}" "$t" "$m" "$g"
done
