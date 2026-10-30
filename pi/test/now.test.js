import { EventEmitter } from "node:events";
import { mkdir, mkdtemp, readdir, rm, utimes, writeFile } from "node:fs/promises";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clipTitle, clock, elapsed, nowView, volumeView } from "../public/now.js";
import { createMediaStore } from "../src/media.js";
import { Player } from "../src/player.js";
import { createPosterCache, posterArgs } from "../src/poster.js";
import { createWebServer } from "../src/web.js";

describe("now-playing header", () => {
  it("formats clock times", () => {
    expect(clock(0)).toBe("0:00");
    expect(clock(75.9)).toBe("1:15");
    expect(clock(3725)).toBe("1:02:05");
    expect(clock(-3)).toBe("0:00");
  });

  it("drops the extension from the title only", () => {
    expect(clipTitle("ghost-scare-1.mp4")).toBe("ghost-scare-1");
    expect(clipTitle("v1.2 final.webm")).toBe("v1.2 final");
  });

  it("runs the clock between polls and holds at the end", () => {
    const now = { file: "a.mp4", position: 10, duration: 12 };
    expect(elapsed(now, 1500)).toBe(11.5);
    expect(elapsed(now, 9000)).toBe(12);
    expect(elapsed({ ...now, duration: null }, 9000)).toBe(19);
  });

  it("shows the clip, time, progress and poster while playing", () => {
    const v = nowView({ on: true, now: { file: "zombie walk.mp4", position: 30, duration: 120 }, player: {} }, 0);
    expect(v).toMatchObject({ title: "zombie walk", time: "0:30 / 2:00", progress: 0.25, poster: "/api/poster/zombie%20walk.mp4" });
    expect(v.toggle).toEqual({ action: "pause", icon: "pause", label: "Pause", disabled: false });
  });

  it("says why nothing plays, and locks the button under DMX", () => {
    expect(nowView(null, 0)).toMatchObject({ title: "Connecting…", poster: null, toggle: { disabled: true } });
    expect(nowView({ on: false, problem: "playlist is empty" }, 0).title).toBe("Can't play: playlist is empty");
    expect(nowView({ on: true, now: null }, 0).title).toBe("Starting…");
    expect(nowView({ on: false, dmx: { inControl: true } }, 0).toggle).toEqual({ action: "power", icon: "play", label: "Play", disabled: true });
    expect(nowView({ on: true, now: null }, 0).toggle.disabled).toBe(true); // nothing to pause yet
  });

  it("stops the clock while paused and offers Resume", () => {
    const v = nowView({ on: true, now: { file: "a.mp4", position: 10, duration: 60 }, player: { paused: true } }, 5000);
    expect(v.time).toBe("0:10 / 1:00 · paused");
    expect(v.toggle).toMatchObject({ action: "resume", icon: "play", label: "Resume" });
  });

  it("shows the volume and mute, locked under DMX, with the quiet-hours cap", () => {
    expect(volumeView(null)).toBeNull();
    expect(volumeView({ volume: { level: 40, muted: false } })).toEqual({ level: 40, text: "40%", muted: false, mute: "Mute", disabled: false, title: "Speaker volume" });
    expect(volumeView({ volume: { level: 10, muted: true }, dmx: { inControl: true }, quiet: { active: true, cap: 10 } })).toMatchObject({
      mute: "Unmute",
      disabled: true,
      title: "Speaker volume (quiet hours: at most 10%)",
    });
  });

  it("marks a scare", () => {
    expect(nowView({ on: true, now: { file: "s.mp4", position: 1, duration: 9 }, player: { scareActive: true } }, 0).time).toBe("0:01 / 0:09 · scare");
  });
});

class FakeMpv extends EventEmitter {
  ready = true;
  props = { path: "/home/videofx/media/zombie.mp4", "time-pos": 42.5, duration: 312, "idle-active": false };
  hang = false;
  command(name, prop) {
    if (this.hang) return new Promise(() => {});
    if (name === "get_property") return Promise.resolve(this.props[prop]);
    return Promise.resolve(null);
  }
}

describe("Player.nowPlaying", () => {
  const content = { mode: "loop", playlist: "/m/p.m3u", buffer: "", scares: [], order: "sequential", cooldownMs: 0, duringScare: "ignore", mirror: false };
  const make = (mpv) => new Player({ mpv, content: () => content, log: { info() {}, warn() {}, error() {} }, now: () => 1000 });

  it("is null while off", async () => {
    expect(await make(new FakeMpv()).nowPlaying()).toBeNull();
  });

  it("reads the file name, position and length from mpv", async () => {
    const mpv = new FakeMpv();
    const p = make(mpv);
    p.setOn(true);
    await vi.waitFor(() => expect(p.isPlaying).toBe(true));
    expect(await p.nowPlaying()).toEqual({ file: "zombie.mp4", position: 42.5, duration: 312, at: 1000 });
    mpv.props.duration = null;
    mpv.props["time-pos"] = null;
    expect(await p.nowPlaying()).toMatchObject({ position: 0, duration: null });
  });

  it("gives up quickly on a busy mpv", async () => {
    const mpv = new FakeMpv();
    const p = make(mpv);
    p.setOn(true);
    await vi.waitFor(() => expect(p.isPlaying).toBe(true));
    mpv.hang = true;
    expect(await p.nowPlaying({ timeoutMs: 20 })).toBeNull();
  });
});

describe("Player pause", () => {
  const content = { mode: "scare", playlist: "/m/p.m3u", buffer: "/m/calm.mp4", scares: ["/m/s1.mp4"], order: "sequential", cooldownMs: 0, duringScare: "ignore", mirror: false };
  function make() {
    const mpv = new FakeMpv();
    const sent = [];
    const orig = mpv.command.bind(mpv);
    mpv.command = (...a) => (a[0] === "set_property" && a[1] === "pause" && sent.push(a[2]), orig(...a));
    const p = new Player({ mpv, content: () => content, log: { info() {}, warn() {}, error() {} } });
    return { mpv, p, sent };
  }

  it("does nothing while off", () => {
    const { p, sent } = make();
    expect(p.setPaused(true)).toBe(false);
    expect(sent).toEqual([]);
  });

  it("pauses and resumes mpv, and blocks scares while paused", async () => {
    const { p, sent } = make();
    p.setOn(true);
    await vi.waitFor(() => expect(p.isPlaying).toBe(true));
    expect(p.setPaused(true)).toBe(true);
    expect(p.status.paused).toBe(true);
    expect(p.trigger("web page")).toEqual({ result: "ignored", reason: "playback is paused" });
    expect(p.setPaused(false)).toBe(false);
    await vi.waitFor(() => expect(sent).toEqual([true, false]));
  });

  it("resumes on stop, so the next start is not frozen", async () => {
    const { p, sent } = make();
    p.setOn(true);
    await vi.waitFor(() => expect(p.isPlaying).toBe(true));
    p.setPaused(true);
    p.setOn(false);
    expect(p.isPaused).toBe(false);
    await vi.waitFor(() => expect(sent).toEqual([true, false]));
  });

  it("forgets the pause when mpv restarts", async () => {
    const { mpv, p } = make();
    p.setOn(true);
    await vi.waitFor(() => expect(p.isPlaying).toBe(true));
    p.setPaused(true);
    mpv.ready = false;
    mpv.emit("down");
    expect(p.isPaused).toBe(false);
  });
});

describe("poster cache", () => {
  let dir;
  beforeEach(async () => (dir = await mkdtemp(join(tmpdir(), "videofx-poster-"))));
  afterEach(() => rm(dir, { recursive: true, force: true }));

  function setup(fail = false) {
    const media = join(dir, "media");
    const execFile = vi.fn(async (_cmd, args) => {
      if (fail) throw new Error("boom");
      const out = args.find((a) => a.startsWith("--vo-image-outdir=")).split("=")[1];
      await writeFile(join(out, "00000001.jpg"), `jpeg of ${args.at(-1)}`);
    });
    const cache = createPosterCache({ dir: join(dir, "posters"), resolve: (n) => join(media, n), execFile, log: { error() {} } });
    return { media, execFile, cache };
  }

  it("grabs a frame once and serves it from disk after", async () => {
    const { media, execFile, cache } = setup();
    await mkdir(media);
    await writeFile(join(media, "a.mp4"), "video");
    const [one, two] = await Promise.all([cache.poster("a.mp4"), cache.poster("a.mp4")]);
    expect(one.type).toBe("image/jpeg");
    expect(String(one.body)).toBe(`jpeg of ${join(media, "a.mp4")}`);
    expect(String(two.body)).toBe(String(one.body));
    await cache.poster("a.mp4");
    expect(execFile).toHaveBeenCalledTimes(1);
    expect(execFile.mock.calls[0][0]).toBe("nice");
    expect(execFile.mock.calls[0][1].slice(0, 3)).toEqual(["-n", "19", "mpv"]);

    // A changed file gets a new poster and the old one is removed.
    await utimes(join(media, "a.mp4"), new Date(), new Date(Date.now() + 5000));
    await cache.poster("a.mp4");
    expect(execFile).toHaveBeenCalledTimes(2);
    expect((await readdir(join(dir, "posters"))).filter((n) => n.endsWith(".jpg"))).toHaveLength(1);
  });

  it("returns null for a missing clip or a failed grab, and does not retry the failure", async () => {
    const { media, execFile, cache } = setup(true);
    expect(await cache.poster("nope.mp4")).toBeNull();
    await mkdir(media);
    await writeFile(join(media, "b.mp4"), "video");
    expect(await cache.poster("b.mp4")).toBeNull();
    expect(await cache.poster("b.mp4")).toBeNull();
    expect(execFile).toHaveBeenCalledTimes(1);
    expect((await readdir(join(dir, "posters"))).filter((n) => n.startsWith(".grab-"))).toEqual([]);
  });

  it("asks mpv for one scaled frame and ends the options before the file", () => {
    const args = posterArgs("/m/-odd.mp4", "/tmp/x");
    expect(args).toContain("--frames=1");
    expect(args).toContain("--vo=image");
    expect(args.slice(-2)).toEqual(["--", "/m/-odd.mp4"]);
  });
});

describe("web routes", () => {
  let dir, server, port, paused;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "videofx-now-"));
    paused = [];
    const media = createMediaStore({ dir, playlist: join(dir, "playlist.m3u") });
    server = createWebServer({
      media,
      auth: { passwordSet: false, verifyPassword: () => true },
      hostNames: () => ["localhost"],
      status: () => ({ name: "videofx-1a2b", on: true }),
      nowPlaying: async () => ({ file: "a.mp4", position: 1, duration: 2, at: 0 }),
      setPaused: (p) => (paused.push(p), undefined),
      poster: async (name) => (name === "a b.mp4" ? { body: Buffer.from("jpg"), type: "image/jpeg" } : null),
      log: { error() {} },
    });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    port = server.address().port;
  });
  afterEach(async () => {
    server.close();
    await rm(dir, { recursive: true, force: true });
  });
  const get = (path, method = "GET", body) =>
    new Promise((resolve, reject) => {
      const req = request({ host: "127.0.0.1", port, path, method, headers: { host: "localhost", "x-videofx": "1" } }, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve({ status: res.statusCode, type: res.headers["content-type"], data }));
      });
      req.on("error", reject);
      req.end(body);
    });

  it("pauses and resumes, and refuses anything but true or false", async () => {
    expect((await get("/api/pause", "POST", '{"paused":true}')).status).toBe(200);
    expect((await get("/api/pause", "POST", '{"paused":false}')).status).toBe(200);
    expect((await get("/api/pause", "POST", '{"paused":"yes"}')).status).toBe(400);
    expect(paused).toEqual([true, false]);
  });

  it("adds what is playing to the status", async () => {
    const r = await get("/api/status");
    expect(JSON.parse(r.data)).toEqual({ name: "videofx-1a2b", on: true, now: { file: "a.mp4", position: 1, duration: 2, at: 0 } });
  });

  it("serves a poster, or 404", async () => {
    expect(await get("/api/poster/a%20b.mp4")).toMatchObject({ status: 200, type: "image/jpeg", data: "jpg" });
    expect((await get("/api/poster/other.mp4")).status).toBe(404);
    expect((await get("/api/poster/%E0%A4%A")).status).toBe(400);
  });
});
