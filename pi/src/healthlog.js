// Health log: what the Pi went through while nobody was watching. The journal is in
// RAM under the read-only root and gone after a power cut, so this keeps its own
// file on the data partition (/var/lib/videofx/health.jsonl).
//
// One JSON object per line. A sample every minute:
//   {"t":ms,"soc":55.3,"fan":1,"thr":0,"dbm":-60,"on":1}     (+ "ns":1 while the clock is not synced)
// and an event whenever something changes:
//   {"t":ms,"lv":"warn","ev":"Under-voltage started"}
// Plain appends, no fsync: the data partition commits every 5 s, and a line cut short
// by a power cut is skipped on reading. Past maxBytes the file becomes health.jsonl.1
// (one old file is kept), so the log stays under 2 x maxBytes; at about 60 bytes a
// minute, 3 MB is about a month.

import * as nodeFs from "node:fs";

// vcgencmd get_throttled bits (Raspberry Pi documentation, "vcgencmd").
const FLAGS = ["under-voltage", "frequency capped", "throttled", "soft temperature limit"];

/** "throttled=0x50005" -> 0x50005; anything else -> null. */
export function parseThrottled(text) {
  const m = /throttled=0x([0-9a-f]+)/i.exec(text ?? "");
  return m ? parseInt(m[1], 16) : null;
}

/** Flag names set now (bits 0-3) and at any time since boot (bits 16-19). */
export function throttleNames(word) {
  const pick = (shift) => (word === null || word === undefined ? [] : FLAGS.filter((_, i) => word & (1 << (i + shift))));
  return { now: pick(0), sinceBoot: pick(16) };
}

const bit = (v) => (v === undefined || v === null ? null : v ? 1 : 0);
const capital = (s) => s[0].toUpperCase() + s.slice(1);

export class HealthLog {
  #file;
  #maxBytes;
  #now;
  #fs;
  #log;
  #size = null;
  #failed = false;
  #maxTemp = null;

  constructor({ file, maxBytes = 3 * 1024 * 1024, now = Date.now, fs = nodeFs, log = console }) {
    this.#file = file;
    this.#maxBytes = maxBytes;
    this.#now = now;
    this.#fs = fs;
    this.#log = log;
  }

  /** Every SoC reading: the next sample keeps the hottest one. */
  noteTemp(c) {
    if (c === null || c === undefined) return;
    this.#maxTemp = this.#maxTemp === null ? c : Math.max(this.#maxTemp, c);
  }

  sample({ fan, throttled, dbm, on, synced }) {
    const soc = this.#maxTemp === null ? null : Math.round(this.#maxTemp * 10) / 10;
    this.#maxTemp = null;
    this.#append({ t: this.#now(), soc, fan: bit(fan), thr: throttled ?? null, dbm: dbm ?? null, on: bit(on), ...(synced === false ? { ns: 1 } : {}) });
  }

  /** level: "info" | "warn" | "critical". */
  event(level, text) {
    this.#append({ t: this.#now(), lv: level, ev: text });
  }

  /** Everything at or after sinceMs, oldest first. */
  read({ sinceMs = 0 } = {}) {
    const samples = [];
    const events = [];
    for (const path of [`${this.#file}.1`, this.#file]) {
      let text;
      try {
        text = this.#fs.readFileSync(path, "utf8");
      } catch {
        continue;
      }
      for (const line of text.split("\n")) {
        let row;
        try {
          row = JSON.parse(line);
        } catch {
          continue;
        }
        if (typeof row?.t !== "number" || row.t < sinceMs) continue;
        (row.ev === undefined ? samples : events).push(row);
      }
    }
    return { samples, events };
  }

  #append(row) {
    let line = `${JSON.stringify(row)}\n`;
    try {
      if (this.#size === null) {
        this.#size = 0;
        try {
          const text = this.#fs.readFileSync(this.#file, "utf8");
          this.#size = Buffer.byteLength(text);
          // Cut short by a power cut: start a fresh line, or ours is lost with it.
          if (text.length && !text.endsWith("\n")) line = `\n${line}`;
        } catch {
          // no file yet
        }
      }
      if (this.#size + Buffer.byteLength(line) > this.#maxBytes && this.#size > 0) {
        this.#fs.renameSync(this.#file, `${this.#file}.1`);
        this.#size = 0;
      }
      this.#fs.appendFileSync(this.#file, line);
      this.#size += Buffer.byteLength(line);
      this.#failed = false;
    } catch (err) {
      // Logging must never take the service down; say so once per failure streak.
      if (!this.#failed) this.#log.warn(`Health log: ${err.message}`);
      this.#failed = true;
      this.#size = null;
    }
  }
}

/**
 * Turns the current state into events by comparing it with the last one; no I/O.
 * check({ alarm: null|"warn"|"critical", temp, throttled, wifi }) -> [{ level, text }]
 */
export class HealthWatch {
  #prev = null;

  check(cur) {
    const prev = this.#prev;
    const out = [];
    const flags = throttleNames(cur.throttled);
    if (!prev) {
      // Before the service started (an earlier boot stage, a crash): only the sticky bits tell.
      const before = flags.sinceBoot.filter((f) => !flags.now.includes(f));
      if (before.length) out.push({ level: "warn", text: `Since boot: ${before.join(", ")}` });
      for (const f of flags.now) out.push({ level: f === "under-voltage" ? "critical" : "warn", text: `${capital(f)} started` });
      if (cur.alarm) out.push(alarmEvent(cur.alarm, cur.temp));
    } else {
      if (cur.throttled !== null && cur.throttled !== undefined) {
        const was = prev.throttled === null || prev.throttled === undefined ? [] : throttleNames(prev.throttled).now;
        for (const f of flags.now.filter((f) => !was.includes(f))) out.push({ level: f === "under-voltage" ? "critical" : "warn", text: `${capital(f)} started` });
        for (const f of was.filter((f) => !flags.now.includes(f))) out.push({ level: "info", text: `${capital(f)} ended` });
      }
      if (cur.alarm !== prev.alarm) out.push(alarmEvent(cur.alarm, cur.temp));
      if (cur.wifi !== prev.wifi) out.push(cur.wifi ? { level: "info", text: "Wi-Fi connected" } : { level: "warn", text: "Wi-Fi disconnected" });
    }
    // A missing throttle reading keeps the last one, so it doesn't look like "ended".
    this.#prev = { ...cur, throttled: cur.throttled ?? prev?.throttled ?? null };
    return out;
  }
}

function alarmEvent(alarm, temp) {
  const t = typeof temp === "number" ? `${temp.toFixed(1)} °C` : "no reading";
  if (alarm === "critical") return { level: "critical", text: `Pi over-temperature cut-off: ${t}` };
  if (alarm === "warn") return { level: "warn", text: `Pi temperature warning: ${t}` };
  return { level: "info", text: `Pi temperature back to normal: ${t}` };
}

/** Samples as CSV for a spreadsheet. */
export function toCsv(samples) {
  const cell = (v) => (v === null || v === undefined ? "" : v);
  const rows = samples.map((s) =>
    [new Date(s.t).toISOString(), cell(s.soc), cell(s.fan), s.thr === null || s.thr === undefined ? "" : `0x${s.thr.toString(16)}`, cell(s.dbm), cell(s.on), s.ns ? 0 : 1].join(","),
  );
  return `time,soc_c,fan,throttled,wifi_dbm,on,clock_synced\n${rows.map((r) => `${r}\n`).join("")}`;
}
