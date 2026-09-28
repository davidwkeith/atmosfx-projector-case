#!/bin/bash
# Build dist/videofx-pi-<version>.tar.gz from pi/ (no node_modules, no secrets),
# with version.json carrying the git sha. Attach it to a GitHub release:
#   pi/tools/make-release.sh && gh release create v$(node -p "require('./pi/package.json').version") pi/dist/videofx-pi-*.tar.gz
set -euo pipefail
pi=$(cd "$(dirname "$0")/.." && pwd)
version=$(node -p "require('$pi/package.json').version")
sha=$(git -C "$pi" rev-parse --short HEAD 2>/dev/null || echo unknown)
stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT
name=videofx-pi-$version
mkdir "$stage/$name"
rsync -a --exclude node_modules --exclude .build --exclude deploy --exclude dist --exclude config "$pi/" "$stage/$name/"
printf '{"version":"%s","sha":"%s"}\n' "$version" "$sha" >"$stage/$name/version.json"
mkdir -p "$pi/dist"
tar -czf "$pi/dist/$name.tar.gz" -C "$stage" "$name"
echo "$pi/dist/$name.tar.gz"
