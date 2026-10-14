# Updates and backup

## Updates

VideoFX never updates itself, and the web page never touches the network. With the read-only root, updates go through maintenance mode, which `videofx-update` handles:

```sh
sudo videofx-update --check                   # asks GitHub; the page then shows "update available"
sudo videofx-update                           # latest release
sudo videofx-update --tag v0.3.0 --os         # a given release, plus apt full-upgrade
sudo videofx-update --tarball ~/videofx-pi-0.3.0.tar.gz   # no GitHub access needed: scp the tarball over first
sudo videofx-update --rollback                # back to the previous version
```

- **What it does:**
  1. If the root is protected, it records the job and any tarball on the data partition, switches maintenance mode on and reboots. `videofx-update-resume.service` picks the job up after the reboot.
  2. Downloads the release asset `videofx-pi-X.Y.Z.tar.gz` and checks it's VideoFX.
  3. Copies the running version to `/opt/videofx.prev` (with its `node_modules`, so a rollback works offline).
  4. Runs the new release's `system/setup.sh`, which does `apt-get install`, `npm ci --omit=dev`, units and config. Both need the internet, with `--tarball` too.
  5. With `--os`, runs `apt full-upgrade`.
  6. Switches maintenance off and reboots.
  7. If step 4 fails (no network, say), it puts the previous version back, switches protection back on, reboots and exits with an error. It doesn't retry.
- **Private fork:** if your copy of the repo is private, put a GitHub token with read access to its contents (a fine-grained token, "Contents: read") in `/srv/videofx/update/github-token`, mode 600, owned by root. It lives on the data partition so it survives the read-only root. Or use `--tarball`.
- **Making a release:** bump the version in `pi/package.json`, tag `vX.Y.Z` and push the tag. CI (`.github/workflows/build.yml`) attaches the STLs, `videofx-pi-X.Y.Z.tar.gz` (`pi/tools/make-release.sh`), the public image with its `.sha256`, and `videofx-imager.json` (`pi/tools/imager-json.sh`). The image job runs on GitHub's arm64 runner and takes about ten minutes. By hand: `pi/tools/make-release.sh && gh release create vX.Y.Z pi/dist/videofx-pi-X.Y.Z.tar.gz`. The page footer shows the version and sha, and "update available" when the last `--check` found a newer release.

## Backup and restore

System > **Backup** > **Download backup**. That's one JSON file with the settings, schedule, quiet hours, playlist, and the Matter storage (fabrics, keys). Videos aren't included; copy those yourself. The file holds the pairing keys and the password hash, so keep it private. When a password is set, downloading needs it.

**Restore:** pick the file, choose whether to include the Matter pairing, confirm. Settings and playlist apply straight away and the service restarts. A restored pairing is swapped in at that restart, and the previous one is kept as `matter.before-restore`.

- Restore the **pairing** only onto the same Pi, or onto a replacement when the old one is gone for good. Two devices with one Matter identity confuse Apple Home and both misbehave.
- To clone settings onto a second VideoFX, restore **without** the pairing and pair the new one separately.
