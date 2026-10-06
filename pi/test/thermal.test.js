import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { OverTempGuard, SysfsPwm, Tach, ThermalControl, curveDuty, parseCurve, parseDs18b20, parseMilli, tachArgs } from "../src/thermal.js";

describe("fan curves", () => {
  it("parses, sorts and normalizes", () => {
    expect(parseCurve("50:100 30:25  40:50")).toBe("30:25 40:50 50:100");
  });
  it.each([
    ["30:25", /2-8 points/],
    ["30:25 30:50", /same temperature/],
    ["30:60 40:50", /must not go down/],
    ["30:25 40:150", /over 100/],
    ["hot:fast 1:2", /temperature:duty/],
    ["30:25 400:50", /out of range/],
  ])("rejects %j", (v, msg) => expect(() => parseCurve(v)).toThrow(msg));

  it("interpolates linearly and is flat outside the points", () => {
    const c = "30:25 40:50 50:100";
    expect(curveDuty(c, 20)).toBe(25);
    expect(curveDuty(c, 30)).toBe(25);
    expect(curveDuty(c, 35)).toBe(38);
    expect(curveDuty(c, 45)).toBe(75);
    expect(curveDuty(c, 60)).toBe(100);
    expect(curveDuty(c, null)).toBe(100); // no reading: full speed
  });
});

describe("sensor parsing (sysfs text)", () => {
  it("reads DS18B20 w1_slave", () => {
    expect(parseDs18b20("72 01 4b 46 7f ff 0e 10 57 : crc=57 YES\n72 01 4b 46 7f ff 0e 10 57 t=23125\n")).toBe(23.125);
    expect(parseDs18b20("ff ff : crc=00 YES\nff t=-1250\n")).toBe(-1.25);
  });
  it("rejects a bad CRC, garbage and the 85 °C power-on value", () => {
    expect(parseDs18b20("72 01 : crc=57 NO\n72 01 t=23125\n")).toBeNull();
    expect(parseDs18b20("50 05 : crc=aa YES\n50 05 t=85000\n")).toBeNull();
    expect(parseDs18b20("")).toBeNull();
  });
  it("reads the newer 'temperature' file and the SoC zone", () => {
    expect(parseDs18b20("41562\n")).toBe(41.562);
    expect(parseDs18b20("85000")).toBeNull();
    expect(parseMilli("48312\n")).toBe(48.312);
    expect(parseMilli("oops")).toBeNull();
  });
});

function control(over = {}) {
  let now = 0;
  const cfg = { curves: ["30:25 40:50 50:100", "45:25 60:60 70:100"], minDuty: 30, cooldownSec: 120, warnC: 45, critC: 55, hysteresisC: 5, failRpm: 200, failAfterSec: 5, ...over };
  const t = new ThermalControl({ cfg: () => cfg, now: () => now });
  const events = [];
  t.on("critical", (e) => events.push(["critical", e.temp]));
  t.on("cleared", (e) => events.push(["cleared", e.temp]));
  const r = (o) => ({ projectorC: 25, piC: 30, socC: 40, rpm: [1500, 1500], on: false, ...o });
  return { t, events, r, advance: (ms) => (now += ms) };
}

describe("ThermalControl", () => {
  it("follows each fan's curve; the Pi fan uses the hotter of zone and SoC", () => {
    const { t, r } = control();
    expect(t.update(r({ projectorC: 35, piC: 40, socC: 60 })).duty).toEqual([38, 60]);
  });

  it("keeps a minimum duty while the projector is on", () => {
    const { t, r } = control();
    expect(t.update(r({ projectorC: 20, piC: 20, socC: 20, on: true })).duty).toEqual([30, 30]);
    const idle = control();
    expect(idle.t.update(idle.r({ projectorC: 20, piC: 20, socC: 20, on: false })).duty).toEqual([25, 25]);
  });

  it("runs the projector fan for the cool-down after power-off", () => {
    const { t, r, advance } = control({ cooldownSec: 120 });
    t.update(r({ projectorC: 20, on: true }));
    expect(t.update(r({ projectorC: 20, on: false }))).toMatchObject({ duty: [30, 25], cooling: true });
    advance(119_000);
    expect(t.update(r({ projectorC: 20, on: false })).duty[0]).toBe(30);
    advance(1000);
    expect(t.update(r({ projectorC: 20, on: false }))).toMatchObject({ duty: [25, 25], cooling: false });
  });

  it("warns above the warning temperature and when a sensor is missing", () => {
    const { t, r } = control();
    const texts = t.update(r({ projectorC: 46, piC: null, socC: null })).alarms.map((a) => a.text);
    expect(texts).toEqual([expect.stringMatching(/projector zone: 46.0 °C/), expect.stringMatching(/Pi zone: no temperature/)]);
  });

  it("critical: trips once, fans to 100%, clears only below critical minus hysteresis", () => {
    const { t, r, events } = control();
    t.update(r({ projectorC: 54.9 }));
    expect(events).toEqual([]);
    expect(t.update(r({ projectorC: 55 }))).toMatchObject({ locked: true, duty: [100, 100] });
    t.update(r({ projectorC: 57 }));
    t.update(r({ projectorC: 50.1 })); // below critical, not below 50
    expect(t.locked).toBe(true);
    t.update(r({ projectorC: 49.9 }));
    expect(t.locked).toBe(false);
    expect(events).toEqual([
      ["critical", 55],
      ["cleared", 49.9],
    ]);
  });

  it("no projector-zone reading for 60 s while on: trips (there is no protection without it)", () => {
    const { t, r, events, advance } = control();
    t.update(r({ projectorC: null, on: true }));
    advance(59_000);
    expect(t.update(r({ projectorC: null, on: true }))).toMatchObject({ locked: false, duty: [100, 30] });
    advance(1000);
    const s = t.update(r({ projectorC: null, on: true }));
    expect(s).toMatchObject({ locked: true, duty: [100, 100] });
    expect(s.alarms.filter((a) => a.level === "critical")).toEqual([{ level: "critical", text: expect.stringMatching(/no temperature reading.*playback stopped/) }]);
    expect(events).toEqual([["critical", null]]);
    // stays locked while off with no reading; a good reading below the limit clears it
    advance(600_000);
    expect(t.update(r({ projectorC: null, on: false })).locked).toBe(true);
    expect(t.update(r({ projectorC: 30, on: false })).locked).toBe(false);
    expect(events.at(-1)).toEqual(["cleared", 30]);
  });

  it("a few missed readings, or none while off, do not trip", () => {
    const { t, r, events, advance } = control();
    t.update(r({ projectorC: null, on: true }));
    advance(50_000);
    t.update(r({ projectorC: 30, on: true })); // back in time: the clock starts over
    advance(50_000);
    t.update(r({ projectorC: null, on: true }));
    advance(50_000);
    expect(t.update(r({ projectorC: null, on: true })).locked).toBe(false);
    const off = control();
    off.t.update(off.r({ projectorC: null }));
    off.advance(3_600_000);
    expect(off.t.update(off.r({ projectorC: null })).locked).toBe(false);
    expect([...events, ...off.events]).toEqual([]);
  });

  it("reset (Cooling switched off) forgets a trip and its alarms", () => {
    const { t, r } = control();
    t.update(r({ projectorC: 60 }));
    expect(t.locked).toBe(true);
    t.reset();
    expect(t.locked).toBe(false);
    expect(t.state).toMatchObject({ alarms: [], locked: false });
  });

  it("fan failure: tach ~0 while driven above the minimum for 5 s", () => {
    const { t, r, advance } = control();
    const stuck = () => t.update(r({ projectorC: 45, on: true, rpm: [0, 1500] })).alarms.filter((a) => /not turning/.test(a.text));
    expect(stuck()).toEqual([]);
    advance(4999);
    expect(stuck()).toEqual([]);
    advance(1);
    expect(stuck()).toEqual([{ level: "critical", text: expect.stringMatching(/Fan 1 \(projector zone\) is not turning \(0 rpm at 75%\)/) }]);
    t.update(r({ projectorC: 45, on: true, rpm: [900, 1500] })); // spinning again resets it
    advance(1000);
    expect(stuck()).toEqual([]);
  });

  it("no tach reading (not wired) is not a failure", () => {
    const { t, r, advance } = control();
    t.update(r({ on: true, rpm: [null, null] }));
    advance(60_000);
    expect(t.update(r({ on: true, rpm: [null, null] })).alarms.filter((a) => /turning/.test(a.text))).toEqual([]);
  });
});

describe("over-temperature shutdown and resume rule", () => {
  it("switches off, blocks switching on, and resumes only if it was on", () => {
    let on = true;
    const calls = [];
    const g = new OverTempGuard({ powerOff: () => calls.push("off"), powerOn: () => calls.push("on"), isOn: () => on, log: { error() {}, warn() {} } });
    g.critical(56, 55);
    g.critical(58, 55); // once
    expect(calls).toEqual(["off"]);
    expect(g.blocked).toMatch(/over-temperature: 56.0 °C \(limit 55 °C\)/);
    g.cleared(49);
    expect(g.blocked).toBeNull();
    expect(calls).toEqual(["off", "on"]);

    on = false;
    g.critical(56, 55);
    g.cleared(49);
    expect(calls).toEqual(["off", "on", "off"]); // was off: stays off
  });

  it("a lost sensor trips it with its own reason; reset unblocks without switching on", () => {
    const calls = [];
    const g = new OverTempGuard({ powerOff: () => calls.push("off"), powerOn: () => calls.push("on"), isOn: () => true, log: { error() {}, warn() {} } });
    g.critical(null, 55, "no projector-zone temperature for 60 s");
    expect(g.blocked).toBe("temperature protection: no projector-zone temperature for 60 s");
    g.reset();
    expect(g.blocked).toBeNull();
    g.cleared(30); // nothing to resume after a reset
    expect(calls).toEqual(["off"]);
  });
});

describe("I/O adapters", () => {
  it("hardware PWM: exports once, 25 kHz period, duty in ns", async () => {
    const writes = [];
    const fs = { access: vi.fn(async () => { throw new Error("ENOENT"); }), writeFile: vi.fn(async (f, v) => writes.push([f.replace("/sys/class/pwm/pwmchip0", ""), v])) };
    const pwm = new SysfsPwm({ channel: 1, fs });
    await pwm.set(50);
    await pwm.set(100);
    expect(writes).toEqual([
      ["/export", "1"],
      ["/pwm1/period", "40000"],
      ["/pwm1/enable", "1"],
      ["/pwm1/duty_cycle", "20000"],
      ["/pwm1/duty_cycle", "40000"],
    ]);
  });

  it("tach: counts pulses per line, 2 per revolution", () => {
    let now = 0;
    const child = Object.assign(new EventEmitter(), { stdout: new PassThrough(), kill() {} });
    const tach = new Tach({ spawn: () => child, args: [], lines: ["GPIO24", "GPIO25"], now: () => now });
    tach.start();
    for (let i = 0; i < 50; i++) tach.count("GPIO24"); // 50 pulses in 1 s = 1500 rpm
    for (let i = 0; i < 10; i++) tach.count("GPIO25");
    now = 1000;
    expect(tach.rpm()).toEqual([1500, 300]);
    now = 2000;
    expect(tach.rpm()).toEqual([0, 0]);
    expect(tachArgs(1, [24, 25])).toEqual(["-b", "-f", "-B", "pull-up", "-F", "%o", "gpiochip0", "24", "25"]);
    expect(tachArgs(2, [24, 25])).toEqual(["--consumer=videofx-tach", "--edges=falling", "--bias=pull-up", "--format=%l", "GPIO24", "GPIO25"]);
  });
});
