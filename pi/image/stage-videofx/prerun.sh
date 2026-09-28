#!/bin/bash -e
# Start from the stage2 (Raspberry Pi OS Lite) root filesystem.
if [ ! -d "${ROOTFS_DIR}" ]; then
	copy_previous
fi
