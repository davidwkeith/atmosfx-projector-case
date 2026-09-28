import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveSettings } from "../src/config.js";
import { Settings, writeJsonAtomic } from "../src/settings.js";

const ctx = { home: "/home/pi", deviceName: "VideoFX-BEEF" };
let dir;
let log;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "videofx-settings-"));
  log = { warn: vi.fn(), info: vi.fn(), error: vi.fn() };
});
afterEach(() => rm(dir, { recursive: true, force: true }));

const make = (env = {}) => new Settings({ dir, env, ctx, log });
const onDisk = async () => JSON.parse(await readFile(join(dir, "settings.json"), "utf8"));
const status = (fn) => {
  try {
    fn();
  } catch (err) {
    return [err.status, err.message];
  }
  return [200];
};

describe("precedence and sources", () => {
  it("web beats file beats default", () => {
    const s = make({ VIDEOFX_RESTORE: "off", VIDEOFX_MAX_UPLOAD_MB: "100" });
    expect([s.get("restore"), s.source("restore")]).toEqual(["off", "file"]);
    expect([s.get("name"), s.source("name")]).toEqual(["VideoFX-BEEF", "default"]);
    s.set("restore", "on");
    expect([s.get("restore"), s.source("restore")]).toEqual(["on", "web"]);
    s.reset("restore");
    expect([s.get("restore"), s.source("restore")]).toEqual(["off", "file"]);
    s.reset("maxUploadMb"); // no web value: nothing to do
    expect(s.source("maxUploadMb")).toBe("file");
  });

  it("survives a restart", () => {
    make().set("name", "Front Porch");
    const again = make();
    expect([again.get("name"), again.source("name")]).toEqual(["Front Porch", "web"]);
  });

  it("describe() reports value, source and default, and never the password", () => {
    const s = make({ VIDEOFX_WEB_PASSWORD: "file-secret" });
    s.set("maxUploadMb", 512);
    const d = s.describe();
    const byKey = Object.fromEntries(d.settings.map((x) => [x.key, x]));
    expect(byKey.maxUploadMb).toMatchObject({ value: 512, source: "web", default: 4096, apply: "live" });
    expect(byKey.mpvExtraArgs).toMatchObject({ source: "default", apply: "play", advanced: true });
    expect(byKey.scareClips).toMatchObject({ custom: true });
    expect(byKey.httpPort).toMatchObject({ apply: "fixed", value: 80 });
    expect(byKey.password).toMatchObject({ isSet: true, source: "file" });
    expect(byKey.password).not.toHaveProperty("value");
    expect(JSON.stringify(d)).not.toContain("file-secret");
  });

  it("the default playlist follows the media folder", () => {
    const s = make({ VIDEOFX_MEDIA_DIR: "/srv/media" });
    expect(s.describeOne("playlist").default).toBe("/srv/media/playlist.m3u");
  });

  it("fixed settings can't be changed from the web", () => {
    const s = make();
    for (const key of ["httpPort", "matterPort", "mediaDir", "playlist", "mpv", "stateDir", "relayPin", "irTxPin", "irRxPin"]) {
      expect(status(() => s.set(key, "/tmp"))[0], key).toBe(403);
    }
    expect(status(() => s.set("nope", 1))[0]).toBe(404);
  });

  it("an invalid file value falls back to the default with a warning", () => {
    const s = make({ VIDEOFX_RESTORE: "maybe" });
    expect([s.get("restore"), s.source("restore")]).toEqual(["last", "default"]);
    expect(log.warn).toHaveBeenCalledWith(expect.stringMatching(/VIDEOFX_RESTORE/));
    expect(() => resolveSettings({ env: { VIDEOFX_RESTORE: "maybe" }, ctx, strict: true })).toThrow(/VIDEOFX_RESTORE/);
  });

  it("reports which restart-only settings changed since boot", () => {
    const s = make();
    expect(s.restartNeeded).toEqual([]);
    s.set("console", "");
    expect(s.restartNeeded).toEqual(["console"]);
    s.reset("console");
    expect(s.restartNeeded).toEqual([]);
  });

  it("announces web changes but not silent updates", () => {
    const s = make();
    const change = vi.fn();
    s.on("change", change);
    s.set("restore", "on");
    s.update({ volume: 40, muted: true });
    expect(change).toHaveBeenCalledTimes(1);
    expect(change).toHaveBeenCalledWith(["restore"]);
    expect([s.get("volume"), s.get("muted")]).toEqual([40, true]);
  });
});

describe("validation (400 with a clear message)", () => {
  const s = () => make();
  it.each([
    ["name", ""],
    ["name", "x".repeat(33)],
    ["name", "<script>"],
    ["restore", "maybe"],
    ["maxUploadMb", 0],
    ["maxUploadMb", 1.5],
    ["maxUploadMb", "lots"],
    ["webHosts", "bad_host.local"],
    ["webHosts", "a..b"],
    ["webHosts", 42],
    ["volume", "loud"],
    ["muted", "yes"],
    ["audioCard", "hw:0"],
    ["audioCard", "a b"],
    ["mixerControl", "Digital;rm -rf /"],
    ["console", "/etc/passwd"],
    ["console", "/dev/sda"],
    ["password", "short"],
    ["password", "tab\there!"],
  ])("%s = %j", (key, value) => {
    const [code, message] = status(() => s().set(key, value));
    expect(code).toBe(400);
    expect(message.length).toBeGreaterThan(10);
  });

  it("normalizes good values", () => {
    const x = s();
    x.set("webHosts", "Projector.home.arpa  videofx.lan");
    expect(x.get("webHosts")).toEqual(["projector.home.arpa", "videofx.lan"]);
    x.set("maxUploadMb", "2048");
    expect(x.get("maxUploadMb")).toBe(2048);
    x.set("volume", 250);
    expect(x.get("volume")).toBe(100);
    x.set("name", "  Front Porch ");
    expect(x.get("name")).toBe("Front Porch");
  });

  it("does not save anything when a value is rejected", async () => {
    const x = s();
    x.set("restore", "on");
    status(() => x.set("restore", "maybe"));
    expect(await onDisk()).toEqual({ restore: "on" });
  });
});

describe("mpv extra options", () => {
  it("are validated with the deny-list when saved from the web (400)", () => {
    expect(status(() => make().set("mpvExtraArgs", "--hwdec=no --input-ipc-server=/tmp/x"))[0]).toBe(400);
    const s = make();
    s.set("mpvExtraArgs", "--hwdec=v4l2m2m-copy");
    expect(s.get("mpvExtraArgs")).toBe("--hwdec=v4l2m2m-copy");
  });

  it("an old vlcExtraArgs in settings.json is dropped with a warning", async () => {
    await writeFile(join(dir, "settings.json"), JSON.stringify({ vlcExtraArgs: "--vout=drm_vout", restore: "on" }));
    const s = make();
    expect(s.get("restore")).toBe("on");
    expect(s.get("mpvExtraArgs")).toBe("");
    expect(log.warn).toHaveBeenCalledWith(expect.stringMatching(/vlcExtraArgs.*mpv/));
  });
});

describe("pins across settings", () => {
  it("refuses a PIR pin that another role uses (400)", () => {
    const s = make();
    expect(status(() => s.set("pirPin", 27))).toEqual([400, "GPIO27 is set for both the PIR and the relay"]);
    expect(status(() => s.set("pirPin", 18))[0]).toBe(400);
    expect(status(() => s.set("pirPin", 24))).toEqual([400, "GPIO24 is set for both the PIR and the projector fan tach"]);
    s.set("pirPin", 16);
    expect(s.get("pirPin")).toBe(16);
  });
});

describe("password rules", () => {
  it("setting the first password needs no current one, and is stored hashed", async () => {
    const s = make();
    expect(s.passwordSet).toBe(false);
    expect(s.verifyPassword(undefined)).toBe(true);
    s.set("password", "pumpkin-42");
    expect(s.passwordSet).toBe(true);
    expect(s.verifyPassword("pumpkin-42")).toBe(true);
    expect(s.verifyPassword("pumpkin-43")).toBe(false);
    expect(s.verifyPassword(undefined)).toBe(false);
    const raw = await readFile(join(dir, "settings.json"), "utf8");
    expect(raw).not.toContain("pumpkin-42");
    expect((await onDisk()).password.scrypt).toMatch(/:/);
    expect(make().verifyPassword("pumpkin-42")).toBe(true); // after a restart
  });

  it("changing it needs the current password", () => {
    const s = make();
    s.set("password", "pumpkin-42");
    expect(status(() => s.set("password", "ghost-1234"))).toEqual([403, "The current password is wrong"]);
    expect(status(() => s.set("password", "ghost-1234", { currentPassword: "nope" }))[0]).toBe(403);
    s.set("password", "ghost-1234", { currentPassword: "pumpkin-42" });
    expect(s.verifyPassword("ghost-1234")).toBe(true);
    expect(s.verifyPassword("pumpkin-42")).toBe(false);
  });

  it("a file password must be given to change it too", () => {
    const s = make({ VIDEOFX_WEB_PASSWORD: "file-secret" });
    expect(status(() => s.set("password", "new-secret"))[0]).toBe(403);
    s.set("password", "new-secret", { currentPassword: "file-secret" });
    expect(s.verifyPassword("new-secret")).toBe(true);
    expect(s.verifyPassword("file-secret")).toBe(false);
  });

  it("clearing needs the current password and a confirmation", () => {
    const s = make();
    s.set("password", "pumpkin-42");
    expect(status(() => s.set("password", ""))[0]).toBe(403);
    expect(status(() => s.set("password", "", { currentPassword: "pumpkin-42" }))[0]).toBe(400);
    expect(s.passwordSet).toBe(true);
    s.set("password", "", { currentPassword: "pumpkin-42", confirm: true });
    expect(s.passwordSet).toBe(false);
    expect(s.source("password")).toBe("web");
  });

  it("clearing overrides a file password; reset brings the file password back", () => {
    const s = make({ VIDEOFX_WEB_PASSWORD: "file-secret" });
    s.set("password", "", { currentPassword: "file-secret", confirm: true });
    expect(s.passwordSet).toBe(false);
    s.reset("password"); // no password now, so none needed; it only adds one back
    expect(s.passwordSet).toBe(true);
    expect(s.verifyPassword("file-secret")).toBe(true);
  });

  it("reset that removes the only password needs the current one and a confirmation", () => {
    const s = make();
    s.set("password", "pumpkin-42");
    expect(status(() => s.reset("password"))[0]).toBe(403);
    expect(status(() => s.reset("password", { currentPassword: "pumpkin-42" }))[0]).toBe(400);
    s.reset("password", { currentPassword: "pumpkin-42", confirm: true });
    expect(s.passwordSet).toBe(false);
  });

  it("a plain-text password in settings.json is ignored", async () => {
    await writeFile(join(dir, "settings.json"), JSON.stringify({ password: "plain", restore: "on" }));
    const s = make();
    expect(s.passwordSet).toBe(false);
    expect(s.get("restore")).toBe("on");
    expect(log.warn).toHaveBeenCalledWith(expect.stringMatching(/password/));
  });
});

describe("volume.json migration", () => {
  it("moves level and mute into settings.json and removes volume.json", async () => {
    await writeFile(join(dir, "volume.json"), JSON.stringify({ level: 72, muted: true }));
    const s = make();
    expect([s.get("volume"), s.source("volume"), s.get("muted")]).toEqual([72, "web", true]);
    expect(await onDisk()).toEqual({ volume: 72, muted: true });
    expect(await readdir(dir)).toEqual(["settings.json"]);
  });

  it("clamps an out-of-range level and skips a corrupt one", async () => {
    await writeFile(join(dir, "volume.json"), JSON.stringify({ level: 900 }));
    expect(make().get("volume")).toBe(100);
    await rm(join(dir, "settings.json"));
    await writeFile(join(dir, "volume.json"), JSON.stringify({ level: "loud", muted: "yes" }));
    const s = make();
    expect([s.get("volume"), s.get("muted")]).toEqual([30, false]);
  });

  it("leaves an unreadable volume.json alone", async () => {
    await writeFile(join(dir, "volume.json"), "{nope");
    expect(make().get("volume")).toBe(30);
    expect(await readdir(dir)).toEqual(["volume.json"]);
    expect(log.warn).toHaveBeenCalled();
  });

  it("does not migrate once settings.json exists", async () => {
    await writeFile(join(dir, "settings.json"), JSON.stringify({ volume: 10 }));
    await writeFile(join(dir, "volume.json"), JSON.stringify({ level: 90 }));
    expect(make().get("volume")).toBe(10);
  });
});

describe("files", () => {
  it("writes atomically: mode 600, no temp files left", async () => {
    const s = make();
    s.set("restore", "on");
    s.set("name", "Porch");
    expect(await readdir(dir)).toEqual(["settings.json"]);
    expect((await stat(join(dir, "settings.json"))).mode & 0o777).toBe(0o600);
    expect(await onDisk()).toEqual({ restore: "on", name: "Porch" });
  });

  it("a failed write leaves the old file intact and no temp file", async () => {
    const file = join(dir, "sub", "settings.json");
    await mkdir(file, { recursive: true }); // a directory where the file should go: rename fails
    expect(() => writeJsonAtomic(file, { a: 1 })).toThrow();
    expect(await readdir(join(dir, "sub"))).toEqual(["settings.json"]);

    const s = make();
    s.set("restore", "on");
    await rm(join(dir, "settings.json"));
    await mkdir(join(dir, "settings.json"));
    expect(() => s.set("restore", "off")).toThrow();
    expect(s.get("restore")).toBe("on"); // in-memory state unchanged
    expect((await readdir(dir)).filter((f) => f.includes("tmp"))).toEqual([]);
  });

  it("a corrupt settings.json falls back to file values and defaults, with a warning and a backup", async () => {
    await writeFile(join(dir, "settings.json"), "{ this is not json");
    const s = make({ VIDEOFX_RESTORE: "off" });
    expect([s.get("restore"), s.source("restore")]).toEqual(["off", "file"]);
    expect([s.get("volume"), s.source("volume")]).toEqual([30, "default"]);
    expect(log.warn).toHaveBeenCalledWith(expect.stringMatching(/unreadable/));
    expect(await readFile(join(dir, "settings.json.corrupt"), "utf8")).toBe("{ this is not json");
    s.set("name", "Porch"); // next save replaces it with good JSON
    expect(await onDisk()).toEqual({ name: "Porch" });
  });

  it("bad single values in settings.json are ignored with a warning", async () => {
    await writeFile(join(dir, "settings.json"), JSON.stringify({ restore: "maybe", httpPort: 8080, bogus: 1, name: "Porch" }));
    const s = make();
    expect(s.get("restore")).toBe("last");
    expect(s.get("httpPort")).toBe(80);
    expect(s.get("name")).toBe("Porch");
    expect(log.warn).toHaveBeenCalledTimes(3);
  });
});
