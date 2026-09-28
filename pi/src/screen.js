// The HDMI text console (tty1) is what the projector shows whenever mpv is not
// drawing. We clear it to black, or print the Matter pairing code on it.
// Needs write access to the tty: the service user is in the "tty" group, and
// getty@tty1 is disabled so no login prompt is drawn over it.

import { writeFileSync } from "node:fs";

const CLEAR = "\x1b[2J\x1b[3J\x1b[H"; // erase screen + scrollback, cursor home
const HIDE_CURSOR = "\x1b[?25l";

export function createScreen(tty, log = console) {
  const write = (text) => {
    if (!tty) return;
    try {
      writeFileSync(tty, text);
    } catch (err) {
      log.warn(`Cannot write to ${tty}: ${err.message}`);
    }
  };
  return {
    black: () => write(CLEAR + HIDE_CURSOR),
    pairing: ({ qr, manualPairingCode, name, host }) =>
      write(
        CLEAR +
          HIDE_CURSOR +
          `\n  ${name}: not paired with a Matter controller yet\n\n` +
          // matter.js pads with U+2800 (braille blank), which console fonts lack.
          qr.replaceAll("\u2800", " ").replace(/^/gm, "  ") +
          `\n\n  Manual pairing code: ${manualPairingCode}\n` +
          `  Apple Home: + > Add Accessory > scan the code, or More options > enter the code\n` +
          `  Web page: http://${host ?? name}.local/\n`,
      ),
  };
}
