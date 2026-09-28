#!/bin/bash -e
# files/app, files/videofx.env and files/wifi.nmconnection are put here by
# image/build.sh at build time; they are not in git.

rm -rf "${ROOTFS_DIR}/tmp/videofx"
cp -r files/app "${ROOTFS_DIR}/tmp/videofx"

if [ -f files/videofx.env ]; then
	install -m 600 files/videofx.env "${ROOTFS_DIR}/etc/default/videofx"
fi
if [ -f files/wifi.nmconnection ]; then
	install -m 600 files/wifi.nmconnection "${ROOTFS_DIR}/etc/NetworkManager/system-connections/wifi.nmconnection"
fi

on_chroot <<- CHROOT
	/tmp/videofx/system/setup.sh "${FIRST_USER_NAME}" /tmp/videofx
	rm -rf /tmp/videofx
CHROOT

# Every Pi flashed from this image names itself VideoFX-XXXX on first boot
# (videofx-hostname.service), so make sure no name is baked in.
rm -f "${ROOTFS_DIR}/var/lib/videofx-name"
