#!/bin/bash
# Turns Raspberry Pi OS Lite into the VideoFX player. Run as root.
# Used by install.sh on a running Pi and by the pi-gen stage inside the image
# chroot, so it must not rely on systemd running (no start/restart here).
#
# usage: setup.sh <user> <source dir containing src/, public/, system/, package*.json>
set -euo pipefail

user=${1:?usage: setup.sh <user> <source dir>}
src=${2:?usage: setup.sh <user> <source dir>}
app=/opt/videofx
node_major=24 # NodeSource LTS line; matter.js needs Node >= 20.19
home=$(getent passwd "$user" | cut -d: -f6)
[ -n "$home" ] || { echo "no such user: $user" >&2; exit 1; }

export DEBIAN_FRONTEND=noninteractive

echo "== packages"
apt-get update
# mpv (DRM/KMS video, ALSA audio), gpiod (gpiomon/gpioset: PIR, relay),
# v4l-utils (cec-ctl, ir-ctl), avahi for videofx-xxxx.local and the Bonjour entry.
apt-get install -y --no-install-recommends \
  mpv gpiod v4l-utils alsa-utils avahi-daemon iw overlayroot ca-certificates curl gpg

echo "== node.js"
node_ok() {
  command -v node >/dev/null && node -e '
    const [a, b] = process.versions.node.split(".").map(Number);
    process.exit(a > 20 || (a === 20 && b >= 19) ? 0 : 1)'
}
if ! node_ok || ! command -v npm >/dev/null; then
  install -d -m 755 /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key |
    gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${node_major}.x nodistro main" \
    >/etc/apt/sources.list.d/nodesource.list
  apt-get update
  apt-get install -y nodejs
fi
node --version

echo "== app -> $app"
rm -rf "$app/src" "$app/public" "$app/system"
install -d "$app"
# system/ too, so videofx-update --rollback can restore the matching unit files.
cp -r "$src/src" "$src/public" "$src/system" "$src/package.json" "$src/package-lock.json" "$app/"
# version.json (package version + git sha) comes with releases and images; from a
# git checkout, bake the sha here.
if [ -f "$src/version.json" ]; then
  cp "$src/version.json" "$app/"
else
  sha=$(git -C "$src" rev-parse --short HEAD 2>/dev/null || echo unknown)
  printf '{"version":"%s","sha":"%s"}\n' "$(node -p "require('$src/package.json').version")" "$sha" >"$app/version.json"
fi
(cd "$app" && npm ci --omit=dev --no-audit --no-fund)

echo "== systemd units"
sed -e "s/^User=.*/User=$user/" -e "s#MEDIA_DIR#$home/media#" "$src/system/videofx-player.service" >/etc/systemd/system/videofx-player.service
install -m 644 "$src/system/videofx-hostname.service" /etc/systemd/system/videofx-hostname.service
install -m 755 "$src/system/videofx-hostname" /usr/local/sbin/videofx-hostname
# Settings may hold the web password: root-only. Keep an existing file.
[ -e /etc/default/videofx ] || install -m 600 "$src/system/videofx.default" /etc/default/videofx
# Groups the service uses; Raspberry Pi OS normally has them already.
for g in video render audio tty gpio; do getent group "$g" >/dev/null || groupadd --system "$g"; done
install -m 644 "$src/system/99-videofx.rules" /etc/udev/rules.d/99-videofx.rules
install -m 644 "$src/system/videofx-storage.service" /etc/systemd/system/videofx-storage.service
install -m 755 "$src/system/videofx-storage" /usr/local/sbin/videofx-storage
install -m 755 "$src/system/videofx-maint" /usr/local/sbin/videofx-maint
install -m 755 "$src/system/videofx-relay-open" /usr/local/sbin/videofx-relay-open
install -m 755 "$src/system/videofx-update" /usr/local/sbin/videofx-update
install -m 644 "$src/system/videofx-update-resume.service" /etc/systemd/system/videofx-update-resume.service
systemctl enable videofx-update-resume.service
systemctl enable videofx-hostname.service videofx-player.service avahi-daemon.service
# cloud-init (the release image; Raspberry Pi OS trixie set up by Imager) would
# otherwise put Imager's hostname back on every boot and grow root over the card.
if [ -d /etc/cloud/cloud.cfg.d ]; then
  install -m 644 "$src/system/99-videofx-cloud-init.cfg" /etc/cloud/cloud.cfg.d/99-videofx.cfg
fi

echo "== reliability: watchdog, Wi-Fi power save off, Ethernet first, NTP"
install -d /etc/systemd/system.conf.d /etc/systemd/timesyncd.conf.d /etc/NetworkManager/conf.d /etc/NetworkManager/dispatcher.d
install -m 644 "$src/system/50-videofx-watchdog.conf" /etc/systemd/system.conf.d/50-videofx-watchdog.conf
install -m 644 "$src/system/50-videofx-timesyncd.conf" /etc/systemd/timesyncd.conf.d/50-videofx.conf
install -m 644 "$src/system/90-videofx-network.conf" /etc/NetworkManager/conf.d/90-videofx-network.conf
install -m 755 "$src/system/60-videofx-ntp" /etc/NetworkManager/dispatcher.d/60-videofx-ntp
systemctl enable systemd-timesyncd.service 2>/dev/null || true

echo "== Bonjour: web UI as _http._tcp"
install -m 644 "$src/system/videofx.avahi.service" /etc/avahi/services/videofx.service

echo "== media folder $home/media"
install -d -o "$user" -g "$(id -gn "$user")" "$home/media"

echo "== audio: Raspberry Pi DigiAMP+ only (onboard and HDMI audio off)"
config=/boot/firmware/config.txt
[ -e "$config" ] || config=/boot/config.txt
# Onboard 3.5 mm audio off (stock config.txt has dtparam=audio=on in its top section).
sed -i 's/^dtparam=audio=.*/dtparam=audio=off/' "$config"
# HDMI audio off, so it can never become the default device. Video over HDMI stays.
sed -i 's/^dtoverlay=vc4-kms-v3d$/dtoverlay=vc4-kms-v3d,noaudio/' "$config"
grep -q '^dtoverlay=vc4-kms-v3d,.*noaudio' "$config" ||
  echo "WARNING: add ,noaudio to the vc4-kms-v3d line in $config by hand" >&2
# Anything still missing goes in an [all] block at the end, so no [pi4]/[cm5]
# section can swallow it. DigiAMP+ overlay per Raspberry Pi's overlay README:
# rpi-digiampplus (iqaudio-digiampplus for the older black IQaudIO board).
# unmute_amp unmutes the TAS5756 (GPIO22) when the driver loads; without it the
# amp starts muted and auto_mute_amp only opens it while ALSA has the device.
missing=""
grep -q '^dtparam=audio=off' "$config" || missing+=$'dtparam=audio=off\n'
grep -q '^dtoverlay=rpi-digiampplus\|^dtoverlay=iqaudio-digiampplus' "$config" || missing+=$'# Raspberry Pi DigiAMP+ (GPIO22 = mute, owned by the driver)\ndtoverlay=rpi-digiampplus,unmute_amp\n'
# Projector relay and IR (see README "GPIO pins"). The relay line is driven to
# "open" by the firmware at boot, before Linux runs: dh = high for the usual
# active-low relay modules (use dl for active-high ones).
# These are the default pins. They are written once: if you change
# VIDEOFX_RELAY_GPIO, _RELAY_ACTIVE_LOW, _IR_TX_GPIO or _IR_RX_GPIO in
# /etc/default/videofx, change the matching lines in config.txt by hand too.
grep -q '^dtoverlay=gpio-ir-tx\|^dtoverlay=pwm-ir-tx' "$config" || missing+=$'# IR LED (projector power)\ndtoverlay=gpio-ir-tx,gpio_pin=16\n'
grep -q '^dtoverlay=gpio-ir,' "$config" || missing+=$'# IR receiver (learning remote codes)\ndtoverlay=gpio-ir,gpio_pin=23\n'
grep -q '^gpio=27=' "$config" || missing+=$'# Projector relay open at boot (active-low module)\ngpio=27=op,dh\n'
[ -z "$missing" ] || printf '\n[all]\n%s' "$missing" >>"$config"
# Older installs added fan PWM and 1-wire overlays; the case has no fans or DS18B20s now.
# Only when both ends of the block are there, so a hand-edited file never loses everything after the marker.
if grep -q '^# videofx: fans and 1-wire' "$config" && grep -q '^dtoverlay=w1-gpio-pi5' "$config"; then
  # Drop the whole block, from its marker to the Pi 5 w1 line (a trailing [all] stays, which is harmless).
  sed -i '/^# videofx: fans and 1-wire/,/^dtoverlay=w1-gpio-pi5/d' "$config"
fi
install -m 644 "$src/system/asound.conf" /etc/asound.conf

echo "== console: tty1 is the projector's idle screen"
# No login prompt drawn over the black screen; log in over SSH (or Alt+F2 with a keyboard).
systemctl disable getty@tty1.service
cmdline=/boot/firmware/cmdline.txt
[ -e "$cmdline" ] || cmdline=/boot/cmdline.txt
for opt in consoleblank=0 logo.nologo vt.global_cursor_default=0; do
  grep -qw "$opt" "$cmdline" || sed -i "1 s/\$/ $opt/" "$cmdline"
done

echo "== done"
