# Install

**Option A: the release image.** Every [release](https://github.com/davidwkeith/atmosfx-projector-case/releases) carries `videofx-<version>-arm64.img.xz` (Raspberry Pi OS Lite 64-bit with the player baked in, built by CI from `pi/image/build.sh --generic`) and `videofx-imager.json`. The image holds no password, SSH key or Wi-Fi; [Raspberry Pi Imager](https://www.raspberrypi.com/software/) (2.0 or newer) puts yours in on first boot through cloud-init, the same way it sets up Raspberry Pi OS trixie:

1. Imager > **App options** > **Content repository** > **Custom URL**: `https://github.com/davidwkeith/atmosfx-projector-case/releases/latest/download/videofx-imager.json`. Imager reloads with "VideoFX projector player" as its only OS.
2. Pick it and the card, then fill in the usual options: user and password, Wi-Fi and country, SSH, locale. Leave the hostname blank (or `raspberrypi`) and the Pi names itself `videofx-xxxx` from its MAC; type a name to use it instead.
3. Boot. One extra reboot (storage setup: see [Reliability](reliability.md)), then `videofx-xxxx.local` answers.

Imager's **Use custom** button offers no first-boot options for a plain image file (Imager 2.0 removed them; the repository JSON is the supported way). Without the repository, flash the `.img.xz` with **Use custom**, then edit `user-data` and `network-config` on the card's boot partition before the first boot; both carry commented examples. A Pi booted with no user set up cannot be logged into at all: no password, and the console login is off.

The service runs as the image's login user (uid 1000). Name your Imager user `videofx` to keep one account (Imager then sets its password and SSH key), or pick any other name; both get sudo. If Imager renames or replaces `videofx`, the first boot repoints the service at the account that is left (`videofx-user`).

**Option B: build the image yourself.** Your user, password, SSH key and Wi-Fi are baked in, so there is no first-boot setup. Never share this image. You need Docker ([Docker Desktop](https://docs.docker.com/desktop/) on a Mac), git, rsync, uuidgen and node.

```sh
cp pi/config.example pi/config   # user, password, SSH key, Wi-Fi, country; gitignored
pi/image/build.sh                # pi-gen arm64 pinned to one commit; image in pi/deploy/videofx-<version>-arm64.img.xz
pi/image/build.sh --generic      # the public flavour CI builds (no pi/config needed)
```

Flash it with Imager's **Use custom** (no options are offered, none are needed). pi-gen and npm are pinned; Debian and NodeSource packages are whatever is current on build day.

**Fresh card, either way.** Flash the image onto the card and let that card's first boot run: `videofx-storage` grows the root to `ROOT_SIZE_MB` and makes the data partition from the rest, and Pi OS's own grow-to-fill is disabled. Don't copy files onto an existing Pi OS card to "upgrade" it, and don't boot the freshly flashed card in another Pi first. A card whose root already fills it reports `no-space` and runs unprotected; re-flash it.

**Option C: install on stock Raspberry Pi OS Lite (64-bit).**

```sh
scp -r pi/ you@raspberrypi.local:videofx-setup
ssh you@raspberrypi.local 'cd videofx-setup && sudo ./install.sh && sudo reboot'
```

`setup.sh` does the following (both options):

- installs `mpv gpiod v4l-utils alsa-utils avahi-daemon`, plus Node 24 from NodeSource if the system Node is older than 20.19;
- installs the app, udev rules for CEC, lirc, GPIO and fb blank, and the systemd units;
- disables the tty1 login prompt and keeps boot text off the projector (kernel console on tty3, `quiet`, no rainbow splash);
- sets the SSH login banner (`/etc/update-motd.d/20-videofx`): version, board, uptime, SoC temperature and any under-voltage or throttling, memory, root protection, data partition, addresses, player state and the last update check. It replaces overlayroot's mount listing;
- edits `config.txt` (see [GPIO pins](wiring.md)). It is idempotent.
