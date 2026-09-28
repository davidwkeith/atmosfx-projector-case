#!/bin/bash
# Alternative to building an image: turn a stock Raspberry Pi OS Lite (64-bit)
# install into the projector player. Run on the Pi from a copy of this pi/ folder:
#   sudo ./install.sh            # service runs as the user who ran sudo
#   sudo ./install.sh someuser
# Renames the Pi to VideoFX-XXXX (last 4 hex digits of its eth0 MAC).
set -euo pipefail

[ "$(id -u)" -eq 0 ] || { echo "run with sudo" >&2; exit 1; }
user=${1:-${SUDO_USER:-}}
[ -n "$user" ] && [ "$user" != root ] || { echo "usage: sudo ./install.sh <user>  (not root)" >&2; exit 1; }
here=$(cd "$(dirname "$0")" && pwd)

"$here/system/setup.sh" "$user" "$here"

# The image does this at first boot; here we do it now.
[ -e /var/lib/videofx-name ] || /usr/local/sbin/videofx-hostname
name=$(cat /var/lib/videofx-name)

# Power-cut protection: data partition + read-only root, if the card has room.
/usr/local/sbin/videofx-storage "$user" || true
storage=$(cat /var/lib/videofx-storage.state 2>/dev/null || echo "not set up")

systemctl daemon-reload
systemctl stop getty@tty1.service || true
systemctl restart avahi-daemon.service
systemctl restart videofx-player.service

cat <<MSG

Installed. This Pi is now $name.
Power-cut protection: $storage
  (no-space means Pi OS already grew / over the whole card: see README, Power-cut safety)
Next:
  1. Reboot once (sudo reboot) so the new hostname reaches DHCP and the console
     settings in cmdline.txt take effect.
  2. Open http://$name.local/ to upload videos and build the playlist.
  3. Pair it: the QR code is on that page and on the projector, or run
       journalctl -u videofx-player -b | grep -A20 uncommissioned
MSG
