import { describe, expect, it, vi } from "vitest";
import { OverTempGuard, SocWatch, parseMilli } from "../src/thermal.js";

const cfg = { warnC: 70, critC: 80, hysteresisC: 5 };

describe("SoC temperature text", () => {
  it("reads the millidegree zone file", () => {
    expect(parseMilli("48312\n")).toBe(48.312);
    expect(parseMilli("")).toBeNull();
    expect(parseMilli("abc")).toBeNull();
    expect(parseMilli(null)).toBeNull();
  });
});

describe("SocWatch", () => {
  it("is quiet below the warning temperature", () => {
    const w = new SocWatch({ cfg: () => cfg, guard: { critical: vi.fn(), cleared: vi.fn() } });
    expect(w.update(50)).toEqual({ temp: 50, alarms: [], locked: false });
  });
  it("warns above warnC", () => {
    const w = new SocWatch({ cfg: () => cfg, guard: { critical: vi.fn(), cleared: vi.fn() } });
    const s = w.update(72);
    expect(s.alarms).toHaveLength(1);
    expect(s.alarms[0].level).toBe("warn");
  });
  it("trips once at critC, stays locked until below critC minus hysteresis", () => {
    const guard = { critical: vi.fn(), cleared: vi.fn() };
    const w = new SocWatch({ cfg: () => cfg, guard });
    w.update(81);
    w.update(82);
    expect(guard.critical).toHaveBeenCalledTimes(1);
    expect(guard.critical).toHaveBeenCalledWith(81, 80);
    expect(w.update(77).locked).toBe(true); // 77 is not below 75
    expect(guard.cleared).not.toHaveBeenCalled();
    expect(w.update(74).locked).toBe(false);
    expect(guard.cleared).toHaveBeenCalledWith(74);
  });
  it("a missing reading neither trips nor clears", () => {
    const guard = { critical: vi.fn(), cleared: vi.fn() };
    const w = new SocWatch({ cfg: () => cfg, guard });
    expect(w.update(null)).toEqual({ temp: null, alarms: [], locked: false });
    w.update(85);
    expect(w.update(null).locked).toBe(true);
    expect(guard.cleared).not.toHaveBeenCalled();
  });
  it("reset forgets a trip", () => {
    const w = new SocWatch({ cfg: () => cfg, guard: { critical: vi.fn(), cleared: vi.fn() } });
    w.update(90);
    w.reset();
    expect(w.update(50).locked).toBe(false);
  });
});

describe("over-temperature shutdown and resume rule", () => {
  it("switches off, blocks switching on, and resumes only if it was on", () => {
    let on = true;
    const powerOff = vi.fn(() => (on = false));
    const powerOn = vi.fn(() => (on = true));
    const log = { error: vi.fn(), warn: vi.fn() };
    const g = new OverTempGuard({ powerOff, powerOn, isOn: () => on, log });
    expect(g.blocked).toBeNull();
    g.critical(81, 80);
    expect(powerOff).toHaveBeenCalledTimes(1);
    expect(g.blocked).toMatch(/over-temperature/);
    g.critical(82, 80); // already tripped: no second power-off
    expect(powerOff).toHaveBeenCalledTimes(1);
    g.cleared(74);
    expect(powerOn).toHaveBeenCalledTimes(1);
    expect(g.blocked).toBeNull();
  });
  it("does not switch on after clearing if it was off when it tripped", () => {
    const powerOn = vi.fn();
    const g = new OverTempGuard({ powerOff: vi.fn(), powerOn, isOn: () => false, log: { error: vi.fn(), warn: vi.fn() } });
    g.critical(81, 80);
    g.cleared(70);
    expect(powerOn).not.toHaveBeenCalled();
  });
  it("reset unblocks without switching on", () => {
    const powerOn = vi.fn();
    const g = new OverTempGuard({ powerOff: vi.fn(), powerOn, isOn: () => true, log: { error: vi.fn(), warn: vi.fn() } });
    g.critical(81, 80);
    g.reset();
    expect(g.blocked).toBeNull();
    expect(powerOn).not.toHaveBeenCalled();
  });
});
