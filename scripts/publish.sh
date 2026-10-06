#!/usr/bin/env bash
# Create a public GitHub repo from this directory and push (needs gh: brew install gh && gh auth login).
set -e
cd "$(dirname "$0")/.."
[ -d .git ] || { git init -q -b main; git add -A; git commit -q -m "Initial commit: v0.8 parametric case"; }
gh repo create atmosfx-projector-case --public --source=. --remote=origin --push
