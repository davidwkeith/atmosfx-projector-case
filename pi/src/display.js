// Is the projector's HDMI input there? mpv's DRM output refuses a disconnected
// connector ("Chosen connector is disconnected") and plays the file without
// video; a looping file (the calm clip in scare mode) is never retried. A
// projector that powers up after the Pi (always, with a relay) only connects
// seconds after it is switched on, so playback waits for it, and starts again if
// the display turns up later.

import { EventEmitter } from "node:events";
import { readFile, readdir } from "node:fs/promises";

/**
 * true or false from /sys/class/drm/card*-<connector>/status, or null when unknown
 * (no such connector, not a Pi). With no connector chosen, any HDMI output counts.
 */
export async function displayConnected({ connector = "", dir = "/sys/class/drm", fs = { readdir, readFile } } = {}) {
  let names;
  try {
    names = await fs.readdir(dir);
  } catch {
    return null;
  }
  let known = false;
  for (const name of names) {
    if (connector ? !name.endsWith(`-${connector}`) : !/-HDMI-A-\d+$/.test(name)) continue;
    try {
      const status = (await fs.readFile(`${dir}/${name}/status`, "utf8")).trim();
      if (status === "connected") return true;
      known = true;
    } catch {
      // no status file: not a connector we can read
    }
  }
  return known ? false : null;
}

/** Emits "connected" when the display appears after being absent for a while. */
export class DisplayWatch extends EventEmitter {
  #probe;
  #pollMs;
  #minAbsentPolls;
  #sleep;
  #now;
  #absent = 0;
  #timer = null;

  /**
   * @param {object} o
   * @param {() => Promise<boolean|null>} o.probe
   * @param {number} [o.minAbsentPolls]  absent this many polls in a row before a
   *   reconnect counts (some projectors drop hot-plug detect for an instant)
   */
  constructor({ probe, pollMs = 2000, minAbsentPolls = 2, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), now = Date.now }) {
    super();
    this.#probe = probe;
    this.#pollMs = pollMs;
    this.#minAbsentPolls = minAbsentPolls;
    this.#sleep = sleep;
    this.#now = now;
  }

  start() {
    if (this.#timer) return;
    this.#timer = setInterval(() => this.poll().catch(() => {}), this.#pollMs);
    this.#timer.unref?.();
  }

  stop() {
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = null;
  }

  async poll() {
    const connected = await this.#probe();
    if (connected === false) {
      this.#absent++;
      return connected;
    }
    const wasAbsent = this.#absent >= this.#minAbsentPolls;
    this.#absent = 0;
    if (connected === true && wasAbsent) this.emit("connected");
    return connected;
  }

  /**
   * Before starting playback: true once connected, null if it can't be known,
   * false if still absent after maxMs (then "connected" fires when it shows up).
   */
  async wait(maxMs, stepMs = 500) {
    const deadline = this.#now() + maxMs;
    for (;;) {
      const connected = await this.#probe();
      if (connected !== false) {
        this.#absent = 0;
        return connected;
      }
      if (this.#now() >= deadline) {
        this.#absent = Math.max(this.#absent, this.#minAbsentPolls);
        return false;
      }
      await this.#sleep(stepMs);
    }
  }
}
