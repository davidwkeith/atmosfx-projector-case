#!/bin/bash
# Build a Raspberry Pi OS Lite (64-bit) image with the projector player baked in,
# using pi-gen's Docker build. Needs Docker, git, rsync and uuidgen on the host.
#   cp pi/config.example pi/config   # then edit
#   pi/image/build.sh                # image lands in pi/deploy/
#
# Secrets from pi/config are only written under pi/.build/ (gitignored).
set -euo pipefail

# pi-gen arm64 branch, pinned for repeatable builds. Bump deliberately.
PI_GEN_REPO=https://github.com/RPi-Distro/pi-gen.git
PI_GEN_REF=74d08a337bd29da289b9aedbe5b48c79fb2e5a03 # arm64, 2026-09-16, Debian trixie

pi=$(cd "$(dirname "$0")/.." && pwd)
config=${1:-$pi/config}
build=$pi/.build
pigen=$build/pi-gen
stage=$pigen/stage-videofx

[ -f "$config" ] || { echo "missing $config (copy pi/config.example)" >&2; exit 1; }
# shellcheck source=/dev/null
source "$config"
: "${FIRST_USER_NAME:?set in config}" "${FIRST_USER_PASS:?set in config}" "${PUBKEY_SSH_FIRST_USER:?set in config}"
if [ -n "${WIFI_SSID:-}" ]; then
  : "${WIFI_PSK:?set in config}" "${WPA_COUNTRY:?set in config (Wi-Fi stays blocked without it)}"
fi

echo "== pi-gen @ $PI_GEN_REF"
if [ ! -d "$pigen/.git" ]; then
  git clone --branch arm64 "$PI_GEN_REPO" "$pigen"
fi
git -C "$pigen" fetch --quiet origin arm64
git -C "$pigen" checkout --quiet --force "$PI_GEN_REF"
git -C "$pigen" clean -fdxq -e work -e deploy # drop last run's stage and config
touch "$pigen/stage2/SKIP_IMAGES" # only export our image, not plain Lite

echo "== stage"
rsync -a --delete "$pi/image/stage-videofx/" "$stage/"
files=$stage/00-videofx/files
mkdir -p "$files/app"
cp -r "$pi/src" "$pi/public" "$pi/system" "$pi/package.json" "$pi/package-lock.json" "$files/app/"
printf '{"version":"%s","sha":"%s"}\n' "$(node -p "require('$pi/package.json').version")" "$(git -C "$pi" rev-parse --short HEAD 2>/dev/null || echo unknown)" >"$files/app/version.json"

# /etc/default/videofx: defaults plus the owner's settings. systemd reads it as an
# EnvironmentFile: quotes inside an unquoted value are stripped and a trailing
# backslash or # can change it, so the password goes in double quotes with
# \ " $ and ` escaped (systemd's own rule for double-quoted values).
umask 077
{
  grep -v '^VIDEOFX_RESTORE=' "$pi/system/videofx.default"
  echo "VIDEOFX_RESTORE=${VIDEOFX_RESTORE:-last}"
  [ -z "${VIDEOFX_WEB_PASSWORD:-}" ] || printf 'VIDEOFX_WEB_PASSWORD="%s"\n' "$(printf '%s' "$VIDEOFX_WEB_PASSWORD" | sed 's/[\\"$`]/\\&/g')"
} > "$files/videofx.env"
umask 022

# Partition sizes for the first-boot storage setup: root grows to ROOT_SIZE_MB,
# the data partition takes the rest of the card (at least DATA_MIN_MB).
printf 'ROOT_SIZE_MB=%d\nDATA_MIN_MB=%d\n' "${ROOT_SIZE_MB:-6144}" "${DATA_MIN_MB:-1024}" >"$files/videofx-storage.conf"

if [ -n "${WIFI_SSID:-}" ]; then
  umask 077
  cat > "$files/wifi.nmconnection" <<EOF
[connection]
id=wifi
uuid=$(uuidgen | tr '[:upper:]' '[:lower:]')
type=wifi
autoconnect=true

[wifi]
mode=infrastructure
ssid=$WIFI_SSID

[wifi-security]
key-mgmt=wpa-psk
psk=$WIFI_PSK

[ipv4]
method=auto
# Send the hostname (videofx-xxxx) so routers such as UniFi list the Pi by name.
dhcp-send-hostname=true

[ipv6]
method=auto
EOF
  umask 022
fi

# pi-gen config: the owner's settings plus what this build fixes. %q quotes
# passwords safely for pi-gen, which sources this file.
kv() { printf '%s=%q\n' "$1" "$2"; }
umask 077
{
  kv IMG_NAME raspios-trixie-arm64
  kv PI_GEN_RELEASE "projector player"
  kv DEPLOY_COMPRESSION xz
  # Placeholder: videofx-hostname.service renames each Pi to videofx-xxxx on first boot.
  kv TARGET_HOSTNAME videofx
  kv FIRST_USER_NAME "$FIRST_USER_NAME"
  kv FIRST_USER_PASS "$FIRST_USER_PASS"
  kv DISABLE_FIRST_BOOT_USER_RENAME 1
  kv ENABLE_SSH 1
  kv PUBKEY_SSH_FIRST_USER "$PUBKEY_SSH_FIRST_USER"
  kv PUBKEY_ONLY_SSH 1
  kv LOCALE_DEFAULT "${LOCALE_DEFAULT:-en_US.UTF-8}"
  kv KEYBOARD_KEYMAP "${KEYBOARD_KEYMAP:-us}"
  kv KEYBOARD_LAYOUT "${KEYBOARD_LAYOUT:-English (US)}"
  kv TIMEZONE_DEFAULT "${TIMEZONE_DEFAULT:-America/Los_Angeles}"
  # pi-gen tests whether WPA_COUNTRY is set at all, so omit it when empty.
  [ -z "${WPA_COUNTRY:-}" ] || kv WPA_COUNTRY "$WPA_COUNTRY"
  # Our NetworkManager profile configures Wi-Fi; cloud-init/netplan would compete with it.
  kv ENABLE_CLOUD_INIT 0
  kv STAGE_LIST "stage0 stage1 stage2 stage-videofx"
} > "$pigen/config"
umask 022

echo "== build (takes a while)"
# A failed run leaves pi-gen's container behind, and build-docker.sh then refuses to start.
docker rm -v pigen_work >/dev/null 2>&1 || true
(cd "$pigen" && ./build-docker.sh)

mkdir -p "$pi/deploy"
cp "$pigen"/deploy/*-videofx* "$pi/deploy/"
ls -lh "$pi/deploy"
