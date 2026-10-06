#!/bin/bash
# Write the Raspberry Pi Imager OS list for a release image, so Imager offers
# the image with its usual first-boot options (user, password, Wi-Fi, SSH, locale):
#   pi/tools/imager-json.sh pi/deploy/videofx-0.8.1-arm64.img.xz \
#     https://github.com/OWNER/REPO/releases/download/v0.8.1/videofx-0.8.1-arm64.img.xz > videofx-imager.json
# In Imager: App options > Content repository > Custom URL (or Custom file).
# Needs xz and sha256sum; reads the compressed image twice (sizes and hashes).
set -euo pipefail
img=${1:?usage: imager-json.sh <image.img.xz> <download url> [release date]}
url=${2:?usage: imager-json.sh <image.img.xz> <download url> [release date]}
date=${3:-$(date +%Y-%m-%d)}
pi=$(cd "$(dirname "$0")/.." && pwd)
version=$(node -p "require('$pi/package.json').version")
repo=${url%/releases/*}

dl_size=$(wc -c <"$img" | tr -d ' ')
dl_sha=$(sha256sum "$img" | cut -d' ' -f1)
ex_size=$(xz -l --robot "$img" | awk '$1 == "file" { print $5 }')
ex_sha=$(xz -dc "$img" | sha256sum | cut -d' ' -f1)

# Device entries copied from Raspberry Pi's own list, so Imager's device filter works.
# The Zero 2 W shares the Pi 3 tags. init_format cloudinit-rpi: the same first-boot
# mechanism as Raspberry Pi OS trixie, whose cloud-init packages the image carries.
cat <<JSON
{
  "imager": {
    "latest_version": "2.0.0",
    "url": "https://www.raspberrypi.com/software/",
    "devices": [
      { "name": "Raspberry Pi 5", "tags": ["pi5-64bit"], "icon": "https://downloads.raspberrypi.com/imager/icons/RPi_5.png", "description": "Raspberry Pi 5, 500 / 500+, and Compute Module 5", "matching_type": "exclusive" },
      { "name": "Raspberry Pi 4", "tags": ["pi4-64bit"], "icon": "https://downloads.raspberrypi.com/imager/icons/RPi_4.png", "description": "Raspberry Pi 4 Model B, 400, and Compute Module 4 / 4S", "matching_type": "inclusive" },
      { "name": "Raspberry Pi 3", "tags": ["pi3-64bit"], "icon": "https://downloads.raspberrypi.com/imager/icons/RPi_3.png", "description": "Raspberry Pi 3 Model A+ / B / B+ and Compute Module 3 / 3+", "matching_type": "inclusive" },
      { "name": "Raspberry Pi Zero 2 W", "tags": ["pi3-64bit"], "icon": "https://downloads.raspberrypi.com/imager/icons/RPi_Zero_2_W.png", "description": "Raspberry Pi Zero 2 W", "matching_type": "inclusive" }
    ]
  },
  "os_list": [
    {
      "name": "VideoFX projector player $version",
      "description": "Raspberry Pi OS Lite (64-bit) with the AtmosFX projector case player: Matter, web page, schedule, scares, DMX. Set your user, password and Wi-Fi in the options; the Pi names itself videofx-xxxx.",
      "icon": "https://downloads.raspberrypi.com/imager/icons/RPi_3.png",
      "website": "$repo",
      "url": "$url",
      "release_date": "$date",
      "extract_size": $ex_size,
      "extract_sha256": "$ex_sha",
      "image_download_size": $dl_size,
      "image_download_sha256": "$dl_sha",
      "devices": ["pi3-64bit", "pi4-64bit", "pi5-64bit"],
      "init_format": "cloudinit-rpi"
    }
  ]
}
JSON
