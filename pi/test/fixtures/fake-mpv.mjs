#!/usr/bin/env node
// A stand-in for mpv's JSON IPC, for smoke tests on machines without mpv (or a
// display). It keeps a playlist, honours loop-file / loop-playlist, and emits
// start-file / file-loaded / playback-restart / end-file with small delays.
// Every "file" plays for FAKE_MPV_DURATION_MS (default 1500 ms).

import { readFileSync, unlinkSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, isAbsolute, join } from "node:path";

const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
const socket = arg("input-ipc-server");
const duration = Number(process.env.FAKE_MPV_DURATION_MS ?? 1500);
const props = { "loop-file": "no", "loop-playlist": "no", hwdec: arg("hwdec") ?? "auto-safe", brightness: 0 };
let vf = [];
let playlist = [];
let pos = -1;
let timer = null;
const clients = new Set();
const log = (...a) => console.log("fake-mpv:", ...a);

const emit = (event) => {
  const line = JSON.stringify(event) + "\n";
  for (const c of clients) c.write(line);
};

function start(i) {
  clearTimeout(timer);
  if (i < 0 || i >= playlist.length) {
    pos = -1;
    emit({ event: "idle" });
    return;
  }
  pos = i;
  emit({ event: "start-file", playlist_entry_id: i + 1 });
  setTimeout(() => {
    emit({ event: "file-loaded" });
    setTimeout(() => {
      emit({ event: "playback-restart" });
      log(`playing ${playlist[pos]}`);
      timer = setTimeout(eof, duration);
    }, 20);
  }, 30);
}

function eof() {
  if (props["loop-file"] === "inf") {
    emit({ event: "playback-restart" }); // mpv seeks back to the start
    timer = setTimeout(eof, duration);
    return;
  }
  emit({ event: "end-file", reason: "eof" });
  let next = pos + 1;
  if (next >= playlist.length && props["loop-playlist"] === "inf") next = 0;
  start(next);
}

function end(reason) {
  clearTimeout(timer);
  if (pos >= 0) emit({ event: "end-file", reason });
}

const commands = {
  loadfile(url, flag = "replace") {
    if (flag === "replace") {
      end("stop");
      playlist = [url];
      start(0);
    } else {
      playlist.push(url);
      if (pos < 0 && flag === "append-play") start(playlist.length - 1);
    }
  },
  loadlist(path) {
    const base = dirname(path);
    const files = readFileSync(path, "utf8")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"))
      .map((f) => (isAbsolute(f) ? f : join(base, f)));
    end("stop");
    playlist = files;
    start(0);
  },
  "playlist-next"() {
    end("stop");
    start(pos + 1);
  },
  "playlist-clear"() {
    playlist = pos >= 0 ? [playlist[pos]] : [];
    pos = pos >= 0 ? 0 : -1;
  },
  stop() {
    end("stop");
    playlist = [];
    pos = -1;
    emit({ event: "idle" });
  },
  set_property(name, value) {
    props[name] = String(value);
  },
  get_property(name) {
    if (name === "vf") return vf;
    return props[name];
  },
  vf(op, value) {
    if (op === "add") vf.push(value);
    if (op === "remove") vf = vf.filter((f) => !f.startsWith(value));
    log(`vf ${op} ${value} -> [${vf.join(", ")}]`);
  },
  quit() {
    setImmediate(() => process.exit(0));
  },
};

try {
  unlinkSync(socket);
} catch {
  // not there
}
createServer((c) => {
  clients.add(c);
  c.setEncoding("utf8");
  let buf = "";
  c.on("data", (d) => {
    buf += d;
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const msg = JSON.parse(buf.slice(0, nl));
      buf = buf.slice(nl + 1);
      const [name, ...args] = msg.command;
      let reply = { request_id: msg.request_id, error: "success", data: null };
      try {
        if (!commands[name]) throw new Error("invalid parameter");
        reply.data = commands[name](...args) ?? null;
      } catch (err) {
        reply = { request_id: msg.request_id, error: err.message };
      }
      c.write(JSON.stringify(reply) + "\n");
    }
  });
  c.on("close", () => clients.delete(c));
}).listen(socket, () => log(`listening on ${socket}`));
process.on("SIGTERM", () => process.exit(0));
