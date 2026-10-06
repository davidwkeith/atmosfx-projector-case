// PIR motion sensor (HC-SR501 style: 3.3 V output, high while it sees motion)
// on one GPIO, watched with libgpiod's gpiomon (no native Node addon).

import { EventEmitter } from "node:events";
import { createInterface } from "node:readline";

// Used by the Raspberry Pi DigiAMP+ or reserved on every Pi: ID EEPROM (0, 1), I2C
// configuration (2, 3), GPCLK0 (4, per pinout.xyz), I2S sound (18-21) and the
// amp mute line (22, driven by the rpi-digiampplus overlay). The board also
// brings 17, 23, 24, 25 and 27 to its optional rotary-encoder and IR headers;
// those stay free as long as nothing is plugged into them.
export const RESERVED_GPIOS = [0, 1, 2, 3, 4, 18, 19, 20, 21, 22];

/** "gpiomon (libgpiod) v2.2.1" -> 2 */
export function gpiomonMajor(versionText) {
  const m = /v(\d+)\.\d+/.exec(versionText ?? "");
  return m ? Number(m[1]) : null;
}

/**
 * gpiomon arguments. libgpiod 2 (Debian trixie) finds the line by its name
 * ("GPIO17"), which works on every Pi including the 5, and debounces in the kernel.
 * libgpiod 1.x (bookworm) needs chip + offset; on the 3, 4 and Zero 2 W the
 * header is gpiochip0 with BCM numbering. Debounce is also done in software.
 * -b: 1.x only line-buffers its output when asked; without it, events sit in a
 * 4 KiB pipe buffer and never arrive.
 */
export function pirArgs(major, pin, debounceMs) {
  if (major >= 2) {
    return ["--consumer=videofx-pir", "--edges=both", "--bias=pull-down", `--debounce-period=${debounceMs}ms`, "--format=%e", `GPIO${pin}`];
  }
  return ["-b", "-B", "pull-down", "-r", "-f", "-F", "%e", "gpiochip0", String(pin)];
}

/** Emits "change" (occupied: boolean) on debounced edges, and "motion" on rising ones. */
export class Pir extends EventEmitter {
  #spawn;
  #command;
  #args;
  #debounceMs;
  #log;
  #now;
  #setTimer;
  #clearTimer;
  #child = null;
  #stopped = true;
  #occupied = false;
  #lastChange = -Infinity;
  #retry = null;

  constructor({ spawn, command = "gpiomon", args, debounceMs = 50, log = console, now = Date.now, setTimeout: st = setTimeout, clearTimeout: ct = clearTimeout }) {
    super();
    this.#spawn = spawn;
    this.#command = command;
    this.#args = args;
    this.#debounceMs = debounceMs;
    this.#log = log;
    this.#now = now;
    this.#setTimer = st;
    this.#clearTimer = ct;
  }

  get occupied() {
    return this.#occupied;
  }

  get running() {
    return this.#child !== null;
  }

  start() {
    this.#stopped = false;
    if (!this.#child) this.#launch();
  }

  stop() {
    this.#stopped = true;
    if (this.#retry) this.#clearTimer(this.#retry);
    this.#retry = null;
    this.#child?.kill("SIGTERM");
    this.#child = null;
    this.#clear();
  }

  #launch() {
    this.#log.info(`PIR: ${this.#command} ${this.#args.join(" ")}`);
    const child = this.#spawn(this.#command, this.#args, { stdio: ["ignore", "pipe", "inherit"] });
    this.#child = child;
    createInterface({ input: child.stdout }).on("line", (line) => this.#onLine(line.trim()));
    const gone = (why) => {
      if (this.#child !== child) return;
      this.#child = null;
      this.#clear();
      if (this.#stopped) return;
      this.#log.error(`PIR: ${this.#command} ${why}; retrying in 5 s`);
      this.#retry = this.#setTimer(() => {
        this.#retry = null;
        if (!this.#stopped) this.#launch();
      }, 5000);
    };
    child.once("error", (err) => gone(err.message));
    child.once("exit", (code) => gone(`exited (${code})`));
  }

  // gpiomon %e: "1" rising; "2" (v2) or "0" (v1) falling.
  #onLine(line) {
    if (line === "1") this.#set(true);
    else if (line === "2" || line === "0") this.#set(false);
  }

  // Not debounced: used when the monitor stops.
  #clear() {
    if (!this.#occupied) return;
    this.#occupied = false;
    this.emit("change", false);
  }

  #set(occupied) {
    if (occupied === this.#occupied) return;
    const now = this.#now();
    if (now - this.#lastChange < this.#debounceMs) return;
    this.#lastChange = now;
    this.#occupied = occupied;
    this.emit("change", occupied);
    if (occupied) this.emit("motion");
  }
}
