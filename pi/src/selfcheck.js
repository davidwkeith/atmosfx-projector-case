// Setup checks: what a builder would otherwise work through by hand in
// docs/BRINGUP.md, shown as a list on the dashboard. They run once at start-up and
// again from the page's "Run checks" button.
//
// main.js gathers the facts (files, commands, live state); everything here is a
// pure function of them, so the tests need no Pi. A fact that cannot be read is
// "unknown", never "fail": a missing tool says nothing about the hardware.
//
// Status: pass | fail | off (not used or not fitted) | unknown (can't tell yet).

import { EventEmitter } from "node:events";
import { throttleNames } from "./healthlog.js";
import { missingCardMessage } from "./volume.js";

/** "Raspberry Pi 4 Model B Rev 1.4\0" -> { model, board: "pi4" }; board is null off a Pi. */
export function parseBoardModel(text) {
  const model = String(text ?? "").replace(/\0/g, "").trim() || null;
  if (!model) return { model: null, board: null };
  const gen = /Raspberry Pi (?:Compute Module )?([345])\b/i.exec(model)?.[1];
  const board = /Zero 2/i.test(model) ? "zero2w" : gen ? `pi${gen}` : null;
  return { model, board };
}

const EDID_HEADER = [0x00, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x00];

/**
 * The display's name and preferred mode from its EDID base block (VESA E-EDID 1.4):
 * manufacturer ID (bytes 8-9), first detailed timing (preferred mode) and the
 * monitor name descriptor (tag 0xFC). Null when there is no valid EDID.
 * @returns {{ maker: string, name: string|null, width: number, height: number, hz: number|null } | null}
 */
export function parseEdid(buf) {
  if (!buf || buf.length < 128 || EDID_HEADER.some((b, i) => buf[i] !== b)) return null;
  const id = (buf[8] << 8) | buf[9];
  const maker = [10, 5, 0].map((s) => String.fromCharCode(64 + ((id >> s) & 0x1f))).join("");
  let name = null;
  let mode = null;
  for (let off = 54; off <= 108; off += 18) {
    const d = buf.subarray(off, off + 18);
    if (d[0] || d[1]) {
      if (mode) continue;
      const clock = (d[0] | (d[1] << 8)) * 10_000;
      const width = d[2] | ((d[4] & 0xf0) << 4);
      const hBlank = d[3] | ((d[4] & 0x0f) << 8);
      const height = d[5] | ((d[7] & 0xf0) << 4);
      const vBlank = d[6] | ((d[7] & 0x0f) << 8);
      const total = (width + hBlank) * (height + vBlank);
      mode = { width, height, hz: total ? Math.round(clock / total) : null };
    } else if (d[3] === 0xfc) {
      name = Buffer.from(d.subarray(5, 18)).toString("latin1").split("\n")[0].trim() || null;
    }
  }
  return mode ? { maker, name, ...mode } : null;
}

// Where each check is set up or explained: the page links its "fix" there.
const WHERE = {
  board: "#/docs/boards",
  audio: "#/settings/audio",
  display: "#/docs/projector",
  cec: "#/settings/projector",
  pir: "#/scares",
  power: "#/docs/wiring",
  temp: "#/settings/cooling",
  network: "#/docs/networks",
  clock: "#/docs/reliability",
  media: "#/media",
};
const check = (id, label, status, detail, fix = null) => ({ id, label, status, detail, fix, href: WHERE[id] ?? null });

/**
 * @param {object} f  facts gathered by main.js (any part may be missing: unknown)
 * @returns {Array<{id: string, label: string, status: "pass"|"fail"|"off"|"unknown", detail: string, fix: string|null, href: string|null}>}
 */
export function evaluateChecks(f = {}) {
  const out = [];

  // Board
  const b = parseBoardModel(f.board?.model);
  out.push(
    b.board
      ? check("board", "Raspberry Pi", "pass", b.model)
      : check("board", "Raspberry Pi", "unknown", b.model ? `${b.model}: not a board VideoFX knows` : "Could not read the board model", "VideoFX runs on a Pi 3, 4, 5 or Zero 2 W."),
  );

  // Sound card (the DigiAMP+ HAT)
  const a = f.audio ?? {};
  if (a.cardsText == null) {
    out.push(check("audio", "Amplifier", "unknown", "Could not read the list of sound cards"));
  } else {
    const missing = missingCardMessage(a.card, a.cardsText);
    out.push(missing ? check("audio", "Amplifier", "fail", `Sound card "${a.card}" not found`, missing) : check("audio", "Amplifier", "pass", `Sound card "${a.card}" found`));
  }

  // Projector on HDMI, and what it says it is
  const d = f.display ?? {};
  const edid = parseEdid(d.edid);
  const what = edid ? `${edid.name ?? edid.maker}, ${edid.width} × ${edid.height}${edid.hz ? ` at ${edid.hz} Hz` : ""}` : null;
  if (d.connected === true) {
    out.push(check("display", "Projector on HDMI", "pass", what ?? "Connected (no EDID read)"));
  } else if (d.connected === false) {
    out.push(
      check(
        "display",
        "Projector on HDMI",
        edid ? "pass" : "fail",
        edid ? `${what} (asleep or switched off)` : "Nothing on HDMI",
        edid ? null : "Plug the projector into the Pi's HDMI port (HDMI 0 on a Pi 4 or 5, the one nearest the power socket) and switch it on.",
      ),
    );
  } else {
    out.push(check("display", "Projector on HDMI", "unknown", "Could not read the HDMI port"));
  }

  // CEC
  const p = f.projector ?? {};
  if (p.mode === "relay" || p.mode === "relay-ir" || p.mode === "none") {
    out.push(check("cec", "Projector control (CEC)", "off", `Not used: projector power is "${p.mode}"`));
  } else if (p.cec === "supported") {
    out.push(check("cec", "Projector control (CEC)", "pass", "The projector answers CEC"));
  } else if (p.cec === "no-response") {
    out.push(
      check(
        "cec",
        "Projector control (CEC)",
        "fail",
        "The projector did not answer CEC",
        'Switch the projector on and run the checks again. If it still does not answer, it has no CEC: set Projector power to "hdmi-off", or fit the relay.',
      ),
    );
  } else if (p.cec === "no-device") {
    out.push(check("cec", "Projector control (CEC)", "unknown", "The Pi has no CEC device, or cec-ctl is missing", "Install v4l-utils, or check the CEC device in Settings > Projector."));
  } else {
    out.push(check("cec", "Projector control (CEC)", "unknown", "Not checked yet"));
  }

  // Motion sensor
  const m = f.pir ?? {};
  if (!m.enabled) out.push(check("pir", "Motion sensor", "off", "Turned off under Scares"));
  else if (!m.available) out.push(check("pir", "Motion sensor", "fail", "GPIO tools missing", "Install the gpiod package and restart the service."));
  else if (!m.running) out.push(check("pir", "Motion sensor", "fail", "Not watching the input", "Check the GPIO pin under Scares > Motion sensor, then restart the service."));
  else if (m.seen) out.push(check("pir", "Motion sensor", "pass", "Has seen motion since start-up"));
  else out.push(check("pir", "Motion sensor", "unknown", "No motion seen since start-up", "Walk in front of the sensor. If nothing changes, check its wiring."));

  // Heat and power supply
  const t = f.thermal ?? {};
  const flags = throttleNames(t.throttled);
  if (flags.now.includes("under-voltage") || flags.sinceBoot.includes("under-voltage")) {
    out.push(check("power", "Power supply", "fail", flags.now.includes("under-voltage") ? "Under-voltage now" : "Under-voltage since start-up", "The Pi is not getting a steady 5 V: check the DigiAMP+'s barrel jack supply and its cable."));
  } else if (t.throttled == null) {
    out.push(check("power", "Power supply", "unknown", "Could not read the firmware's power flags"));
  } else {
    out.push(check("power", "Power supply", "pass", "No under-voltage since start-up"));
  }
  if (t.temp == null) out.push(check("temp", "Pi temperature", "unknown", "Could not read the SoC temperature"));
  else if (t.warnC != null && t.temp >= t.warnC) out.push(check("temp", "Pi temperature", "fail", `${t.temp.toFixed(1)} °C (warning at ${t.warnC} °C)`, "Check the sled fan and the case vents."));
  else out.push(check("temp", "Pi temperature", "pass", `${t.temp.toFixed(1)} °C`));

  // Network and time
  const n = f.network ?? {};
  const w = n.wifi ?? {};
  if (n.ethernet) out.push(check("network", "Network", "pass", "Ethernet"));
  else if (w.connected) out.push(check("network", "Network", w.verdict === "poor" ? "fail" : "pass", `Wi-Fi "${w.ssid}", ${w.signalDbm} dBm (${w.verdict})`, w.verdict === "poor" ? "Move the access point closer or add one near the case." : null));
  else out.push(check("network", "Network", "fail", "Not connected", "Wi-Fi is set in Raspberry Pi Imager. Plug in Ethernet, or re-flash with the right network."));
  out.push(
    f.clock?.synced
      ? check("clock", "Network time", "pass", "Synced")
      : check("clock", "Network time", "fail", "Not synced: the schedule and sunset wait for it", "Needs internet access for NTP. Check the network first."),
  );

  // Something to play
  const md = f.media ?? {};
  if (md.problem) out.push(check("media", "Videos", "fail", md.problem, "Upload videos on the Media screen and add them to the playlist."));
  else if (md.clips == null) out.push(check("media", "Videos", "pass", "Ready to play"));
  else out.push(check("media", "Videos", "pass", md.mode === "scare" ? `A calm clip and ${md.clips} scare clip${md.clips === 1 ? "" : "s"}` : `${md.clips} in the playlist`));

  return out;
}

/** Counts for a summary line and the dashboard badge. */
export function summarize(checks) {
  const count = (s) => checks.filter((c) => c.status === s).length;
  return { pass: count("pass"), fail: count("fail"), off: count("off"), unknown: count("unknown"), total: checks.length };
}

/**
 * Runs the checks: one run at a time (a second press waits for the first).
 * Emits "done" with the result.
 */
export class SelfCheck extends EventEmitter {
  #gather;
  #now;
  #running = null;
  #last = null;

  /** @param {{ gather: () => Promise<object>, now?: () => number }} o */
  constructor({ gather, now = Date.now }) {
    super();
    this.#gather = gather;
    this.#now = now;
  }

  get last() {
    return this.#last;
  }

  get running() {
    return this.#running !== null;
  }

  run() {
    this.#running ??= (async () => {
      try {
        const checks = evaluateChecks(await this.#gather());
        this.#last = { at: new Date(this.#now()).toISOString(), checks, summary: summarize(checks) };
        this.emit("done", this.#last);
        return this.#last;
      } finally {
        this.#running = null;
      }
    })();
    return this.#running;
  }
}
