#!/bin/bash -e
# files/app, files/videofx.env and files/wifi.nmconnection are put here by
# image/build.sh at build time; they are not in git.

# Stage under /var/tmp: pi-gen's on_chroot mounts a fresh tmpfs over /tmp, which would hide files copied there.
rm -rf "${ROOTFS_DIR}/var/tmp/videofx"
cp -r files/app "${ROOTFS_DIR}/var/tmp/videofx"

if [ -f files/videofx.env ]; then
	install -m 600 files/videofx.env "${ROOTFS_DIR}/etc/default/videofx"
fi
if [ -f files/wifi.nmconnection ]; then
	install -m 600 files/wifi.nmconnection "${ROOTFS_DIR}/etc/NetworkManager/system-connections/wifi.nmconnection"
fi

if [ -f files/videofx-storage.conf ]; then
	install -m 644 files/videofx-storage.conf "${ROOTFS_DIR}/etc/videofx-storage.conf"
fi

on_chroot <<- CHROOT
	/var/tmp/videofx/system/setup.sh "${FIRST_USER_NAME}" /var/tmp/videofx
	rm -rf /var/tmp/videofx
	# Power-cut protection: our first-boot service makes the data partition and
	# turns on the read-only root, so Pi OS must not grow root over the whole card.
	systemctl disable rpi-resize.service 2>/dev/null || true
	systemctl enable videofx-storage.service
CHROOT
sed -i 's/ resize\b//' "${ROOTFS_DIR}/boot/firmware/cmdline.txt"

if [ -f files/generic ]; then
	# Public image (build.sh --generic): nobody knows the build-time password, so
	# lock the account the way pi-gen locks root. cloud-init sets the real password
	# and SSH key from user-data on first boot (Raspberry Pi Imager writes it).
	on_chroot <<- CHROOT
		usermod --pass='*' "${FIRST_USER_NAME}"
	CHROOT
	# Our templates replace pi-gen's generic cloud-init examples on the boot
	# partition, for people who edit them by hand instead of using Imager.
	install -m 644 files/cloud-init/user-data files/cloud-init/network-config "${ROOTFS_DIR}/boot/firmware/"
fi

# Every Pi flashed from this image names itself VideoFX-XXXX on first boot
# (videofx-hostname.service), so make sure no name is baked in.
rm -f "${ROOTFS_DIR}/var/lib/videofx-name"
