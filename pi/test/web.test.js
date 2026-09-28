import { mkdtemp, readFile, rm } from "node:fs/promises";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMediaStore } from "../src/media.js";
import { qrTextToMatrix, qrTextToSvg } from "../src/qr.js";
import { createWebServer, isAllowedHost, isLanAddress } from "../src/web.js";

describe("LAN-only guard", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.20", "169.254.3.4", "::1", "fe80::1%eth0", "fd12::1", "::ffff:192.168.1.5"])(
    "allows %s",
    (ip) => expect(isLanAddress(ip)).toBe(true),
  );
  it.each(["8.8.8.8", "172.32.0.1", "100.64.0.1", "2001:db8::1", "::ffff:8.8.8.8", "", undefined])("blocks %s", (ip) =>
    expect(isLanAddress(ip)).toBe(false),
  );
});

describe("Host header guard", () => {
  const names = ["videofx-1a2b", "videofx-1a2b.local"];
  it.each(["videofx-1a2b.local", "VIDEOFX-1A2B.local:80", "videofx-1a2b.local.", "192.168.1.20", "192.168.1.20:8080", "[fe80::1]:80", "localhost:80"])(
    "allows %s",
    (h) => expect(isAllowedHost(h, names)).toBe(true),
  );
  it.each(["evil.example.com", "videovideofx-1a2b.local.evil.com", "", "videofx-9999.local"])("blocks %s", (h) =>
    expect(isAllowedHost(h, names)).toBe(false),
  );
});

describe("QR code", () => {
  // Shape of matter.js QrCode.get() output: half blocks, light = block.
  const text = ["▄▄▄▄▄", "█⠀▄⠀█", "█▄█▄█", "▀▀▀▀▀"].join("\n");
  it("crops to the dark modules and inverts the blocks", () => {
    expect(qrTextToMatrix(text).map((r) => r.map((v) => (v ? "#" : ".")).join(""))).toEqual(["###", "#.#", "#.#"]);
  });
  it("renders an SVG with a quiet zone", () => {
    expect(qrTextToSvg(text)).toMatch(/^<svg [^>]*viewBox="-4 -4 11 11"/);
  });
});

describe("web server", () => {
  let dir;
  let server;
  let port;
  let power;
  let playlistChanged;
  let resetMatter;
  let password;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "videofx-web-"));
    power = vi.fn(async () => {});
    playlistChanged = vi.fn();
    resetMatter = vi.fn(async () => {});
    password = "";
    const media = createMediaStore({ dir, playlist: join(dir, "playlist.m3u"), maxUploadBytes: 1000 });
    server = createWebServer({
      media,
      auth: {
        get passwordSet() {
          return password !== "";
        },
        verifyPassword: (p) => p === password,
      },
      hostNames: () => ["videofx-1a2b.local"],
      status: () => ({ name: "videofx-1a2b", on: false }),
      setPower: power,
      setVolume: async (v) => {
        if (v.level !== undefined && typeof v.level !== "number") throw new Error("level must be a number from 0 to 100");
        return { level: v.level ?? 30, muted: v.muted ?? false };
      },
      playlistChanged,
      pairingSvg: () => "<svg/>",
      resetMatter,
      log: { error: () => {} },
    });
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    port = server.address().port;
  });
  afterEach(async () => {
    server.close();
    await rm(dir, { recursive: true, force: true });
  });

  // node:http rather than fetch so raw paths like /../ are sent unnormalised.
  function call(method, path, { body, headers = {} } = {}) {
    return new Promise((resolve, reject) => {
      const req = request(
        { host: "127.0.0.1", port, method, path, headers: { "x-videofx": "1", ...headers } },
        (res) => {
          let data = "";
          res.on("data", (c) => (data += c));
          res.on("end", () => {
            let json;
            try {
              json = JSON.parse(data);
            } catch {}
            resolve({ status: res.statusCode, headers: res.headers, text: data, json });
          });
        },
      );
      req.on("error", reject);
      req.end(body);
    });
  }

  it("serves the page and the shared module", async () => {
    expect((await call("GET", "/")).text).toMatch(/<title>VideoFX<\/title>/);
    expect((await call("GET", "/playlist-core.js")).text).toMatch(/export function moveEntry/);
  });

  it("does not serve arbitrary files", async () => {
    for (const path of ["/../package.json", "/src/main.js", "/public/../package.json", "/api/media/..%2F..%2Fpackage.json", "/%2e%2e/package.json"]) {
      const res = await call("GET", path);
      expect(res.status, path).toBe(404);
      expect(res.text).not.toMatch(/"dependencies"/);
    }
  });

  it("rejects upload path traversal", async () => {
    for (const name of ["..%2Fevil.mp4", "%2E%2E%2Fevil.mp4", ".evil.mp4", "a%2Fb.mp4", "%E0%A4%A.mp4"]) {
      const res = await call("PUT", `/api/media/${name}`, { body: "x" });
      expect(res.status, name).toBe(400);
    }
    const nested = await call("PUT", "/api/media/../evil.mp4", { body: "x" });
    expect(nested.status).toBe(404);
  });

  it("uploads, then saves a playlist and tells the player", async () => {
    expect((await call("PUT", "/api/media/ghost%20ship.mp4", { body: "video" })).status).toBe(201);
    const list = await call("GET", "/api/media");
    expect(list.json.files.map((f) => f.name)).toEqual(["ghost ship.mp4"]);
    const save = await call("PUT", "/api/playlist", {
      body: JSON.stringify({ entries: [{ file: "ghost ship.mp4", enabled: true }] }),
      headers: { "content-type": "application/json" },
    });
    expect(save.status).toBe(200);
    expect(playlistChanged).toHaveBeenCalledTimes(1);
    expect(await readFile(join(dir, "playlist.m3u"), "utf8")).toBe("#EXTM3U\nghost ship.mp4\n");
  });

  it("rejects oversized uploads with 413", async () => {
    const res = await call("PUT", "/api/media/big.mp4", { body: "x".repeat(2000) });
    expect(res.status).toBe(413);
  });

  it("requires the CSRF header on writes", async () => {
    const res = await call("POST", "/api/power", { body: '{"on":false}', headers: { "x-videofx": "" } });
    expect(res.status).toBe(403);
    expect(power).not.toHaveBeenCalled();
  });

  it("refuses to play with no playlist, and stops through setPower", async () => {
    const on = await call("POST", "/api/power", { body: '{"on":true}' });
    expect(on.status).toBe(409);
    expect(on.json.error).toMatch(/playlist/);
    expect((await call("POST", "/api/power", { body: '{"on":false}' })).status).toBe(200);
    expect(power).toHaveBeenCalledWith(false);
  });

  it("rejects unknown Host headers", async () => {
    const res = await call("GET", "/api/status", { headers: { host: "rebind.example.com" } });
    expect(res.status).toBe(421);
  });

  it("asks for a password when one is set", async () => {
    password = "boo";
    expect((await call("GET", "/api/status")).status).toBe(401);
    const bad = Buffer.from("x:nope").toString("base64");
    expect((await call("GET", "/api/status", { headers: { authorization: `Basic ${bad}` } })).status).toBe(401);
    const good = Buffer.from("anyone:boo").toString("base64");
    expect((await call("GET", "/api/status", { headers: { authorization: `Basic ${good}` } })).status).toBe(200);
  });

  it("sets the volume, and rejects bad values with 400", async () => {
    const ok = await call("POST", "/api/volume", { body: '{"level":25,"muted":true}' });
    expect(ok.status).toBe(200);
    expect(ok.json).toEqual({ level: 25, muted: true });
    expect((await call("POST", "/api/volume", { body: '{"level":"max"}' })).status).toBe(400);
  });

  it("guards the Matter reset", async () => {
    expect((await call("POST", "/api/matter/reset", { body: "{}" })).status).toBe(400);
    expect(resetMatter).not.toHaveBeenCalled();
    expect((await call("POST", "/api/matter/reset", { body: '{"confirm":"reset"}' })).status).toBe(202);
    expect(resetMatter).toHaveBeenCalledTimes(1);
  });
});

describe("settings API", () => {
  let dir;
  let server;
  let port;
  let settings;
  let restart;
  let afterSettingChange;

  beforeEach(async () => {
    const { Settings } = await import("../src/settings.js");
    dir = await mkdtemp(join(tmpdir(), "videofx-web-settings-"));
    settings = new Settings({ dir, env: {}, ctx: { home: dir, deviceName: "videofx-1a2b" }, log: { warn() {}, info() {} } });
    restart = vi.fn(async () => {});
    afterSettingChange = vi.fn(async (key) => (key === "mpvExtraArgs" ? "next play" : undefined));
    server = createWebServer({
      media: createMediaStore({ dir, playlist: join(dir, "playlist.m3u") }),
      settings,
      auth: settings,
      hostNames: () => ["videofx-1a2b.local", ...settings.get("webHosts")],
      status: () => ({}),
      setPower: async () => {},
      setVolume: async () => ({}),
      afterSettingChange,
      playlistChanged: () => {},
      pairingSvg: () => undefined,
      resetMatter: async () => {},
      restart,
      log: { error: () => {} },
    });
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    port = server.address().port;
  });
  afterEach(async () => {
    server.close();
    await rm(dir, { recursive: true, force: true });
  });

  function call(method, path, { body, headers = {}, password } = {}) {
    const auth = password ? { authorization: `Basic ${Buffer.from(`u:${password}`).toString("base64")}` } : {};
    const data = body === undefined ? undefined : JSON.stringify(body);
    const length = data === undefined ? {} : { "content-length": Buffer.byteLength(data) };
    return new Promise((resolve, reject) => {
      const req = request({ host: "127.0.0.1", port, method, path, headers: { "x-videofx": "1", ...length, ...auth, ...headers } }, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve({ status: res.statusCode, text: data, json: data ? JSON.parse(data) : null }));
      });
      req.on("error", reject);
      req.end(data);
    });
  }

  it("lists settings with sources", async () => {
    const res = await call("GET", "/api/settings");
    expect(res.status).toBe(200);
    const restore = res.json.settings.find((s) => s.key === "restore");
    expect(restore).toMatchObject({ value: "last", source: "default", options: ["last", "on", "off"] });
  });

  it("saves, reports the note, and resets", async () => {
    const put = await call("PUT", "/api/settings/mpvExtraArgs", { body: { value: "--hwdec=no" } });
    expect(put.status).toBe(200);
    expect(put.json).toMatchObject({ setting: { value: "--hwdec=no", source: "web" }, note: "next play" });
    expect(afterSettingChange).toHaveBeenCalledWith("mpvExtraArgs");
    const del = await call("DELETE", "/api/settings/mpvExtraArgs", { body: {} });
    expect(del.json.setting.source).toBe("default");
  });

  it("rejects bad values (400), fixed settings (403), unknown keys (404)", async () => {
    expect((await call("PUT", "/api/settings/mpvExtraArgs", { body: { value: "--input-ipc-server=/tmp/x" } })).json.error).toMatch(/not allowed/);
    expect((await call("PUT", "/api/settings/restore", { body: { value: "maybe" } })).status).toBe(400);
    expect((await call("PUT", "/api/settings/httpPort", { body: { value: 8080 } })).status).toBe(403);
    expect((await call("PUT", "/api/settings/nope", { body: { value: 1 } })).status).toBe(404);
  });

  it("extra host names take effect at once", async () => {
    const other = () => call("GET", "/api/settings", { headers: { host: "projector.home.arpa" } });
    expect((await other()).status).toBe(421);
    await call("PUT", "/api/settings/webHosts", { body: { value: "projector.home.arpa" } });
    expect((await other()).status).toBe(200);
  });

  it("password: set, then required; change needs the current one; never echoed", async () => {
    const set = await call("PUT", "/api/settings/password", { body: { value: "pumpkin-42" } });
    expect(set.status).toBe(200);
    expect(set.text).not.toContain("pumpkin-42");
    expect(set.json.setting).toMatchObject({ isSet: true });
    expect((await call("GET", "/api/settings")).status).toBe(401);
    const listing = await call("GET", "/api/settings", { password: "pumpkin-42" });
    expect(listing.status).toBe(200);
    expect(listing.text).not.toContain("pumpkin");
    const wrong = await call("PUT", "/api/settings/password", { password: "pumpkin-42", body: { value: "ghost-1234", currentPassword: "x" } });
    expect(wrong.status).toBe(403);
    const clear = await call("PUT", "/api/settings/password", { password: "pumpkin-42", body: { value: "", currentPassword: "pumpkin-42" } });
    expect(clear.status).toBe(400);
    const ok = await call("PUT", "/api/settings/password", {
      password: "pumpkin-42",
      body: { value: "", currentPassword: "pumpkin-42", confirm: true },
    });
    expect(ok.status).toBe(200);
    expect((await call("GET", "/api/settings")).status).toBe(200);
  });

  it("restart needs the CSRF header", async () => {
    expect((await call("POST", "/api/restart", { headers: { "x-videofx": "" } })).status).toBe(403);
    expect(restart).not.toHaveBeenCalled();
    expect((await call("POST", "/api/restart")).status).toBe(202);
    expect(restart).toHaveBeenCalledTimes(1);
  });
});

describe("backup/restore routes", () => {
  let server;
  let port;
  let restored;
  let password = "";
  beforeEach(async () => {
    restored = null;
    server = createWebServer({
      media: createMediaStore({ dir: tmpdir(), playlist: join(tmpdir(), "x.m3u") }),
      auth: { get passwordSet() { return password !== ""; }, verifyPassword: (p) => p === password },
      hostNames: () => [],
      status: () => ({}),
      backup: async () => ({ format: "videofx-backup", device: "videofx-beef", createdAt: "2026-10-01T00:00:00.000Z", matter: { a: "AA==" } }),
      restore: async (body) => ((restored = body), { restarting: true }),
      log: { error() {} },
    });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    port = server.address().port;
  });
  afterEach(() => {
    server.close();
    password = "";
  });
  const call = (method, path, { body, headers = {} } = {}) =>
    new Promise((resolve, reject) => {
      const data = body === undefined ? undefined : JSON.stringify(body);
      const req = request({ host: "127.0.0.1", port, method, path, headers: { "x-videofx": "1", ...(data ? { "content-length": Buffer.byteLength(data) } : {}), ...headers } }, (res) => {
        let text = "";
        res.on("data", (c) => (text += c));
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, text }));
      });
      req.on("error", reject);
      req.end(data);
    });

  it("downloads as an attachment, never cached", async () => {
    const res = await call("GET", "/api/backup");
    expect(res.status).toBe(200);
    expect(res.headers["content-disposition"]).toBe('attachment; filename="videofx-beef-backup-2026-10-01.json"');
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("the download needs the password when one is set", async () => {
    password = "pumpkin-42";
    expect((await call("GET", "/api/backup")).status).toBe(401);
    const auth = { authorization: `Basic ${Buffer.from("u:pumpkin-42").toString("base64")}` };
    expect((await call("GET", "/api/backup", { headers: auth })).status).toBe(200);
  });

  it("restore takes a large body and needs the write header", async () => {
    const big = { backup: { format: "videofx-backup", matter: { a: "A".repeat(2_000_000) } }, includeMatter: false };
    expect((await call("POST", "/api/restore", { body: big })).status).toBe(200);
    expect(restored.includeMatter).toBe(false);
    // Refused before the body is read (small body: a big one would see the socket closed mid-send).
    expect((await call("POST", "/api/restore", { body: { backup: {} }, headers: { "x-videofx": "" } })).status).toBe(403);
  });
});
