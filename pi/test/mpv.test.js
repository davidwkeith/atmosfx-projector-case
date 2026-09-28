import { EventEmitter } from "node:events";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MpvIpc, MpvSupervisor, checkMpvArgs } from "../src/mpv.js";

describe("mpv extra-args deny-list", () => {
  it.each([
    "",
    "--hwdec=v4l2m2m-copy",
    "--vf=crop=1920:800",
    "--drm-mode=1280x720",
    "--drm-device=/dev/dri/card1",
    "--profile=sw-fast",
    "--video-sync=display-resample --interpolation=no",
    "--audio-delay=-0.2 --volume=80",
    "--osd-level=0",
  ])("allows %j", (args) => expect(() => checkMpvArgs(args)).not.toThrow());

  it.each([
    "--input-ipc-server=/tmp/evil",
    "--input-ipc-client=fd://3",
    "--input-conf=/tmp/keys",
    "--script=/tmp/x.lua",
    "--scripts=/tmp/x.lua",
    "--script-opts=a=b",
    "--load-scripts=yes",
    "--config-dir=/tmp",
    "--include=/tmp/mpv.conf",
    "--ytdl=yes",
    "--ytdl-raw-options=x=y",
    "--http-header-fields=x",
    "--user-agent=x",
    "--log-file=/tmp/log",
    "--o=/tmp/out.mkv",
    "--screenshot-directory=/tmp",
    "--stream-record=/tmp/x",
    "--record-file=/tmp/x",
    "--lavfi-complex=[vid1]null[vo]",
    "--vf=lavfi=[movie=/etc/passwd]",
    "--demuxer-lavf-o=protocol_whitelist=http",
    "--external-files=/tmp/a.mp4",
    "--audio-files=/tmp/a.mp3",
    "--glsl-shaders=/tmp/s.glsl",
    "--idle=no",
    "--terminal=no",
    "--watch-later-dir=/tmp",
    "--playlist=/tmp/list.m3u",
    "--vf=hflip https://evil/x.mp4",
    "/tmp/evil.mp4",
    "-v",
  ])("refuses %j", (args) => expect(() => checkMpvArgs(args)).toThrow(/not allowed|not an --option/));

  it("refuses control characters, too many and too long", () => {
    expect(() => checkMpvArgs("--hwdec=no\n--input-ipc-server=x")).toThrow(/control/);
    expect(() => checkMpvArgs("--mute=no ".repeat(41))).toThrow(/too many/);
    expect(() => checkMpvArgs("--x=" + "y".repeat(500))).toThrow(/long/);
  });
});

describe("JSON IPC client (real Unix socket)", () => {
  let dir;
  let server;
  let path;
  let received;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "videofx-ipc-"));
    path = join(dir, "mpv.sock");
    received = [];
    server = createServer((sock) => {
      sock.setEncoding("utf8");
      let buf = "";
      sock.on("data", (d) => {
        buf += d;
        let nl;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const msg = JSON.parse(buf.slice(0, nl));
          buf = buf.slice(nl + 1);
          received.push(msg);
          // An event interleaved before the reply, split across writes.
          const event = JSON.stringify({ event: "file-loaded" }) + "\n";
          sock.write(event.slice(0, 5));
          sock.write(event.slice(5));
          const ok = msg.command[0] !== "bogus";
          sock.write(JSON.stringify({ request_id: msg.request_id, error: ok ? "success" : "invalid parameter", data: msg.command[0] === "get_property" ? "auto-safe" : null }) + "\n");
        }
      });
    });
    await new Promise((r, j) => {
      server.once("error", j);
      server.listen(path, r);
    });
  });
  afterEach(async () => {
    server.close();
    await rm(dir, { recursive: true, force: true });
  });

  it("sends commands with request ids, matches replies, and emits events", async () => {
    const ipc = await MpvIpc.connect(path);
    const events = [];
    ipc.on("event", (e) => events.push(e.event));
    expect(await ipc.command("get_property", "hwdec")).toBe("auto-safe");
    await ipc.command("loadfile", "/m/a b.mp4", "replace");
    await expect(ipc.command("bogus")).rejects.toThrow(/bogus: invalid parameter/);
    expect(received.map((m) => m.command)).toEqual([["get_property", "hwdec"], ["loadfile", "/m/a b.mp4", "replace"], ["bogus"]]);
    expect(new Set(received.map((m) => m.request_id)).size).toBe(3);
    expect(events).toEqual(["file-loaded", "file-loaded", "file-loaded"]);
    ipc.close();
  });

  it("rejects pending commands when mpv goes away", async () => {
    let peer;
    const silent = createServer((sock) => (peer = sock)); // never replies
    const p2 = join(dir, "silent.sock");
    await new Promise((r) => silent.listen(p2, r));
    const ipc = await MpvIpc.connect(p2);
    const closed = new Promise((r) => ipc.once("close", r));
    const pending = ipc.command("stop");
    await new Promise((r) => setTimeout(r, 20));
    peer.destroy();
    await expect(pending).rejects.toThrow(/closed/);
    await closed;
    silent.close();
  });
});

// Fake child process and IPC for the supervisor.
class FakeChild extends EventEmitter {
  signals = [];
  kill(signal) {
    this.signals.push(signal);
  }
  exit(code = 0, signal = null) {
    this.emit("exit", code, signal);
  }
}
class FakeIpc extends EventEmitter {
  commands = [];
  async command(...args) {
    this.commands.push(args);
    return null;
  }
  close() {
    this.emit("close");
  }
}

function supervisor(overrides = {}) {
  const children = [];
  const ipcs = [];
  const spawn = vi.fn(() => {
    const c = new FakeChild();
    children.push(c);
    return c;
  });
  const connect = vi.fn(async () => {
    const i = new FakeIpc();
    ipcs.push(i);
    return i;
  });
  const log = { info: vi.fn(), error: vi.fn(), warn: vi.fn() };
  const s = new MpvSupervisor({ spawn, connect, socket: "/run/x.sock", args: () => ["--idle=yes"], log, restartDelayMs: 1000, maxRestarts: 3, ...overrides });
  const events = { ready: vi.fn(), down: vi.fn(), failed: vi.fn() };
  for (const [k, f] of Object.entries(events)) s.on(k, f);
  return { s, spawn, connect, children, ipcs, events };
}

describe("mpv supervisor", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("starts mpv, connects to its socket and reports ready", async () => {
    const { s, spawn, events } = supervisor();
    s.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(spawn).toHaveBeenCalledWith("mpv", ["--idle=yes"], expect.any(Object));
    expect(events.ready).toHaveBeenCalledTimes(1);
    expect(s.ready).toBe(true);
  });

  it("retries the socket until mpv has created it", async () => {
    let tries = 0;
    const { s, events } = supervisor({
      connect: async () => {
        if (++tries < 4) throw new Error("ENOENT");
        return new FakeIpc();
      },
    });
    s.start();
    await vi.advanceTimersByTimeAsync(350);
    expect(tries).toBe(4);
    expect(events.ready).toHaveBeenCalled();
  });

  it("restarts mpv after a crash, and gives up after too many", async () => {
    const { s, children, events } = supervisor();
    s.start();
    await vi.advanceTimersByTimeAsync(0);
    for (let i = 0; i < 3; i++) {
      children.at(-1).exit(1);
      expect(events.down).toHaveBeenCalledTimes(i + 1);
      await vi.advanceTimersByTimeAsync(1000);
    }
    expect(children).toHaveLength(4);
    expect(events.ready).toHaveBeenCalledTimes(4);
    children.at(-1).exit(1);
    await vi.advanceTimersByTimeAsync(5000);
    expect(events.failed).toHaveBeenCalledTimes(1);
    expect(children).toHaveLength(4);
    s.start(); // a later power-on tries again
    await vi.advanceTimersByTimeAsync(0);
    expect(children).toHaveLength(5);
  });

  it("restart() relaunches at once with fresh args, without counting a crash", async () => {
    let n = 0;
    const { s, spawn, children, events } = supervisor({ args: () => [`--gen=${++n}`] });
    s.start();
    await vi.advanceTimersByTimeAsync(0);
    for (let i = 0; i < 6; i++) {
      s.restart();
      children.at(-1).exit(0, "SIGTERM");
      await vi.advanceTimersByTimeAsync(0);
    }
    expect(events.failed).not.toHaveBeenCalled();
    expect(spawn.mock.calls.at(-1)[1]).toEqual(["--gen=7"]);
  });

  it("kills mpv when the IPC connection drops, so it comes back controllable", async () => {
    const { s, children, ipcs } = supervisor();
    s.start();
    await vi.advanceTimersByTimeAsync(0);
    ipcs[0].close();
    expect(children[0].signals).toEqual(["SIGTERM"]);
    children[0].exit(0, "SIGTERM");
    await vi.advanceTimersByTimeAsync(1000);
    expect(children).toHaveLength(2);
  });

  it("shutdown sends quit, then SIGTERM, and does not restart", async () => {
    const { s, children, ipcs } = supervisor();
    s.start();
    await vi.advanceTimersByTimeAsync(0);
    const done = s.shutdown();
    expect(ipcs[0].commands).toEqual([["quit"]]);
    expect(children[0].signals).toEqual(["SIGTERM"]);
    children[0].exit(0);
    await done;
    await vi.advanceTimersByTimeAsync(5000);
    expect(children).toHaveLength(1);
  });

  it("command() fails cleanly while mpv is down", async () => {
    const { s } = supervisor();
    await expect(s.command("stop")).rejects.toThrow(/not running/);
  });
});
