// Playback controller on top of one long-lived mpv (see mpv.js).
//
// Power on:  loop mode  -> loadlist playlist, loop-playlist=inf
//            scare mode -> buffer clip with loop-file=inf; the next scare clip and
//                          the buffer again are queued behind it so mpv prefetches them.
// Trigger:   loop-file=no + playlist-next -> the scare plays once, then mpv moves
//            on to the queued buffer by itself; we re-arm when it has loaded.
// Power off: stop (mpv idles and releases the screen), then blank the console.
//
// Side effects are injected (mpv, store, timers) so it can be tested without mpv.

import { EventEmitter } from "node:events";

export const RESTORE_POLICIES = ["last", "on", "off"];

export class Player extends EventEmitter {
  #mpv;
  #content;
  #store;
  #blank;
  #preflight;
  #log;
  #now;
  #setTimer;
  #clearTimer;
  #random;

  #on = false;
  #phase = "idle"; // idle | loop | clip | buffer | scare | returning
  #order = []; // scare clips in play order
  #orderPos = 0;
  #nextScare = null;
  #queued = false;
  #queueTimer = null;
  #cooldownUntil = 0;
  #argsPending = false;
  #mirrored = false;
  #hwdecBeforeMirror = null;
  #seam = { toScareMs: null, toBufferMs: null };
  #mark = null; // { kind, at } while measuring a seam
  #clip = null; // DMX clip select: absolute path looped instead of the normal content
  #dimmer = 255;

  /**
   * @param {object} o
   * @param {import("./mpv.js").MpvSupervisor} o.mpv   anything with ready, command(), and ready/down/event/failed events
   * @param {() => {mode: string, playlist: string, buffer: string, scares: string[], order: string,
   *   cooldownMs: number, duringScare: string, mirror: boolean}} o.content  current settings, absolute paths
   * @param {{load: () => boolean|undefined, save: (on: boolean) => void}} [o.store]
   * @param {() => void} [o.blank]
   * @param {(content) => string|undefined} [o.preflight]
   */
  constructor(o) {
    super();
    this.#mpv = o.mpv;
    this.#content = o.content;
    this.#store = o.store ?? { load: () => undefined, save: () => {} };
    this.#blank = o.blank ?? (() => {});
    this.#preflight = o.preflight ?? (() => undefined);
    this.#log = o.log ?? console;
    this.#now = o.now ?? Date.now;
    this.#setTimer = o.setTimeout ?? setTimeout;
    this.#clearTimer = o.clearTimeout ?? clearTimeout;
    this.#random = o.random ?? Math.random;

    this.#mpv.on("ready", () => this.#onReady());
    this.#mpv.on("down", () => {
      this.#phase = "idle";
      this.#mirrored = false;
    });
    this.#mpv.on("event", (e) => this.#onEvent(e));
    this.#mpv.on("failed", (why) => {
      if (!this.#on) return;
      this.#on = false;
      this.#store.save(false);
      this.#blank();
      this.emit("failed", why);
    });
  }

  get isOn() {
    return this.#on;
  }

  get isPlaying() {
    return this.#on && this.#mpv.ready && this.#phase !== "idle";
  }

  get scareActive() {
    return this.#phase === "scare" || this.#phase === "returning";
  }

  get status() {
    const c = this.#content();
    return {
      mode: c.mode,
      phase: this.#phase,
      scareActive: this.scareActive,
      nextScare: c.mode === "scare" ? this.#nextScare : null,
      cooldownLeftMs: Math.max(0, this.#cooldownUntil - this.#now()),
      queued: this.#queued,
      lastSeamMs: { ...this.#seam },
    };
  }

  /** The state to apply at boot for a restore policy ("last" | "on" | "off"). */
  initialState(policy) {
    if (policy === "on") return true;
    if (policy === "off") return false;
    return this.#store.load() === true;
  }

  /** Switch playback on or off. Idempotent. Returns the resulting state. */
  setOn(on) {
    if (on === this.#on) return on;
    if (on) {
      const problem = this.#preflight(this.#content());
      if (problem) {
        this.#log.error(`Cannot play: ${problem}`);
        this.#store.save(false);
        this.emit("failed", problem);
        return false;
      }
      this.#on = true;
      this.#store.save(true);
      if (this.#argsPending) {
        // Audio device / connector / extra args changed: new mpv, then #onReady plays.
        this.#argsPending = false;
        this.#mpv.restart();
      } else if (this.#mpv.ready) {
        this.#play();
      }
      return true;
    }
    this.#on = false;
    this.#store.save(false);
    this.#stop();
    return false;
  }

  /** Content changed (playlist saved, mode or clips changed): apply it now if playing. */
  reload() {
    if (this.#on && this.#mpv.ready) this.#play();
  }

  /** DMX clip select: a file to loop instead of the normal content (null = normal). */
  setClip(path) {
    if (path === this.#clip) return;
    this.#clip = path;
    if (this.#on && this.#mpv.ready) this.#play();
  }

  /** Video dimmer 0-255 (255 = normal) through mpv's brightness (-100..0). */
  setDimmer(level) {
    this.#dimmer = level;
    if (this.#mpv.ready) this.#run(["set_property", "brightness", Math.round((level / 255) * 100) - 100]);
  }

  /** mpv's command line changed: restart it now if idle, else before the next play. */
  argsChanged() {
    if (this.#on) this.#argsPending = true;
    else this.#mpv.restart();
  }

  /** Mirror (horizontal flip) at once, through IPC. */
  async setMirror(on) {
    if (!this.#mpv.ready || on === this.#mirrored) return;
    try {
      if (on) {
        // hflip runs on the CPU: hardware decoding must copy frames back to RAM.
        this.#hwdecBeforeMirror = await this.#mpv.command("get_property", "hwdec").catch(() => "auto-safe");
        await this.#mpv.command("set_property", "hwdec", "auto-copy");
        await this.#mpv.command("vf", "add", "@mirror:hflip");
      } else {
        await this.#mpv.command("vf", "remove", "@mirror");
        await this.#mpv.command("set_property", "hwdec", this.#hwdecBeforeMirror ?? "auto-safe");
      }
      this.#mirrored = on;
    } catch (err) {
      this.#log.error(`Mirror: ${err.message}`);
    }
  }

  /**
   * Fire a scare. Returns { result: "fired" | "queued" | "ignored", reason?, clip? }.
   */
  trigger(source = "unknown") {
    const c = this.#content();
    const ignore = (reason) => {
      this.#log.info(`Scare from ${source} ignored: ${reason}`);
      return { result: "ignored", reason };
    };
    if (!this.#on) return ignore("playback is off");
    if (c.mode !== "scare") return ignore("scare mode is off");
    if (!this.#mpv.ready || this.#phase === "idle") return ignore("the player is starting");
    if (this.#phase === "clip") return ignore("a DMX clip is selected");
    if (this.scareActive) {
      if (c.duringScare === "queue") {
        this.#queued = true;
        return { result: "queued" };
      }
      return ignore("a scare is playing");
    }
    const wait = this.#cooldownUntil - this.#now();
    if (wait > 0 && source !== "queue") return ignore(`cooling down (${Math.ceil(wait / 1000)} s left)`);

    const clip = this.#nextScare;
    this.#phase = "scare";
    this.#mark = { kind: "toScareMs", at: this.#now() };
    this.#log.info(`Scare from ${source}: ${clip}`);
    this.emit("scare", { state: "start", clip, source });
    this.#run(["set_property", "loop-file", "no"], ["playlist-next", "force"]);
    return { result: "fired", clip };
  }

  async shutdown() {
    this.#clearQueue();
    await this.#mpv.shutdown?.();
  }

  // --- internals

  #onReady() {
    const c = this.#content();
    if (c.mirror) this.setMirror(true);
    if (this.#dimmer !== 255) this.setDimmer(this.#dimmer);
    if (this.#on) this.#play();
  }

  #play() {
    const c = this.#content();
    this.#clearQueue();
    if (this.#clip) {
      this.#phase = "clip";
      this.#run(["set_property", "loop-playlist", "no"], ["set_property", "loop-file", "inf"], ["loadfile", this.#clip, "replace"]);
    } else if (c.mode === "scare") {
      this.#phase = "buffer";
      this.#pickOrder(c);
      this.#run(
        ["set_property", "loop-playlist", "no"],
        ["set_property", "loop-file", "inf"],
        ["loadfile", c.buffer, "replace"],
        ...this.#armCommands(c),
      );
    } else {
      this.#phase = "loop";
      this.#run(
        ["set_property", "loop-file", "no"],
        ["set_property", "loop-playlist", "inf"],
        ["loadlist", c.playlist, "replace"],
      );
    }
  }

  // Queue the next scare and the buffer after it, so mpv can prefetch both.
  #armCommands(c) {
    this.#nextScare = this.#takeScare(c);
    return [
      ["loadfile", this.#nextScare, "append"],
      ["loadfile", c.buffer, "append"],
    ];
  }

  #pickOrder(c) {
    const clips = [...(c.scares ?? [])];
    if (c.order === "random") {
      for (let i = clips.length - 1; i > 0; i--) {
        const j = Math.floor(this.#random() * (i + 1));
        [clips[i], clips[j]] = [clips[j], clips[i]];
      }
      // Don't repeat the clip that just played at the start of a new round.
      if (clips.length > 1 && clips[0] === this.#nextScare) clips.push(clips.shift());
    }
    this.#order = clips;
    this.#orderPos = 0;
  }

  #takeScare(c) {
    if (this.#orderPos >= this.#order.length) this.#pickOrder(c);
    return this.#order[this.#orderPos++];
  }

  #onEvent(e) {
    if (e.event === "playback-restart" && this.#mark) {
      const ms = this.#now() - this.#mark.at;
      this.#seam[this.#mark.kind] = ms;
      this.#log.info(`seam ${this.#mark.kind === "toScareMs" ? "buffer->scare" : "scare->buffer"}: ${ms} ms`);
      this.#mark = null;
      return;
    }
    if (e.event === "end-file" && this.#phase === "scare" && (e.reason === "eof" || e.reason === "error")) {
      this.#phase = "returning";
      this.#mark = { kind: "toBufferMs", at: this.#now() };
      return;
    }
    if (e.event === "file-loaded" && this.#phase === "returning") {
      const c = this.#content();
      this.#phase = "buffer";
      this.#cooldownUntil = this.#now() + c.cooldownMs;
      this.#run(["set_property", "loop-file", "inf"], ["playlist-clear"], ...this.#armCommands(c));
      this.emit("scare", { state: "end" });
      if (this.#queued) {
        this.#queued = false;
        this.#queueTimer = this.#setTimer(() => {
          this.#queueTimer = null;
          this.trigger("queue");
        }, Math.max(0, c.cooldownMs));
      }
    }
  }

  #stop() {
    const wasScare = this.scareActive;
    this.#phase = "idle";
    this.#clearQueue();
    if (wasScare) this.emit("scare", { state: "end" });
    if (this.#mpv.ready) this.#run(["stop"]);
    this.#blank();
  }

  #clearQueue() {
    this.#queued = false;
    this.#mark = null;
    if (this.#queueTimer) this.#clearTimer(this.#queueTimer);
    this.#queueTimer = null;
  }

  // Send commands in order; log (don't throw) failures.
  #run(...commands) {
    return commands
      .reduce((p, cmd) => p.then(() => this.#mpv.command(...cmd)), Promise.resolve())
      .catch((err) => this.#log.error(`mpv: ${err.message}`));
  }
}
