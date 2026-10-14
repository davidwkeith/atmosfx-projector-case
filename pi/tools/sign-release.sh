#!/bin/bash
# Sign a release's Pi tarball, attach the signature and publish the release. Run on
# your own machine with the release key, never in CI: the key is what lets a Pi trust
# an update. CI leaves each release as a draft because the repo has immutable
# releases: once published, nothing can be added, so the .sig has to go in first.
#   pi/tools/sign-release.sh v0.9.1 [~/.ssh/videofx-release]
set -euo pipefail
[ $# -ge 1 ] || { echo "usage: sign-release.sh vX.Y.Z [key]" >&2; exit 2; }
tag=$1 key=${2:-$HOME/.ssh/videofx-release}
pi=$(cd "$(dirname "$0")/.." && pwd)
draft=$(gh release view "$tag" --json isDraft -q .isDraft) || {
  echo "no release $tag yet: wait for CI to finish (gh run list --branch $tag)" >&2
  exit 1
}
if [ "$draft" != true ]; then
  echo "$tag is already published, and published releases are immutable: it can't take a signature." >&2
  echo "Bump the version, tag again, and sign the new draft." >&2
  exit 1
fi
dir=$(mktemp -d)
trap 'rm -rf "$dir"' EXIT
gh release download "$tag" --pattern 'videofx-pi-*.tar.gz' --dir "$dir"
f=$(ls "$dir"/videofx-pi-*.tar.gz)
ssh-keygen -Y sign -f "$key" -n videofx-release "$f" # writes $f.sig
# Catch a wrong key before a Pi does: check against the committed allowed_signers.
"$pi/system/videofx-verify-release" "$f" "$f.sig" "$pi/system/allowed_signers"
gh release upload "$tag" "$f.sig"
gh release edit "$tag" --draft=false
echo "signed and published $tag"
