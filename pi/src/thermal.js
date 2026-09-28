// Heat management: two 12 V 4-pin PWM fans (projector zone, Pi/brick zone),
// DS18B20 1-wire sensors, the SoC sensor, and over-temperature protection.
//
// Hardware PWM (25 kHz) on GPIO12/13 via the pwm-2chan overlay and sysfs;
// tach pulses (2 per revolution, open collector, pulled up to 3.3 V) counted
// with gpiomon; DS18B20 through the w1-gpio overlay's sysfs files.

import { EventEmitter } from "node:events";
import { createInterface } from "node:readline";

export const PWM_PERIOD_NS = 40_000; // 25 kHz, Intel/Noctua 4-pin PWM spec

/** "30:30 40:60 50:100" -> [[30,30],[40,60],[50,100]] (°C : duty %), sorted, validated. */
export function parseCurve(v) {
  const text = Array.isArray(v) ? v.map((p) => p.join(":")).join(" ") : v;
  if (typeof text !== "string") throw new Error("must be points like 30:30 40:60 50:100");
  const points = text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => {
      const m = /^(-?\d{1,3}(?:\.\d)?):(\d{1,3})$/.exec(p);
      if (!m) throw new Error(`"${p}" is not temperature:duty (e.g. 40:60)`);
      const [t, d] = [Number(m[1]), Number(m[2])];
      if (t < -20 || t > 120) throw new Error(`${t} °C is out of range`);
      if (d > 100) throw new Error(`${d}% is over 100`);
      return [t, d];
    })
    .sort((a, b) => a[0] - b[0]);
  if (points.length < 2 || points.length > 8) throw new Error("needs 2-8 points");
  for (let i = 1; i < points.length; i++) {
    if (points[i][0] === points[i - 1][0]) throw new Error("two points at the same temperature");
    if (points[i][1] < points[i - 1][1]) throw new Error("duty must not go down as temperature goes up");
  }
  return points.map(([t, d]) => `${t}:${d}`).join(" ");
}

/** Duty % for a temperature on a curve (linear between points, flat outside). */
export function curveDuty(curve, temp) {
  const points = curve.split(" ").map((p) => p.split(":").map(Number));
  if (temp === null || temp === undefined || Number.isNaN(temp)) return 100; // no reading: be safe
  if (temp <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [t1, d1] = points[i];
    const [t0, d0] = points[i - 1];
    if (temp <= t1) return Math.round(d0 + ((d1 - d0) * (temp - t0)) / (t1 - t0));
  }
  return points.at(-1)[1];
}

/**
 * DS18B20 sysfs: "w1_slave" (two lines, "crc=.. YES" and "t=23125") or the newer
 * "temperature" file (millidegrees). Returns °C or null for a bad read. 85.000 °C
 * is the chip's power-on value, not a measurement.
 */
export function parseDs18b20(text) {
  const t = (text ?? "").trim();
  if (/^-?\d+$/.test(t)) {
    const v = Number(t);
    return v === 85000 ? null : v / 1000;
  }
  const lines = t.split("\n");
  if (lines.length < 2 || !/crc=[0-9a-f]{2} YES$/.test(lines[0].trim())) return null;
  const m = /t=(-?\d+)/.exec(lines[1]);
  if (!m || Number(m[1]) === 85000) return null;
  return Number(m[1]) / 1000;
}

/** SoC: /sys/class/thermal/thermal_zone0/temp in millidegrees. */
export const parseMilli = (text) => (/^-?\d+$/.test((text ?? "").trim()) ? Number(text) / 1000 : null);

/**
 * The control loop's brain; no I/O. update() takes readings and returns fan duties
 * and events. Protection: warn above warnC; at critC in the projector zone stop
 * and switch off, and stay locked until it cools below critC - hysteresisC.
 */
export class ThermalControl extends EventEmitter {
  #cfg;
  #now;
  #cooldownUntil = 0;
  #wasOn = false;
  #locked = false;
  #lowRpmSince = [null, null];
  #state = { duty: [0, 0], alarms: [], locked: false };

  /**
   * @param {() => { curves: [string, string], minDuty: number, cooldownSec: number,
   *   warnC: number, critC: number, hysteresisC: number, failRpm: number, failAfterSec: number }} cfg
   */
  constructor({ cfg, now = Date.now }) {
    super();
    this.#cfg = cfg;
    this.#now = now;
  }

  get state() {
    return this.#state;
  }

  get locked() {
    return this.#locked;
  }

  /**
   * @param {{ projectorC: number|null, piC: number|null, socC: number|null, rpm: [number|null, number|null], on: boolean }} r
   */
  update(r) {
    const c = this.#cfg();
    const now = this.#now();
    if (this.#wasOn && !r.on) this.#cooldownUntil = now + c.cooldownSec * 1000;
    this.#wasOn = r.on;
    const cooling = !r.on && now < this.#cooldownUntil;

    // Critical: projector zone. Lock, and emit once.
    const pt = r.projectorC;
    if (!this.#locked && pt !== null && pt >= c.critC) {
      this.#locked = true;
      this.emit("critical", { temp: pt });
    } else if (this.#locked && pt !== null && pt < c.critC - c.hysteresisC) {
      this.#locked = false;
      this.emit("cleared", { temp: pt });
    }
    // Fan 1 follows the projector zone; fan 2 the hotter of the Pi zone and the SoC.
    const piZone = [r.piC, r.socC].filter((v) => v !== null && v !== undefined);
    const temps = [r.projectorC, piZone.length ? Math.max(...piZone) : null];
    const duty = temps.map((t, i) => {
      let d = curveDuty(c.curves[i], t);
      if (r.on || (i === 0 && cooling)) d = Math.max(d, c.minDuty); // keep turning while it matters
      if (this.#locked) d = 100;
      return Math.min(100, d);
    });

    const alarms = [];
    const zone = ["projector zone", "Pi zone"];
    temps.forEach((t, i) => {
      if (t === null) alarms.push({ level: "warn", text: `${zone[i]}: no temperature reading` });
      else if (t >= c.warnC) alarms.push({ level: "warn", text: `${zone[i]}: ${t.toFixed(1)} °C (warning at ${c.warnC} °C)` });
    });

    if (this.#locked) alarms.push({ level: "critical", text: `Projector zone over ${c.critC} °C: playback stopped until it cools below ${c.critC - c.hysteresisC} °C` });

    // Fan failure: tach ~0 while driven above the minimum for a while.
    duty.forEach((d, i) => {
      const rpm = r.rpm?.[i];
      if (rpm === null || rpm === undefined) return;
      if (d >= c.minDuty && d > 0 && rpm < c.failRpm) {
        this.#lowRpmSince[i] ??= now;
        if (now - this.#lowRpmSince[i] >= c.failAfterSec * 1000) {
          alarms.push({ level: "critical", text: `Fan ${i + 1} (${zone[i]}) is not turning (${rpm} rpm at ${d}%)` });
        }
      } else {
        this.#lowRpmSince[i] = null;
      }
    });

    this.#state = { duty, temps, alarms, locked: this.#locked, cooling };
    return this.#state;
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

  cleared(temp) {
    if (!this.#tripped) return;
    this.#log.warn(`Thermal: cooled to ${temp.toFixed(1)} °C${this.#resume ? "; switching back on" : ""}`);
    this.#tripped = null;
    if (this.#resume) this.#powerOn();
    this.#resume = false;
  }
}

// --- I/O adapters (thin; exercised on hardware)

/** Hardware PWM channel through /sys/class/pwm. */
export class SysfsPwm {
  #chip;
  #channel;
  #fs;
  #ready = false;

  constructor({ chip = "/sys/class/pwm/pwmchip0", channel, fs }) {
    this.#chip = chip;
    this.#channel = channel;
    this.#fs = fs; // { readFile, writeFile, access }
  }

  async #setup() {
    const dir = `${this.#chip}/pwm${this.#channel}`;
    try {
      await this.#fs.access(dir);
    } catch {
      await this.#fs.writeFile(`${this.#chip}/export`, String(this.#channel));
    }
    await this.#fs.writeFile(`${dir}/period`, String(PWM_PERIOD_NS));
    await this.#fs.writeFile(`${dir}/enable`, "1");
    this.#ready = true;
  }

  async set(dutyPercent) {
    if (!this.#ready) await this.#setup();
    const ns = Math.round((PWM_PERIOD_NS * Math.max(0, Math.min(100, dutyPercent))) / 100);
    await this.#fs.writeFile(`${this.#chip}/pwm${this.#channel}/duty_cycle`, String(ns));
  }
}

/** Counts tach pulses on several GPIOs with one gpiomon; rpm() over the last window. */
export class Tach extends EventEmitter {
  #spawn;
  #args;
  #lines;
  #now;
  #counts;
  #since;
  #child = null;

  /** lines: gpiomon line labels as printed by %l (v2) or %o (v1), in fan order. */
  constructor({ spawn, args, lines, now = Date.now }) {
    super();
    this.#spawn = spawn;
    this.#args = args;
    this.#lines = lines.map(String);
    this.#now = now;
    this.#counts = this.#lines.map(() => 0);
    this.#since = now();
  }

  start() {
    const child = this.#spawn("gpiomon", this.#args, { stdio: ["ignore", "pipe", "inherit"] });
    this.#child = child;
    createInterface({ input: child.stdout }).on("line", (l) => this.count(l.trim().replace(/"/g, "")));
    child.once("exit", () => {
      if (this.#child === child) this.#child = null;
    });
  }

  stop() {
    this.#child?.kill("SIGTERM");
    this.#child = null;
  }

  count(line) {
    const i = this.#lines.indexOf(line);
    if (i >= 0) this.#counts[i]++;
  }

  /** RPM per fan since the last call (2 pulses per revolution). null if not running. */
  rpm() {
    const now = this.#now();
    const secs = (now - this.#since) / 1000;
    const out = this.#counts.map((n) => (this.#child && secs > 0 ? Math.round((n / 2 / secs) * 60) : null));
    this.#counts = this.#counts.map(() => 0);
    this.#since = now;
    return out;
  }
}

/** gpiomon args for the tach lines (falling edges, pull-up to 3.3 V). */
export function tachArgs(major, pins) {
  if (major >= 2) return ["--consumer=videofx-tach", "--edges=falling", "--bias=pull-up", "--format=%l", ...pins.map((p) => `GPIO${p}`)];
  return ["-f", "-B", "pull-up", "-F", "%o", "gpiochip0", ...pins.map(String)];
}
