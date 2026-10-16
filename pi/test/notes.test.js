import { describe, expect, it } from "vitest";
import { UPDATE_STALE_MS, alarmsOf, badgesOf, lastUpdateNote, systemNotesOf } from "../public/notes.js";

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
    const noPw = badgesOf({ ...calm, web: { passwordSet: false } });
    expect(noPw).toEqual({ dashboard: false, system: true });
  });
});

describe("lastUpdateNote", () => {
  const at = "2026-10-15T23:40:00Z";
  const t = Date.parse(at);
  it("says how the last update run went", () => {
    expect(lastUpdateNote(null)).toBeNull();
    expect(lastUpdateNote({ state: "done", at, message: "Done: 0.10.3 installed" }, t)).toMatchObject({ level: "ok", text: expect.stringMatching(/^Last update finished .*: Done: 0\.10\.3 installed\.$/) });
    expect(lastUpdateNote({ state: "up-to-date", at }, t).level).toBe("ok");
    expect(lastUpdateNote({ state: "failed", at, message: "npm ci failed" }, t)).toMatchObject({ level: "warn", text: expect.stringMatching(/FAILED.*put back.*npm ci failed/) });
    expect(lastUpdateNote({ state: "stopped", message: "no network" }, t)).toMatchObject({ level: "warn", text: "Last update stopped early, nothing was installed: no network." });
    expect(lastUpdateNote({ state: "nonsense" }, t)).toBeNull();
  });

  it("calls a run that stopped reporting long ago unfinished", () => {
    const running = { state: "running", at, message: "resumed after the maintenance reboot" };
    expect(lastUpdateNote(running, t + 60_000)).toMatchObject({ level: "info", text: expect.stringMatching(/^Update in progress/) });
    expect(lastUpdateNote(running, t + UPDATE_STALE_MS + 1)).toMatchObject({ level: "warn", text: expect.stringMatching(/never finished.*last step was: resumed/) });
  });
});
