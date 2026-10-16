// Heat protection: the Pi's own SoC temperature. The projector's own fan moves the case
// air; the Pi 3/4 sleds carry a small fan that the kernel's gpio-fan overlay switches on
// and off by itself. This file reads the SoC zone and the fan's state, and switches the
// projector off (OverTempGuard) if the Pi overheats anyway.

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

export const parseMilli = (text) => (/^-?\d+$/.test((text ?? "").trim()) ? Number(text) / 1000 : null);

/** The gpio-fan overlay's cooling device: true (running), false (off), or null (no such device). */
export async function readFanState(root = "/sys/class/thermal") {
  const names = await readdir(root).catch(() => []);
  for (const name of names.filter((n) => n.startsWith("cooling_device"))) {
    const type = await readFile(join(root, name, "type"), "utf8").catch(() => "");
    if (type.trim() !== "gpio-fan") continue;
    const state = await readFile(join(root, name, "cur_state"), "utf8").catch(() => null);
    return state === null ? null : Number(state.trim()) > 0;
  }
  return null;
}

/**
 * SoC temperature watch; no I/O. update(socC) returns { temp, alarms, locked }.
 * Warn above warnC; at critC trip the guard once and stay locked until the
 * temperature is below critC - hysteresisC. A missing reading changes nothing.
 */
export class SocWatch {
  #cfg;
  #guard;
  #locked = false;

  /** @param {{ cfg: () => { warnC: number, critC: number, hysteresisC: number }, guard: { critical: Function, cleared: Function } }} o */
  constructor({ cfg, guard }) {
    this.#cfg = cfg;
    this.#guard = guard;
  }

  reset() {
    this.#locked = false;
  }

  update(socC) {
    const c = this.#cfg();
    const temp = socC ?? null;
    if (temp !== null) {
      if (!this.#locked && temp >= c.critC) {
        this.#locked = true;
        this.#guard.critical(temp, c.critC);
      } else if (this.#locked && temp < c.critC - c.hysteresisC) {
        this.#locked = false;
        this.#guard.cleared(temp);
      }
    }
    const alarms = [];
    if (this.#locked) alarms.push({ level: "critical", text: `Pi over ${c.critC} °C: playback stopped until it cools below ${c.critC - c.hysteresisC} °C` });
    else if (temp !== null && temp >= c.warnC) alarms.push({ level: "warn", text: `Pi: ${temp.toFixed(1)} °C (warning at ${c.warnC} °C)` });
    return { temp, alarms, locked: this.#locked };
  }
}

/**
 * What happens on a critical temperature: remember whether we were on, switch
 * off (stop playback, projector off through its configured path), refuse to
 * switch on while tripped, and switch back on only after it cooled below
 * critical minus the hysteresis, and only if it was on before.
 */
export class OverTempGuard {
  #powerOff;
  #powerOn;
  #isOn;
  #log;
  #tripped = null;
  #resume = false;

  constructor({ powerOff, powerOn, isOn, log = console }) {
    this.#powerOff = powerOff;
    this.#powerOn = powerOn;
    this.#isOn = isOn;
    this.#log = log;
  }

  /** Reason text while tripped, else null (for the power arbiter). */
  get blocked() {
    return this.#tripped;
  }

  critical(temp, limit) {
    if (this.#tripped) return;
    this.#tripped = `over-temperature: ${temp.toFixed(1)} °C (limit ${limit} °C)`;
    this.#resume = this.#isOn();
    this.#log.error(`Thermal: ${this.#tripped}; switching off`);
    this.#powerOff();
  }

  /** Protection switched off: unblock without switching anything on. */
  reset() {
    this.#tripped = null;
    this.#resume = false;
  }

  cleared(temp) {
    if (!this.#tripped) return;
    this.#log.warn(`Thermal: cooled to ${temp.toFixed(1)} °C${this.#resume ? "; switching back on" : ""}`);
    this.#tripped = null;
    if (this.#resume) this.#powerOn();
    this.#resume = false;
  }
}
