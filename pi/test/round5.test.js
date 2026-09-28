process.env.TZ = "America/Los_Angeles";

import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyStagedRestore, createBackup, safeRelPath, stageRestore, validateBackup } from "../src/backup.js";
import { DEFAULT_QUIET, capVolume, inQuietHours, parseQuiet, quietNow, scareBlocked } from "../src/quiet.js";
import { compareVersions, pickAsset, readVersion, updateStatus } from "../src/update.js";

const q = (days, over = {}) => parseQuiet({ enabled: true, volumeCap: 10, days, ...over });
const at = (y, m, d, h, min = 0) => new Date(y, m - 1, d, h, min); // 2026-10-30 is a Friday

describe("quiet hours windows", () => {
  it("validates", () => {
    expect(parseQuiet(DEFAULT_QUIET)).toEqual(DEFAULT_QUIET);
    expect(() => parseQuiet({ days: { mon: { start: "22:00" } } })).toThrow(/both start and end/);
    expect(() => parseQuiet({ volumeCap: 101 })).toThrow(/0 to 100/);
    expect(() => parseQuiet({ days: { mon: { start: "25:00", end: "07:00" } } })).toThrow(/mon: start/);
    expect(() => parseQuiet({ dmxBypass: "yes" })).toThrow(/dmxBypass/);
  });

  it("same-day window", () => {
    const qh = q({ fri: { start: "13:00", end: "15:00" } });
    expect(inQuietHours(qh, at(2026, 10, 30, 12, 59))).toBe(false);
    expect(inQuietHours(qh, at(2026, 10, 30, 13, 0))).toBe(true);
    expect(inQuietHours(qh, at(2026, 10, 30, 15, 0))).toBe(false);
  });

  it("an overnight window spills into the next morning, and only from its own day", () => {
    const qh = q({ fri: { start: "22:00", end: "07:00" } });
    expect(inQuietHours(qh, at(2026, 10, 30, 21, 59))).toBe(false);
    expect(inQuietHours(qh, at(2026, 10, 30, 23, 30))).toBe(true);
    expect(inQuietHours(qh, at(2026, 10, 31, 6, 59))).toBe(true); // Saturday morning
    expect(inQuietHours(qh, at(2026, 10, 31, 7, 0))).toBe(false);
    expect(inQuietHours(qh, at(2026, 10, 30, 3, 0))).toBe(false); // Friday early: Thursday had no window
  });

  it("start == end means all day; disabled means never", () => {
    expect(inQuietHours(q({ sun: { start: "00:00", end: "00:00" } }), at(2026, 11, 1, 15))).toBe(true);
    expect(inQuietHours({ ...q({ fri: { start: "00:00", end: "00:00" } }), enabled: false }, at(2026, 10, 30, 12))).toBe(false);
  });
});

describe("quiet hours rules", () => {
  const qh = q({ fri: { start: "22:00", end: "07:00" } });
  const night = at(2026, 10, 30, 23);
  const day = at(2026, 10, 30, 12);

  it("caps the volume at night, leaves it alone by day", () => {
    expect(capVolume({ level: 60, muted: false }, qh, night)).toEqual({ level: 10, muted: false, capped: true });
    expect(capVolume({ level: 5, muted: false }, qh, night)).toEqual({ level: 5, muted: false, capped: false });
    expect(capVolume({ level: 60, muted: false }, qh, day)).toEqual({ level: 60, muted: false, capped: false });
  });

  it("a cap of 0 mutes", () => {
    expect(capVolume({ level: 60, muted: false }, { ...qh, volumeCap: 0 }, night)).toEqual({ level: 60, muted: true, capped: true });
  });

  it("DMX is capped too, unless DMX bypass is on", () => {
    expect(capVolume({ level: 80, muted: false }, qh, night, { source: "dmx" }).level).toBe(10);
    expect(capVolume({ level: 80, muted: false }, { ...qh, dmxBypass: true }, night, { source: "dmx" }).level).toBe(80);
    expect(capVolume({ level: 80, muted: false }, { ...qh, dmxBypass: true }, night, { source: "settings" }).level).toBe(10);
  });

  it("scares off at night (web, Matter, PIR); DMX only with bypass; option can be off", () => {
    for (const source of ["web page", "Matter", "motion sensor"]) expect(scareBlocked(qh, night, { source })).toBe("quiet hours");
    expect(scareBlocked(qh, day, { source: "Matter" })).toBeNull();
    expect(scareBlocked(qh, night, { source: "DMX" })).toBe("quiet hours");
    expect(scareBlocked({ ...qh, dmxBypass: true }, night, { source: "DMX" })).toBeNull();
    expect(scareBlocked({ ...qh, disableScares: false }, night, { source: "Matter" })).toBeNull();
  });

  it("clock not synced: assume quiet if any window is set (neighbour-friendly)", () => {
    expect(quietNow(qh, day, { clockOk: false })).toBe(true);
    expect(quietNow(parseQuiet({ enabled: true }), day, { clockOk: false })).toBe(false);
    expect(capVolume({ level: 60, muted: false }, qh, day, { clockOk: false }).level).toBe(10);
  });
});

describe("versions and releases", () => {
  it("compares versions", () => {
    expect(compareVersions("0.2.0", "0.1.9")).toBe(1);
    expect(compareVersions("v1.0.0", "1.0.0")).toBe(0);
    expect(compareVersions("1.0.0-rc.1", "1.0.0")).toBe(-1);
    expect(compareVersions("1.0.10", "1.0.9")).toBe(1);
  });

  it("finds the pi/ tarball among release assets", () => {
    const release = { tag_name: "v0.3.0", assets: [{ name: "case-stl.zip", url: "u1" }, { name: "videofx-pi-0.3.0.tar.gz", url: "u2" }] };
    expect(pickAsset(release)).toMatchObject({ name: "videofx-pi-0.3.0.tar.gz", version: "0.3.0", url: "u2", tag: "v0.3.0" });
    expect(pickAsset({ assets: [{ name: "evil.tar.gz" }] })).toBeNull();
  });

  it("reads the version with the baked git sha", () => {
    const files = { "/opt/videofx/package.json": '{"version":"0.2.0"}', "/opt/videofx/version.json": '{"sha":"abc1234"}' };
    expect(readVersion("/opt/videofx", (f) => files[f])).toEqual({ version: "0.2.0", sha: "abc1234" });
    expect(readVersion("/opt/videofx", (f) => (f.endsWith("package.json") ? '{"version":"0.2.0"}' : (() => { throw new Error("ENOENT"); })()))).toEqual({ version: "0.2.0", sha: null });
  });

  it("'update available' only from the local check file", () => {
    const cur = { version: "0.2.0", sha: "abc" };
    expect(updateStatus(cur, "")).toMatchObject({ available: false, latest: null });
    expect(updateStatus(cur, '{"latest":"0.3.0","checkedAt":"2026-10-01T00:00:00Z"}')).toMatchObject({ available: true, latest: "0.3.0" });
    expect(updateStatus(cur, '{"latest":"0.2.0"}').available).toBe(false);
    expect(updateStatus(cur, '{"latest":null,"error":"GitHub 404"}')).toMatchObject({ available: false, error: "GitHub 404" });
  });
});

describe("backup and restore", () => {
  let dir;
  beforeEach(async () => (dir = await mkdtemp(join(tmpdir(), "videofx-backup-"))));
  afterEach(() => rm(dir, { recursive: true, force: true }));

  async function source() {
    const state = join(dir, "state");
    await mkdir(join(state, "matter", "videofx"), { recursive: true });
    await writeFile(join(state, "matter", "videofx", "root.commissioning.passcode"), "12345678");
    await writeFile(join(state, "matter", "videofx", "fabrics.bin"), Buffer.from([0, 1, 2, 255]));
    await writeFile(join(state, "matter", "videofx", "storage.lock"), "pid");
    await writeFile(join(state, "settings.json"), JSON.stringify({ restore: "on", schedule: { enabled: true } }));
    await writeFile(join(dir, "playlist.m3u"), "#EXTM3U\na.mp4\n");
    return state;
  }

  it("exports settings, playlist and Matter storage (not locks), and validates", async () => {
    const state = await source();
    const b = await createBackup({ settingsFile: join(state, "settings.json"), playlistPath: join(dir, "playlist.m3u"), matterDir: join(state, "matter"), device: "videofx-beef", version: { version: "0.2.0" } });
    expect(b).toMatchObject({ format: "videofx-backup", formatVersion: 1, device: "videofx-beef", settings: { restore: "on" }, playlist: "#EXTM3U\na.mp4\n" });
    expect(Object.keys(b.matter).sort()).toEqual(["videofx/fabrics.bin", "videofx/root.commissioning.passcode"]);
    const v = validateBackup(JSON.parse(JSON.stringify(b)));
    expect(v.hasMatter).toBe(true);
  });

  it.each([
    [{}, /not a VideoFX backup/],
    [{ format: "videofx-backup", formatVersion: 2, settings: {}, playlist: "" }, /not supported/],
    [{ format: "videofx-backup", formatVersion: 1, playlist: "" }, /settings/],
    [{ format: "videofx-backup", formatVersion: 1, settings: {}, playlist: "", matter: { "../../etc/passwd": "AA==" } }, /bad Matter file name/],
    [{ format: "videofx-backup", formatVersion: 1, settings: {}, playlist: "", matter: { "/abs": "AA==" } }, /bad Matter file name/],
    [{ format: "videofx-backup", formatVersion: 1, settings: {}, playlist: "", matter: { "a/b": "not base64!" } }, /bad Matter file content/],
  ])("rejects %j", (b, msg) => expect(() => validateBackup(b)).toThrow(msg));

  it("safe paths", () => {
    expect(safeRelPath("videofx/root.parts.projector")).toBe(true);
    for (const p of ["..", "a/../b", "/a", "a//b", "a\\b", ""]) expect(safeRelPath(p), p).toBe(false);
  });

  it("restore without Matter: settings now, current pairing untouched", async () => {
    const state = await source();
    const b = validateBackup(await createBackup({ settingsFile: join(state, "settings.json"), playlistPath: join(dir, "playlist.m3u"), matterDir: join(state, "matter") }));
    const target = join(dir, "new");
    await mkdir(join(target, "matter"), { recursive: true });
    await writeFile(join(target, "matter", "mine"), "own identity");
    expect(await stageRestore(b, { settingsFile: join(target, "settings.json"), stateDir: target, includeMatter: false })).toEqual({ matter: false });
    expect(JSON.parse(await readFile(join(target, "settings.json"), "utf8"))).toEqual({ restore: "on", schedule: { enabled: true } });
    expect(await applyStagedRestore(target, { warn() {} })).toBe(false);
    expect(await readFile(join(target, "matter", "mine"), "utf8")).toBe("own identity");
  });

  it("restore with Matter: staged, then swapped in at the next start, old kept aside", async () => {
    const state = await source();
    const b = validateBackup(await createBackup({ settingsFile: join(state, "settings.json"), playlistPath: join(dir, "playlist.m3u"), matterDir: join(state, "matter") }));
    const target = join(dir, "new");
    await mkdir(join(target, "matter"), { recursive: true });
    await writeFile(join(target, "matter", "mine"), "own identity");
    await stageRestore(b, { settingsFile: join(target, "settings.json"), stateDir: target, includeMatter: true });
    expect(await readFile(join(target, "matter", "mine"), "utf8")).toBe("own identity"); // not yet
    expect(await applyStagedRestore(target, { warn() {} })).toBe(true);
    expect(await readFile(join(target, "matter", "videofx", "root.commissioning.passcode"), "utf8")).toBe("12345678");
    expect([...(await readFile(join(target, "matter", "videofx", "fabrics.bin")))]).toEqual([0, 1, 2, 255]);
    expect(await readFile(join(target, "matter.before-restore", "mine"), "utf8")).toBe("own identity");
    expect((await readdir(target)).sort()).toEqual(["matter", "matter.before-restore", "settings.json"]);
  });

  it("asking for Matter from a backup without it fails clearly", async () => {
    const v = validateBackup({ format: "videofx-backup", formatVersion: 1, settings: {}, playlist: "", matter: {} });
    await expect(stageRestore(v, { settingsFile: join(dir, "s.json"), stateDir: dir, includeMatter: true })).rejects.toThrow(/no Matter pairing/);
  });
});
