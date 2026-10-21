#!/usr/bin/env python3
"""Flatten PrusaSlicer system presets into one config for `prusa-slicer --load`.

    scripts/prusa_profile.py BUNDLE "printer:NAME" "print:NAME" "filament:NAME" > out.ini

BUNDLE is a vendor bundle such as PrusaResearch.ini. Each preset is resolved the
way PrusaSlicer does it (parents in `inherits` order, later ones win, then the
preset's own keys), so any PrusaSlicer version can load the result; the
--printer-profile/--print-profile/--material-profile options are
missing from older releases (2.7 in Ubuntu 24.04 has none).
"""

import sys

# Bundle bookkeeping that is not a slicing setting
SKIP = {"inherits", "renamed_from", "alias", "compatible_printers",
        "compatible_printers_condition", "compatible_prints",
        "compatible_prints_condition"}
ID_KEY = {"printer": "printer_settings_id", "print": "print_settings_id",
          "filament": "filament_settings_id"}


def read_bundle(path):
    sections, cur = {}, None
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.rstrip("\n")
            s = line.strip()
            if not s or s.startswith(("#", ";")):
                continue
            if s.startswith("[") and s.endswith("]"):
                cur = sections.setdefault(s[1:-1], {})
            elif cur is not None and "=" in line:
                k, v = line.split("=", 1)
                cur[k.strip()] = v.strip()
    return sections


def resolve(sections, kind, name, seen=()):
    key = f"{kind}:{name}"
    if key not in sections:
        sys.exit(f"prusa_profile: no [{key}] in the bundle")
    if key in seen:
        sys.exit(f"prusa_profile: inheritance loop at [{key}]")
    own = sections[key]
    out = {}
    for parent in filter(None, (p.strip() for p in own.get("inherits", "").split(";"))):
        out.update(resolve(sections, kind, parent, seen + (key,)))
    out.update(own)
    return out


def main(argv):
    if len(argv) < 3:
        sys.exit(__doc__)
    sections = read_bundle(argv[1])
    vendor = sections.get("vendor", {})
    print(f"# Flattened from {argv[1]} (config_version {vendor.get('config_version', '?')})")
    for spec in argv[2:]:
        kind, _, name = spec.partition(":")
        if kind not in ID_KEY:
            sys.exit(f"prusa_profile: {spec!r}: expected printer:, print: or filament:")
        conf = resolve(sections, kind, name)
        conf[ID_KEY[kind]] = name  # the bundle leaves it blank
        print(f"\n# [{spec}]")
        for k, v in conf.items():
            if k not in SKIP:
                print(f"{k} = {v}")


if __name__ == "__main__":
    main(sys.argv)
