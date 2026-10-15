#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["pyyaml>=6"]
# ///
"""Compare docs/measurements.yaml with the model.

    uv run scripts/check_measurements.py            # flags and computed rows
    uv run scripts/check_measurements.py --all      # also list every blank row
    uv run scripts/check_measurements.py other.yaml # check another copy

Each entry's default comes from projector_pi_case.scad (the key, or `param:`),
so the YAML never carries a copy that can go stale. Rows with no parameter
compare against their own `default:`. A measurement off by more than `tol`
is UPDATE; with no measurement, a `spec` off by more than `tol` is UPDATE (spec).
"""

import math
import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
SCAD = ROOT / "projector_pi_case.scad"
YAML = ROOT / "docs" / "measurements.yaml"


def scad_values(path):
    """Top-level `name = expr;` lines, evaluated in order. Anything we can't evaluate is skipped."""
    env = {"PI": math.pi, "true": True, "false": False, "undef": None,
           "sqrt": math.sqrt, "abs": abs, "min": min, "max": max, "floor": math.floor, "ceil": math.ceil,
           "sin": lambda d: math.sin(math.radians(d)), "cos": lambda d: math.cos(math.radians(d)),
           "tan": lambda d: math.tan(math.radians(d)), "atan": lambda x: math.degrees(math.atan(x))}
    vals = {}
    for line in path.read_text().splitlines():
        m = re.match(r"([a-z_][a-z0-9_]*)\s*=\s*([^;]+);", line)
        if not m or m.group(1) in vals:
            continue
        try:   # the repo's own SCAD, with no builtins: OpenSCAD arithmetic happens to be Python syntax
            v = eval(m.group(2), {"__builtins__": {}}, {**env, **vals})
        except Exception:
            continue
        if isinstance(v, (int, float, list)) and not isinstance(v, bool):
            vals[m.group(1)] = v
    return vals


def lookup(vals, param):
    """`name` or `name[i]`."""
    m = re.fullmatch(r"([a-z_][a-z0-9_]*)(?:\[(\d+)\])?", param)
    if not m or m.group(1) not in vals:
        return None
    v = vals[m.group(1)]
    if m.group(2) is not None:
        return v[int(m.group(2))] if isinstance(v, list) else None
    return v if isinstance(v, (int, float)) else None


def num(x):
    return x if isinstance(x, (int, float)) and not isinstance(x, bool) else None


def fmt(x):
    if x is None:
        return "-"
    return f"{x:g}" if isinstance(x, float) else str(x)


def flag(value, default, tol, from_spec):
    if value is None or default is None or tol is None:
        return ""
    if abs(value - default) > tol:
        return "UPDATE (spec)" if from_spec else "UPDATE"
    return "ok"


def main():
    show_all = "--all" in sys.argv[1:]
    files = [a for a in sys.argv[1:] if not a.startswith("--")]
    vals = scad_values(SCAD)
    data = yaml.safe_load(Path(files[0] if files else YAML).read_text())
    rows, blank = [], []

    def m(group, key):
        e = (data.get(group) or {}).get(key) or {}
        return num(e.get("measured"))

    # Computed measurements fill in before the comparison.
    computed = {}
    d, w, h, b = m("throw", "distance"), m("throw", "image_w"), m("throw", "image_h"), m("throw", "bottom_above_axis")
    if d and w:
        computed[("throw", "throw_ratio")] = round(d / w, 2)
    if h and b is not None:
        computed[("throw", "lens_offset")] = round(2 * b / h + 1, 2)

    for group, entries in data.items():
        if group == "observations" or not isinstance(entries, dict):
            continue
        for key, e in entries.items():
            if not isinstance(e, dict):
                continue
            param = e.get("param", key)
            default = lookup(vals, param) if param in vals or "[" in param else None
            if default is None:
                default = num(e.get("default"))
            measured = num(e.get("measured"))
            if (group, key) in computed and measured is None:
                measured = computed[(group, key)]
            spec, tol = num(e.get("spec")), num(e.get("tol"))
            value = measured if measured is not None else spec
            f = flag(value, default, tol, measured is None)
            name = f"{group}.{key}"
            if measured is None and not e.get("computed"):
                blank.append(name)
            if measured is not None or f.startswith("UPDATE"):
                rows.append((name, param if param != key else "", default, spec, measured, tol, f))

    print(f"{'entry':32} {'param':14} {'model':>8} {'spec':>8} {'measured':>9} {'tol':>6}  flag")
    for name, param, default, spec, measured, tol, f in rows:
        print(f"{name:32} {param:14} {fmt(default):>8} {fmt(spec):>8} {fmt(measured):>9} {fmt(tol):>6}  {f}")

    # Coupon shrink and the pane's clearance after it.
    print()
    strip = m("coupon", "strip_len")
    if strip:
        shrink = (118 - strip) / 118 * 100
        pane = m("window", "pane_w") or vals["pane_w"]
        clr = m("coupon", "clearance") or vals["clearance"]
        side = ((pane + 2 * clr) * (1 - shrink / 100) - pane) / 2
        print(f"XY shrink {shrink:.2f} %; pane clearance after shrink {side:.2f} mm per side: "
              f"{'TIGHT (see docs/PRINTING.md, Fit coupon)' if side < 0.1 else 'ok'}")
    else:
        print("XY shrink: measure the coupon strip (coupon.strip_len)")

    # Site: image size and the tilt to centre it.
    dist = m("site", "distance")
    if dist:
        ratio = computed.get(("throw", "throw_ratio")) or m("throw", "throw_ratio") or vals["throw_ratio"]
        print(f"Image width at {dist:g} mm: {dist / ratio:.0f} mm (throw ratio {ratio:g})")
        lo, hi = m("site", "surface_bottom"), m("site", "surface_top")
        if lo is not None and hi is not None:
            lens = m("site", "lens_height") or vals["z_lens"]
            tilt = math.degrees(math.atan(((lo + hi) / 2 - lens) / dist))
            slope = m("site", "ground_slope_deg") or 0
            ok = -vals["aim_max"] <= tilt <= vals["cone_tilt"]
            print(f"Tilt to centre the image: {tilt:.1f} deg (limit +{vals['cone_tilt']} up, "
                  f"-{vals['aim_max']} down){', plus ' + fmt(slope) + ' deg ground slope' if slope else ''}: "
                  f"{'ok' if ok else 'OVER LIMIT: a riser or a longer throw'}")
    else:
        print("Site: fill in site.distance and the surface edges for the tilt")

    updates = sum(1 for r in rows if r[-1].startswith("UPDATE"))
    print(f"\n{updates} to update, {len(blank)} still blank" + ("" if show_all else " (--all lists them)"))
    if show_all:
        for name in blank:
            print("  " + name)


if __name__ == "__main__":
    main()
