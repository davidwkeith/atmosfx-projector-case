#!/bin/bash
# Sign a published release's Pi tarball and attach the signature. Run on your own
# machine with the release key, never in CI: the key is what lets a Pi trust an update.
#   pi/tools/sign-release.sh v0.9.0 [~/.ssh/videofx-release]
set -euo pipefail
[ $# -ge 1 ] || { echo "usage: sign-release.sh vX.Y.Z [key]" >&2; exit 2; }
tag=$1 key=${2:-$HOME/.ssh/videofx-release}
pi=$(cd "$(dirname "$0")/.." && pwd)
dir=$(mktemp -d)
trap 'rm -rf "$dir"' EXIT
gh release download "$tag" --pattern 'videofx-pi-*.tar.gz' --dir "$dir"
f=$(ls "$dir"/videofx-pi-*.tar.gz)
ssh-keygen -Y sign -f "$key" -n videofx-release "$f" # writes $f.sig
# Catch a wrong key before a Pi does: check against the committed allowed_signers.
"$pi/system/videofx-verify-release" "$f" "$f.sig" "$pi/system/allowed_signers"
gh release upload "$tag" "$f.sig"
echo "signed $tag: $(basename "$f").sig uploaded"
