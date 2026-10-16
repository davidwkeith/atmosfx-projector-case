import { describe, expect, it } from "vitest";
import { alarmsOf, badgesOf, checksSummaryText, systemNotesOf } from "../public/notes.js";

const calm = { thermal: { enabled: true, alarms: [] }, storage: { dataMounted: true, state: "ok" }, web: { passwordSet: true }, clock: { synced: true }, version: { available: false } };

describe("alarmsOf", () => {
  it("lists thermal alarms only while protection is on, then the projector notice", () => {
    const st = { thermal: { enabled: true, alarms: [{ level: "critical", text: "hot" }] }, projector: { notice: "no CEC" } };
    expect(alarmsOf(st)).toEqual([{ level: "critical", text: "hot" }, { level: "warn", text: "no CEC" }]);
    expect(alarmsOf({ thermal: { enabled: false, alarms: [{ level: "warn", text: "x" }] } })).toEqual([]);
    expect(alarmsOf({})).toEqual([]);
  });
});

describe("systemNotesOf", () => {
  it("is empty for a healthy system", () => expect(systemNotesOf(calm)).toEqual([]));
  it("reports maintenance mode, an unmounted data partition, power-cut state, no password and an unsynced clock", () => {
    const ids = (st) => systemNotesOf({ ...calm, ...st }).map((n) => n.id);
    expect(ids({ storage: { maintenance: true, dataMounted: true, state: "ok" } })).toEqual(["maintenance"]);
    expect(ids({ storage: { dataMounted: false, state: "ok" } })).toEqual(["data"]);
    expect(ids({ storage: { dataMounted: true, state: "degraded" } })).toEqual(["power"]);
    expect(ids({ web: { passwordSet: false } })).toEqual(["password"]);
    expect(ids({ clock: { synced: false } })).toEqual(["clock"]);
  });
});

describe("badgesOf", () => {
  it("is quiet before the first status and for a healthy system", () => {
    expect(badgesOf(null)).toEqual({ dashboard: false, system: false });
    expect(badgesOf(calm)).toEqual({ dashboard: false, system: false });
  });
  it("marks Dashboard for alarms and notes, System for an update or a missing password", () => {
    expect(badgesOf({ ...calm, thermal: { enabled: true, alarms: [{ level: "warn", text: "x" }] } }).dashboard).toBe(true);
    expect(badgesOf({ ...calm, clock: { synced: false } }).dashboard).toBe(true);
    expect(badgesOf({ ...calm, version: { available: true } }).system).toBe(true);
    expect(badgesOf({ ...calm, checks: { fail: 1, unknown: 0 } }).dashboard).toBe(true);
    expect(badgesOf({ ...calm, checks: { fail: 0, unknown: 3 } }).dashboard).toBe(false); // "to confirm" is not a problem
    const noPw = badgesOf({ ...calm, web: { passwordSet: false } });
    expect(noPw).toEqual({ dashboard: false, system: true });
  });
});

describe("checksSummaryText", () => {
  it("counts what matters and skips zeros", () => {
    expect(checksSummaryText(null)).toBeNull();
    expect(checksSummaryText({ pass: 10, fail: 0, unknown: 0, off: 0 })).toBe("10 OK");
    expect(checksSummaryText({ pass: 7, fail: 1, unknown: 2, off: 1 })).toBe("7 OK · 1 problem · 2 to confirm · 1 not used");
    expect(checksSummaryText({ pass: 6, fail: 2, unknown: 1, off: 0 })).toBe("6 OK · 2 problems · 1 to confirm");
  });
});
