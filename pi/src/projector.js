// Projector power, following the main on/off:
//   relay    - a relay in the projector's DC + line: ON closes it and waits a settle
//              time (for projectors that power up by themselves); OFF opens it.
//   relay-ir - relay, then the IR power code (twice if the projector needs two
//              presses). The relay forces a known "off", so the IR toggle can't
//              get out of step.
//   cec      - HDMI-CEC with cec-ctl (v4l-utils) on /dev/cecN (kernel CEC under KMS,
//              no libcec daemon): wake = Image View On + Text View On + Active
//              Source (One Touch Play); off = Standby. Falls back to hdmi-off if the
//              projector never answers.
//   hdmi-off - no CEC: power the HDMI signal down (fbdev blank) so the projector
//              sees "no signal" and, on many models, goes to standby by itself.
//   none     - leave the projector alone.
// CEC is only used on power changes (plus one retry), never on status polls.

import { EventEmitter } from "node:events";

export const PROJECTOR_MODES = ["cec", "relay-ir", "relay", "hdmi-off", "none"];

/** "pwr-state: on (0x00)" -> "on"; undefined when the projector didn't answer. */
export function parsePowerStatus(output) {
  const m = /pwr-state:\s*([a-z-]+)/i.exec(output ?? "");
  return m ? m[1].toLowerCase() : undefined;
}

/** "Physical Address : 1.0.0.0" -> "1.0.0.0" (f.f.f.f means no HDMI sink / no EDID). */
export function parsePhysicalAddress(output) {
  const m = /Physical Address\s*:\s*([0-9a-f]\.[0-9a-f]\.[0-9a-f]\.[0-9a-f])/i.exec(output ?? "");
  return m && m[1].toLowerCase() !== "f.f.f.f" ? m[1] : null;
}

export class Projector extends EventEmitter {
  #run;
  #mode;
  #device;
  #osdName;
  #blank;
  #log;
  #setTimer;
  #clearTimer;
  #retryDelayMs;
  #relay;
  #ir;
  #settleMs;
  #irCode;
  #doublePress;
  #pressGapMs;
  #sleep;
  #configured = false;
  #relayClosed = false;
  #physAddr = null;
  #retry = null;
  #state = { cec: "unknown", power: "unknown", notice: null };

  /**
   * @param {object} o
   * @param {(cmd: string, args: string[]) => Promise<{stdout: string}>} o.run  execFile-like; rejects on failure
   * @param {() => string} o.mode      setting: cec | hdmi-off | none
   * @param {() => string} o.device    e.g. /dev/cec0
   * @param {string} o.osdName         name shown by the projector, 14 characters max
   * @param {(powerDown: boolean) => Promise<void>} o.blank  fbdev blank / unblank
   * @param {{set: (closed: boolean) => Promise<void>}} [o.relay]  relay output (true = closed)
   * @param {{send: (code: string) => Promise<void>}} [o.ir]
   * @param {() => number} [o.settleMs]      relay settle time before IR / playback
   * @param {() => string} [o.irCode]        IR power code
   * @param {() => boolean} [o.doublePress]  send the power code twice
   */
  constructor(o) {
    super();
    this.#run = o.run;
    this.#mode = o.mode;
    this.#device = o.device;
    this.#osdName = (o.osdName ?? "VideoFX").slice(0, 14);
    this.#blank = o.blank ?? (async () => {});
    this.#log = o.log ?? console;
    this.#setTimer = o.setTimeout ?? setTimeout;
    this.#clearTimer = o.clearTimeout ?? clearTimeout;
    this.#retryDelayMs = o.retryDelayMs ?? 8000;
    this.#relay = o.relay;
    this.#ir = o.ir;
    this.#settleMs = o.settleMs ?? (() => 3000);
    this.#irCode = o.irCode ?? (() => "");
    this.#doublePress = o.doublePress ?? (() => false);
    this.#pressGapMs = o.pressGapMs ?? 1500;
    this.#sleep = o.sleep ?? ((ms) => new Promise((r) => this.#setTimer(r, ms)));
  }

  #usesRelay() {
    return this.#mode() === "relay" || this.#mode() === "relay-ir";
  }

  /** At startup: a relay stays open (projector off) until the service decides. */
  async init() {
    if (this.#usesRelay()) await this.#setRelay(false);
  }

  /**
   * The service is stopping: nothing will watch the temperature, so a
   * relay-switched projector goes off (the GPIO keeps its level after we exit).
   */
  async shutdown() {
    this.#cancelRetry();
    if (this.#usesRelay()) await this.#setRelay(false);
  }

  async #setRelay(closed) {
    try {
      await this.#relay.set(closed);
      this.#relayClosed = closed;
      this.#set({ power: closed ? "on" : "off" });
      return true;
    } catch (err) {
      this.#log.error(`Projector relay: ${err.message}`);
      this.#set({ notice: `Relay: ${err.message}` });
      return false;
    }
  }

  async #relayOn() {
    // Already powered (a second "on" from the schedule, the page, DMX...): the IR
    // power code is a toggle, so pressing it again would switch the projector off.
    if (this.#relayClosed) return;
    if (!(await this.#setRelay(true))) return;
    await this.#sleep(this.#settleMs());
    if (this.#mode() !== "relay-ir") return;
    const code = this.#irCode();
    if (!code) {
      this.#set({ notice: "relay-ir: no IR power code set; learn or paste one in Settings" });
      return;
    }
    try {
      await this.#ir.send(code);
      if (this.#doublePress()) {
        await this.#sleep(this.#pressGapMs);
        await this.#ir.send(code);
      }
      this.#set({ notice: null });
    } catch (err) {
      this.#log.error(`Projector IR: ${err.message}`);
      this.#set({ notice: `IR: ${err.message}` });
    }
  }

  get state() {
    return { ...this.#state, mode: this.#mode(), effective: this.#effective() };
  }

  /** Mode actually used: cec falls back to hdmi-off when the projector never answered. */
  #effective() {
    const mode = this.#mode();
    return mode === "cec" && this.#state.cec === "no-response" ? "hdmi-off" : mode;
  }

  /** Setting or device changed: forget what we learned about CEC. */
  reset() {
    this.#cancelRetry();
    this.#configured = false;
    this.#state = { cec: "unknown", power: "unknown", notice: null };
  }

  async on() {
    this.#cancelRetry();
    try {
      await this.#blank(false); // signal back on in every mode
    } catch (err) {
      this.#log.warn(`Projector: unblank: ${err.message}`);
    }
    if (this.#usesRelay()) {
      await this.#relayOn();
      return this.state;
    }
    // In cec mode, try CEC on every power-on (it's one burst of messages), so a
    // projector that was unplugged last time is picked up again.
    if (this.#mode() !== "cec") {
      this.#set({ power: this.#mode() === "none" ? "unknown" : "signal-on" });
      return this.state;
    }
    await this.#wake(true);
    return this.state;
  }

  /** keepSignal: leave HDMI on in hdmi-off mode (e.g. to show the pairing code). */
  async off({ keepSignal = false } = {}) {
    this.#cancelRetry();
    const mode = this.#effective();
    if (this.#usesRelay()) {
      await this.#setRelay(false);
    } else if (mode === "cec") {
      if ((await this.#cec(["--to", "0", "--standby"])) !== null) this.#set({ power: "standby" });
    } else if (mode === "hdmi-off" && !keepSignal) {
      try {
        await this.#blank(true);
        this.#set({ power: "no-signal" });
      } catch (err) {
        this.#log.warn(`Projector: blank: ${err.message}`);
      }
    }
    return this.state;
  }

  async #wake(retryAllowed) {
    if (!(await this.#configure())) return this.#noResponse("the Pi has no CEC device or no HDMI connection");
    await this.#cec(["--to", "0", "--image-view-on"]);
    await this.#cec(["--to", "0", "--text-view-on"]);
    // Active Source is a broadcast message (CEC 1.4, 13.1): a TV may ignore a directed one.
    if (this.#physAddr) await this.#cec(["--to", "15", "--active-source", `phys-addr=${this.#physAddr}`]);
    const out = await this.#cec(["--to", "0", "--give-device-power-status"]);
    const power = parsePowerStatus(out);
    if (!power) return this.#noResponse("the projector did not answer CEC");
    this.#set({ cec: "supported", power, notice: null });
    if (power !== "on" && retryAllowed) {
      // Waking up ("to-on") or ignored the first request: try once more, later.
      this.#retry = this.#setTimer(() => {
        this.#retry = null;
        this.#wake(false).catch((err) => this.#log.warn(`Projector: ${err.message}`));
      }, this.#retryDelayMs);
    }
  }

  async #noResponse(why) {
    const fallback = this.#mode() === "cec";
    this.#set({
      cec: "no-response",
      power: "unknown",
      notice: fallback ? `CEC: ${why}. Using "hdmi-off" instead: the projector may need its remote to wake up.` : null,
    });
    this.#log.warn(`Projector: ${why}${fallback ? "; falling back to hdmi-off" : ""}`);
    try {
      await this.#blank(false);
    } catch {
      // ignore
    }
  }

  async #configure() {
    if (this.#configured) return true;
    const out = await this.#cec(["--playback", "--osd-name", this.#osdName]);
    if (out === null) return false;
    this.#physAddr = parsePhysicalAddress(out);
    // No physical address yet (the projector was off or unplugged, so no EDID):
    // configure again next time instead of never sending Active Source.
    this.#configured = this.#physAddr !== null;
    return true;
  }

  // cec-ctl -d <dev> ...; returns stdout, or null if cec-ctl failed.
  async #cec(args) {
    try {
      const { stdout } = await this.#run("cec-ctl", ["-d", this.#device(), ...args]);
      return stdout ?? "";
    } catch (err) {
      this.#log.warn(`cec-ctl ${args.join(" ")}: ${err.message}`);
      return null;
    }
  }

  #set(patch) {
    this.#state = { ...this.#state, ...patch };
    this.emit("change", this.state);
  }

  #cancelRetry() {
    if (this.#retry) this.#clearTimer(this.#retry);
    this.#retry = null;
  }
}
