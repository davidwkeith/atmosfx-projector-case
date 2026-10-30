# Audio

A **Raspberry Pi DigiAMP+** (TAS5756M, 2 channels) drives 4-8 Ω speakers behind the projection. It runs from the 24 V brick (12-24 V, through its P5 hard-wire header or the 5.5 x 2.5 mm centre-positive barrel jack) and **powers the Pi through the header** at 5.1 V / 2.5 A. Up to 35 W per channel, rated for 0-50 °C ambient ([product brief](https://pip-assets.raspberrypi.com/categories/765-raspberry-pi-digiamp/documents/RP-008138-DS-1-digiamp-plus-hat-product-brief.pdf)): the Pi zone has to stay under that with only a passive louver, and the brief says not to cover a case it sits in, which is what the louvers are for (bring-up logs the shelf temperature).

- **Speakers:** speaker wire from the DigiAMP+'s terminals, same polarity on both speakers; the outputs can't be bridged.
- **Power budget:** the brick must supply the projector, the Pi and the amp at once. Check its label.
- **Software:**
  - `dtoverlay=rpi-digiampplus,unmute_amp` (Raspberry Pi's overlay; the HAT EEPROM identifies the board, but the amp starts **muted** until `unmute_amp` or `auto_mute_amp` is set. `iqaudio-digiampplus` is the same overlay for the older black IQaudIO board);
  - `dtparam=audio=off` and `vc4-kms-v3d,noaudio`;
  - ALSA default pinned by card name in `/etc/asound.conf`;
  - mpv uses `--audio-device=alsa/plughw:CARD=DigiAMP,DEV=0` (ALSA makes the card id from the last word of the overlay's "RPi DigiAMP+" name; `aplay -l` shows it as `card 0: DigiAMP [RPi DigiAMP+]`).
- **Volume:** hardware mixer `Digital` via `amixer -M`, saved in settings.json. The first boot starts at 30%.
