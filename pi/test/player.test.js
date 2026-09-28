import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Player } from "../src/player.js";

// Stands in for MpvSupervisor: records commands, lets tests emit mpv events.
class FakeMpv extends EventEmitter {
  ready = false;
  commands = [];
  restarts = 0;
  async command(...args) {
    if (!this.ready) throw new Error("mpv is not running");
    this.commands.push(args);
    if (args[0] === "get_property") return "auto-safe";
    return null;
  }
  up() {
    this.ready = true;
    this.emit("ready");
  }
  down() {
    this.ready = false;
    this.emit("down");
  }
  restart() {
    this.restarts++;
  }
  shutdown = vi.fn(async () => {});
  event(e) {
    this.emit("event", e);
  }
}

const flush = () => vi.advanceTimersByTimeAsync(0);

function setup(contentOverrides = {}, opts = {}) {
  const mpv = new FakeMpv();
  let saved;
  const store = { load: vi.fn(() => saved), save: vi.fn((v) => (saved = v)) };
  const content = {
    mode: "loop",
    playlist: "/m/playlist.m3u",
    buffer: "/m/calm.mp4",
    scares: ["/m/s1.mp4", "/m/s2.mp4", "/m/s3.mp4"],
    order: "sequential",
    cooldownMs: 20_000,
    duringScare: "ignore",
    mirror: false,
    ...contentOverrides,
  };
  const blank = vi.fn();
  const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const player = new Player({ mpv, content: () => content, store, blank, log, random: () => 0, ...opts });
  const failed = vi.fn();
  const scares = [];
  player.on("failed", failed);
  player.on("scare", (e) => scares.push(e.state));
  const cmds = () => mpv.commands.map((c) => c.join(" "));
  const clear = () => (mpv.commands.length = 0);
  return { mpv, player, content, store, blank, failed, scares, cmds, clear, setSaved: (v) => (saved = v) };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("power (loop mode)", () => {
  it("plays the playlist in a loop through IPC, no process restart", async () => {
    const { mpv, player, cmds } = setup();
    mpv.up();
    expect(player.setOn(true)).toBe(true);
    await flush();
    expect(cmds()).toEqual(["set_property loop-file no", "set_property loop-playlist inf", "loadlist /m/playlist.m3u replace"]);
    expect(player.isPlaying).toBe(true);
  });

  it("waits for mpv if it is not up yet, then plays", async () => {
    const { mpv, player, cmds } = setup();
    player.setOn(true);
    await flush();
    expect(cmds()).toEqual([]);
    mpv.up();
    await flush();
    expect(cmds()).toContain("loadlist /m/playlist.m3u replace");
  });

  it("off: stop (mpv idles and releases the screen) and blank the console; idempotent", async () => {
    const { mpv, player, cmds, clear, blank } = setup();
    mpv.up();
    player.setOn(true);
    await flush();
    clear();
    player.setOn(false);
    player.setOn(false);
    await flush();
    expect(cmds()).toEqual(["stop"]);
    expect(blank).toHaveBeenCalledTimes(1);
    expect(player.isPlaying).toBe(false);
  });

  it("refuses to turn on when preflight fails and reports it", () => {
    const { mpv, player, failed, store } = setup({}, { preflight: () => "the playlist has no enabled entries" });
    mpv.up();
    expect(player.setOn(true)).toBe(false);
    expect(failed).toHaveBeenCalledWith("the playlist has no enabled entries");
    expect(store.save).toHaveBeenLastCalledWith(false);
  });

  it("reload() re-applies the playlist while playing, not while off", async () => {
    const { mpv, player, cmds, clear } = setup();
    mpv.up();
    player.reload();
    await flush();
    expect(cmds()).toEqual([]);
    player.setOn(true);
    await flush();
    clear();
    player.reload();
    await flush();
    expect(cmds()).toContain("loadlist /m/playlist.m3u replace");
  });

  it("after an mpv crash and restart, playback resumes", async () => {
    const { mpv, player, cmds, clear } = setup();
    mpv.up();
    player.setOn(true);
    await flush();
    mpv.down();
    expect(player.isPlaying).toBe(false);
    clear();
    mpv.up();
    await flush();
    expect(cmds()).toContain("loadlist /m/playlist.m3u replace");
    expect(player.isPlaying).toBe(true);
  });

  it("when mpv gives up, turns off and reports it", () => {
    const { mpv, player, failed, blank } = setup();
    mpv.up();
    player.setOn(true);
    mpv.emit("failed", "the video player keeps crashing");
    expect(player.isOn).toBe(false);
    expect(failed).toHaveBeenCalledWith("the video player keeps crashing");
    expect(blank).toHaveBeenCalled();
  });

  it("argsChanged restarts mpv at once when off, else before the next play", () => {
    const { mpv, player } = setup();
    mpv.up();
    player.argsChanged();
    expect(mpv.restarts).toBe(1);
    player.setOn(true);
    player.argsChanged();
    expect(mpv.restarts).toBe(1);
    player.setOn(false);
    player.setOn(true);
    expect(mpv.restarts).toBe(2);
  });
});

describe("restore", () => {
  it("persists every change and restores per policy", () => {
    const { player, store, setSaved } = setup();
    player.setOn(true);
    player.setOn(false);
    expect(store.save.mock.calls).toEqual([[true], [false]]);
    setSaved(true);
    expect(player.initialState("last")).toBe(true);
    expect(player.initialState("off")).toBe(false);
    setSaved(false);
    expect(player.initialState("on")).toBe(true);
    expect(player.initialState("last")).toBe(false);
  });
});

describe("scare mode", () => {
  async function scareSetup(over = {}, opts = {}) {
    const t = setup({ mode: "scare", ...over }, opts);
    t.mpv.up();
    t.player.setOn(true);
    await flush();
    return t;
  }
  // mpv's events for one scare: buffer stopped, scare plays to the end, buffer loads.
  const playScare = (mpv) => {
    mpv.event({ event: "end-file", reason: "stop" });
    mpv.event({ event: "file-loaded" });
    mpv.event({ event: "playback-restart" });
    mpv.event({ event: "end-file", reason: "eof" });
    mpv.event({ event: "file-loaded" });
    mpv.event({ event: "playback-restart" });
  };

  it("loops the buffer and queues the next scare and the buffer behind it (prefetch)", async () => {
    const { cmds } = await scareSetup();
    expect(cmds()).toEqual([
      "set_property loop-playlist no",
      "set_property loop-file inf",
      "loadfile /m/calm.mp4 replace",
      "loadfile /m/s1.mp4 append",
      "loadfile /m/calm.mp4 append",
    ]);
  });

  it("trigger: loop-file off + playlist-next; after the scare, re-arms with the next clip and starts the cooldown", async () => {
    const { mpv, player, cmds, clear, scares } = await scareSetup();
    clear();
    expect(player.trigger("web")).toEqual({ result: "fired", clip: "/m/s1.mp4" });
    await flush();
    expect(cmds()).toEqual(["set_property loop-file no", "playlist-next force"]);
    expect(player.scareActive).toBe(true);
    clear();
    playScare(mpv);
    await flush();
    expect(cmds()).toEqual(["set_property loop-file inf", "playlist-clear", "loadfile /m/s2.mp4 append", "loadfile /m/calm.mp4 append"]);
    expect(player.scareActive).toBe(false);
    expect(scares).toEqual(["start", "end"]);
    expect(player.status.cooldownLeftMs).toBe(20_000);
  });

  it("sequential order cycles through the clips", async () => {
    const { mpv, player } = await scareSetup({ cooldownMs: 0 });
    const fired = [];
    for (let i = 0; i < 4; i++) {
      fired.push(player.trigger("t").clip);
      playScare(mpv);
      await flush();
    }
    expect(fired).toEqual(["/m/s1.mp4", "/m/s2.mp4", "/m/s3.mp4", "/m/s1.mp4"]);
  });

  it("random order plays each clip once per round and doesn't repeat across rounds", async () => {
    let r = 0.99;
    const { mpv, player } = await scareSetup({ order: "random", cooldownMs: 0 }, { random: () => (r = (r * 7.3) % 1) });
    const fired = [];
    for (let i = 0; i < 6; i++) {
      fired.push(player.trigger("t").clip);
      playScare(mpv);
      await flush();
    }
    expect(new Set(fired.slice(0, 3)).size).toBe(3);
    expect(new Set(fired.slice(3, 6)).size).toBe(3);
    for (let i = 1; i < fired.length; i++) expect(fired[i]).not.toBe(fired[i - 1]);
  });

  it("ignores triggers during the cooldown, then fires again", async () => {
    const { mpv, player } = await scareSetup();
    player.trigger("a");
    playScare(mpv);
    await flush();
    expect(player.trigger("b")).toMatchObject({ result: "ignored", reason: expect.stringMatching(/cooling down \(20 s/) });
    await vi.advanceTimersByTimeAsync(19_999);
    expect(player.trigger("b").result).toBe("ignored");
    await vi.advanceTimersByTimeAsync(1);
    expect(player.trigger("b").result).toBe("fired");
  });

  it("during a scare: ignore (default)", async () => {
    const { player } = await scareSetup();
    player.trigger("a");
    expect(player.trigger("b")).toMatchObject({ result: "ignored", reason: "a scare is playing" });
  });

  it("during a scare: queue one, fired when the cooldown ends", async () => {
    const { mpv, player, scares } = await scareSetup({ duringScare: "queue", cooldownMs: 5000 });
    player.trigger("a");
    expect(player.trigger("b")).toEqual({ result: "queued" });
    expect(player.trigger("c")).toEqual({ result: "queued" }); // still just one
    playScare(mpv);
    await flush();
    expect(player.status.queued).toBe(false);
    await vi.advanceTimersByTimeAsync(4999);
    expect(player.scareActive).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(player.scareActive).toBe(true);
    expect(scares).toEqual(["start", "end", "start"]);
  });

  it("ignores triggers when off, in loop mode, or before mpv is up", async () => {
    const off = setup({ mode: "scare" });
    off.mpv.up();
    expect(off.player.trigger("x")).toMatchObject({ result: "ignored", reason: "playback is off" });
    const loop = setup({ mode: "loop" });
    loop.mpv.up();
    loop.player.setOn(true);
    expect(loop.player.trigger("x")).toMatchObject({ result: "ignored", reason: "scare mode is off" });
    const early = setup({ mode: "scare" });
    early.player.setOn(true);
    expect(early.player.trigger("x")).toMatchObject({ result: "ignored", reason: "the player is starting" });
  });

  it("a scare clip that fails to load still returns to the buffer", async () => {
    const { mpv, player } = await scareSetup();
    player.trigger("a");
    mpv.event({ event: "end-file", reason: "error" });
    mpv.event({ event: "file-loaded" });
    await flush();
    expect(player.scareActive).toBe(false);
  });

  it("switching off during a scare ends it and clears the queue", async () => {
    const { player, scares } = await scareSetup({ duringScare: "queue" });
    player.trigger("a");
    player.trigger("b");
    player.setOn(false);
    expect(scares).toEqual(["start", "end"]);
    expect(player.status.queued).toBe(false);
  });

  it("measures the seams from mpv's events", async () => {
    let now = 1_000_000;
    const { mpv, player } = await scareSetup({}, { now: () => now });
    player.trigger("a");
    mpv.event({ event: "end-file", reason: "stop" });
    now += 120;
    mpv.event({ event: "playback-restart" });
    now += 5000;
    mpv.event({ event: "end-file", reason: "eof" });
    now += 80;
    mpv.event({ event: "file-loaded" });
    mpv.event({ event: "playback-restart" });
    expect(player.status.lastSeamMs).toEqual({ toScareMs: 120, toBufferMs: 80 });
  });
});

describe("mirror", () => {
  it("flips through IPC at once, with copy-back decoding, and restores", async () => {
    const { mpv, player, cmds, clear } = setup();
    mpv.up();
    await flush();
    clear();
    await player.setMirror(true);
    expect(cmds()).toEqual(["get_property hwdec", "set_property hwdec auto-copy", "vf add @mirror:hflip"]);
    clear();
    await player.setMirror(false);
    expect(cmds()).toEqual(["vf remove @mirror", "set_property hwdec auto-safe"]);
  });

  it("is applied whenever mpv (re)starts with the setting on", async () => {
    const { mpv, cmds } = setup({ mirror: true });
    mpv.up();
    await flush();
    expect(cmds()).toContain("vf add @mirror:hflip");
  });
});

describe("shutdown", () => {
  it("shuts mpv down", async () => {
    const { mpv, player } = setup();
    await player.shutdown();
    expect(mpv.shutdown).toHaveBeenCalled();
  });
});

describe("command ordering", () => {
  it("quick successive reloads never interleave their playlist edits", async () => {
    const { mpv, player, cmds } = setup({ mode: "scare" });
    let release;
    const gate = new Promise((r) => (release = r));
    const original = mpv.command.bind(mpv);
    let first = true;
    mpv.command = async (...args) => {
      if (first) {
        first = false;
        await gate; // the first command is slow
      }
      return original(...args);
    };
    mpv.up();
    player.setOn(true);
    player.reload();
    release();
    await flush();
    const loads = cmds().filter((c) => c.startsWith("loadfile"));
    expect(loads).toEqual([
      "loadfile /m/calm.mp4 replace",
      "loadfile /m/s1.mp4 append",
      "loadfile /m/calm.mp4 append",
      "loadfile /m/calm.mp4 replace",
      "loadfile /m/s1.mp4 append",
      "loadfile /m/calm.mp4 append",
    ]);
  });
});
