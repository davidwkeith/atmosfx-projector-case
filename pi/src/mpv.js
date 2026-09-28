// One long-lived mpv, driven over its JSON IPC socket (--input-ipc-server).
// Switching videos is a playlist command, not a process restart, so there is no
// black gap between files. The supervisor restarts mpv if it crashes.
// Option names checked against the mpv 0.40 manual (DOCS/man/*.rst).

import { EventEmitter } from "node:events";
import { createConnection } from "node:net";

const words = (s) => (s ?? "").split(/\s+/).filter(Boolean);

// Extra-args deny-list: nothing that adds a control channel, runs scripts, loads
// config or code, reads/writes arbitrary files, or reaches the network.
const MPV_DENY = [
  /^--(no-)?(input|idle|terminal|config|include|script|scripts|load|ytdl|http|tls|cookies|user-agent|referrer|rtsp|watch-later|log-file|dump|stream-dump|stream-record|record-file|screenshot|o|of|ofopts|ovc|ovcopts|oac|oacopts|lavfi-complex|external-file|audio-file|sub-file|cover-art-file|glsl-shader|use-filedir-conf|reset-on-next-file|player-operation-mode|save-position-on-quit|resume-playback|playlist)(s?)(\b|-|=|$)/,
  /^--(demuxer|stream)-lavf-o/, // raw FFmpeg options (protocol whitelists)
  /(^|[[:,;=])a?movie=/, // lavfi movie sources open files/URLs
  /:\/\//, // URLs
];

export function checkMpvArgs(input) {
  if (typeof input !== "string") throw new Error("must be text");
  if (input.length > 500) throw new Error("is too long (500 characters max)");
  if (/[\x00-\x1f\x7f]/.test(input)) throw new Error("must not contain control characters");
  const tokens = words(input);
  if (tokens.length > 40) throw new Error("has too many arguments (40 max)");
  for (const t of tokens) {
    // Options must be --name or --name=value; anything else would be a file to play.
    if (!/^--[a-z0-9]/.test(t)) throw new Error(`"${t}" is not an --option (only --name or --name=value)`);
    if (MPV_DENY.some((re) => re.test(t))) {
      throw new Error(`"${t}" is not allowed (IPC, scripting, config, file and network options are blocked)`);
    }
  }
  return tokens.join(" ");
}

/** mpv command line. Later options win, so the extra args can override the defaults. */
export function mpvArgs(values, socket) {
  return [
    `--input-ipc-server=${socket}`,
    "--idle=yes",
    "--no-config", // ignore ~/.config/mpv: behave the same on every Pi
    "--load-scripts=no", // no OSC, no auto-loaded scripts
    "--no-input-default-bindings",
    "--input-terminal=no",
    "--terminal=yes",
    "--msg-level=all=warn",
    "--vo=gpu",
    "--gpu-context=drm", // DRM/KMS, no desktop
    "--hwdec=auto-safe",
    "--fullscreen",
    "--osd-level=0",
    "--sid=no",
    "--cursor-autohide=always",
    "--prefetch-playlist=yes", // open the next file early: tighter seams
    "--gapless-audio=weak",
    ...(values.videoOutput ? [`--drm-connector=${values.videoOutput}`] : []),
    ...(values.audioCard ? [`--audio-device=alsa/plughw:CARD=${values.audioCard},DEV=0`] : []),
    ...words(values.mpvExtraArgs),
  ];
}

/** JSON IPC client: newline-delimited JSON, replies matched by request_id. */
export class MpvIpc extends EventEmitter {
  #socket;
  #buffer = "";
  #next = 1;
  #pending = new Map();
  #timeoutMs;

  static connect(path, { timeoutMs = 5000, connectFn = createConnection } = {}) {
    return new Promise((resolve, reject) => {
      const socket = connectFn(path);
      socket.once("error", reject);
      socket.once("connect", () => {
        socket.off("error", reject);
        resolve(new MpvIpc(socket, { timeoutMs }));
      });
    });
  }

  constructor(socket, { timeoutMs = 5000 } = {}) {
    super();
    this.#socket = socket;
    this.#timeoutMs = timeoutMs;
    socket.setEncoding?.("utf8");
    socket.on("data", (chunk) => this.#onData(chunk));
    socket.on("error", () => {}); // "close" follows
    socket.on("close", () => {
      for (const { reject, timer } of this.#pending.values()) {
        clearTimeout(timer);
        reject(new Error("mpv IPC closed"));
      }
      this.#pending.clear();
      this.emit("close");
    });
  }

  command(...args) {
    const id = this.#next++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new Error(`mpv ${args[0]}: no reply`));
      }, this.#timeoutMs);
      timer.unref?.();
      this.#pending.set(id, { resolve, reject, timer, name: args[0] });
      this.#socket.write(JSON.stringify({ command: args, request_id: id }) + "\n");
    });
  }

  close() {
    this.#socket.destroy();
  }

  #onData(chunk) {
    this.#buffer += chunk;
    let nl;
    while ((nl = this.#buffer.indexOf("\n")) >= 0) {
      const line = this.#buffer.slice(0, nl).trim();
      this.#buffer = this.#buffer.slice(nl + 1);
      if (!line) continue;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        continue; // mpv may send broken UTF-8 in corner cases
      }
      if (msg.event) {
        this.emit("event", msg);
      } else if (msg.request_id !== undefined && this.#pending.has(msg.request_id)) {
        const { resolve, reject, timer, name } = this.#pending.get(msg.request_id);
        this.#pending.delete(msg.request_id);
        clearTimeout(timer);
        if (msg.error === "success") resolve(msg.data);
        else reject(new Error(`mpv ${name}: ${msg.error}`));
      }
    }
  }
}

/**
 * Keeps one mpv running. Events: "ready" (IPC connected), "down" (IPC lost),
 * "event" (mpv events), "failed" (gave up after repeated crashes).
 */
export class MpvSupervisor extends EventEmitter {
  #spawn;
  #connect;
  #command;
  #args;
  #socket;
  #log;
  #now;
  #setTimer;
  #clearTimer;
  #restartDelayMs;
  #maxRestarts;
  #restartWindowMs;
  #killTimeoutMs;
  #connectTimeoutMs;

  #child = null;
  #ipc = null;
  #exited = new WeakSet();
  #crashes = [];
  #restartTimer = null;
  #restartRequested = false;
  #stopping = false;

  constructor(opts) {
    super();
    this.#spawn = opts.spawn;
    this.#connect = opts.connect ?? ((path) => MpvIpc.connect(path));
    this.#command = opts.command ?? "mpv";
    this.#args = typeof opts.args === "function" ? opts.args : () => opts.args ?? [];
    this.#socket = opts.socket;
    this.#log = opts.log ?? console;
    this.#now = opts.now ?? Date.now;
    this.#setTimer = opts.setTimeout ?? setTimeout;
    this.#clearTimer = opts.clearTimeout ?? clearTimeout;
    this.#restartDelayMs = opts.restartDelayMs ?? 2000;
    this.#maxRestarts = opts.maxRestarts ?? 5;
    this.#restartWindowMs = opts.restartWindowMs ?? 60_000;
    this.#killTimeoutMs = opts.killTimeoutMs ?? 3000;
    this.#connectTimeoutMs = opts.connectTimeoutMs ?? 5000;
  }

  get ready() {
    return this.#ipc !== null;
  }

  get running() {
    return this.#child !== null;
  }

  start() {
    this.#stopping = false;
    this.#crashes = [];
    if (!this.#child && !this.#restartTimer) this.#launch();
  }

  /** Restart with fresh arguments (settings changed). */
  restart() {
    if (!this.#child) return this.start();
    this.#restartRequested = true;
    this.#kill(this.#child);
  }

  command(...args) {
    if (!this.#ipc) return Promise.reject(new Error("mpv is not running"));
    return this.#ipc.command(...args);
  }

  async shutdown() {
    this.#stopping = true;
    if (this.#restartTimer) this.#clearTimer(this.#restartTimer);
    this.#restartTimer = null;
    const child = this.#child;
    if (!child || this.#exited.has(child)) return;
    const done = new Promise((resolve) => child.once("exit", resolve));
    this.#ipc?.command("quit").catch(() => {});
    this.#kill(child);
    await done;
  }

  #launch() {
    const args = this.#args();
    this.#log.info(`Starting ${this.#command} ${args.join(" ")}`);
    const child = this.#spawn(this.#command, args, { stdio: ["ignore", "inherit", "inherit"] });
    this.#child = child;
    child.once("error", (err) => {
      this.#log.error(`${this.#command}: ${err.message}`);
      this.#onExit(child);
    });
    child.once("exit", (code, signal) => {
      this.#log.info(`${this.#command} exited (code ${code}, signal ${signal})`);
      this.#onExit(child);
    });
    this.#connectLoop(child);
  }

  async #connectLoop(child) {
    const deadline = this.#now() + this.#connectTimeoutMs;
    for (;;) {
      if (child !== this.#child || this.#exited.has(child)) return;
      try {
        const ipc = await this.#connect(this.#socket);
        if (child !== this.#child || this.#exited.has(child)) return ipc.close();
        this.#ipc = ipc;
        ipc.on("event", (e) => this.emit("event", e));
        ipc.once("close", () => {
          if (this.#ipc !== ipc) return;
          this.#ipc = null;
          this.emit("down");
          // IPC gone but mpv still running: restart it to get control back.
          if (child === this.#child && !this.#exited.has(child) && !this.#stopping) this.#kill(child);
        });
        this.emit("ready");
        return;
      } catch {
        if (this.#now() >= deadline) {
          this.#log.error(`No IPC socket from ${this.#command} at ${this.#socket}`);
          return this.#kill(child);
        }
        await new Promise((r) => this.#setTimer(r, 100));
      }
    }
  }

  #onExit(child) {
    if (this.#exited.has(child)) return;
    this.#exited.add(child);
    if (this.#child === child) this.#child = null;
    if (this.#ipc) {
      const ipc = this.#ipc;
      this.#ipc = null;
      ipc.close();
      this.emit("down");
    }
    if (this.#stopping) return;
    if (this.#restartRequested) {
      this.#restartRequested = false;
      return this.#launch();
    }
    const now = this.#now();
    this.#crashes = this.#crashes.filter((t) => now - t < this.#restartWindowMs);
    this.#crashes.push(now);
    if (this.#crashes.length > this.#maxRestarts) {
      this.#log.error(`${this.#command} crashed ${this.#crashes.length} times in ${this.#restartWindowMs} ms; giving up`);
      this.emit("failed", "the video player keeps crashing");
      return;
    }
    this.#restartTimer = this.#setTimer(() => {
      this.#restartTimer = null;
      if (!this.#child && !this.#stopping) this.#launch();
    }, this.#restartDelayMs);
  }

  #kill(child) {
    child.kill("SIGTERM");
    const timer = this.#setTimer(() => {
      if (!this.#exited.has(child)) child.kill("SIGKILL");
    }, this.#killTimeoutMs);
    timer?.unref?.();
  }
}
