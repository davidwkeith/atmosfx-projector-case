// DMX over sACN (ANSI E1.31), receive only: the box is an 8-channel fixture.
//
// Packet layout, sequence rule and timeouts follow ETC's reference receiver
// (github.com/ETCLabs/sACN: pdu.h/pdu.c, receiver_state.c, common.h). The ESTA
// PDF sits behind a terms form, so it was not read directly.
//
// Offsets (bytes):   0 preamble size 0x0010   2 post-amble 0   4 "ASC-E1.17\0\0\0"
//   16 root flags+length  18 root vector 0x00000004  22 CID (16)
//   38 framing flags+length  40 framing vector 0x00000002  44 source name (64)
//   108 priority  109 sync universe  111 sequence  112 options  113 universe
//   115 DMP flags+length  117 DMP vector 0x02  118 0xa1  119 first address 0
//   121 increment 1  123 property count (start code + slots)  125 start code  126 slots

import { EventEmitter } from "node:events";

export const SACN_PORT = 5568;
export const SOURCE_LOSS_MS = 2500; // E1.31 network data loss timeout
const ACN_ID = Buffer.from("ASC-E1.17\0\0\0", "latin1");
const OPT_PREVIEW = 0x80;
const OPT_TERMINATED = 0x40;

/** 239.255.hi.lo for a universe. */
export const multicastGroup = (universe) => `239.255.${(universe >> 8) & 0xff}.${universe & 0xff}`;

const flagsLengthOk = (buf, offset) => {
  const v = buf.readUInt16BE(offset);
  return v >> 12 === 0x7 && (v & 0x0fff) === buf.length - offset;
};

/** Parse a data packet. Returns { ok: true, ... } or { ok: false, reason }. */
export function parseSacn(buf) {
  const bad = (reason) => ({ ok: false, reason });
  if (buf.length < 126 || buf.length > 638) return bad("length");
  if (buf.readUInt16BE(0) !== 0x0010 || buf.readUInt16BE(2) !== 0x0000) return bad("preamble");
  if (!buf.subarray(4, 16).equals(ACN_ID)) return bad("packet identifier");
  if (!flagsLengthOk(buf, 16)) return bad("root length");
  const rootVector = buf.readUInt32BE(18);
  if (rootVector === 0x00000008) return bad("extended (sync/discovery) packet");
  if (rootVector !== 0x00000004) return bad("root vector");
  if (!flagsLengthOk(buf, 38)) return bad("framing length");
  if (buf.readUInt32BE(40) !== 0x00000002) return bad("framing vector");
  if (!flagsLengthOk(buf, 115)) return bad("DMP length");
  if (buf[117] !== 0x02 || buf[118] !== 0xa1 || buf.readUInt16BE(119) !== 0 || buf.readUInt16BE(121) !== 1) return bad("DMP header");
  const count = buf.readUInt16BE(123);
  if (count < 1 || count > 513 || 125 + count !== buf.length) return bad("property count");
  const universe = buf.readUInt16BE(113);
  if (universe < 1 || universe > 63999) return bad("universe");
  const priority = buf[108];
  if (priority > 200) return bad("priority");
  const nameEnd = buf.indexOf(0, 44);
  const options = buf[112];
  return {
    ok: true,
    cid: buf.subarray(22, 38).toString("hex"),
    name: buf.subarray(44, nameEnd >= 44 && nameEnd < 108 ? nameEnd : 108).toString("utf8"),
    priority,
    sequence: buf[111],
    preview: (options & OPT_PREVIEW) !== 0,
    terminated: (options & OPT_TERMINATED) !== 0,
    universe,
    startCode: buf[125],
    slots: buf.subarray(126), // slot 1 at index 0
  };
}

/** E1.31 sequence rule as in ETC's check_sequence(): accept if newer, or if far behind (wrap / restart). */
export function sequenceOk(next, last) {
  const diff = next - last;
  return diff > 0 || diff <= -20;
}

/**
 * Tracks sources for one universe; merges by highest priority, then HTP on ties.
 * Events: "frame" (Uint8Array(512) merged levels), "live" (boolean).
 */
export class SacnReceiver extends EventEmitter {
  #universe;
  #now;
  #sources = new Map(); // cid -> { cid, name, ip, priority, seq, lastSeen, slots, packets }
  #live = false;
  #rejected = 0;

  constructor({ universe, now = Date.now }) {
    super();
    this.#universe = universe;
    this.#now = now;
  }

  get live() {
    return this.#live;
  }

  setUniverse(universe) {
    this.#universe = universe;
    this.#sources.clear();
    this.#setLive(false);
  }

  /** Feed one UDP datagram. Returns why it was dropped, or "ok". */
  handle(buf, ip = "") {
    const p = parseSacn(buf);
    if (!p.ok) return this.#reject(p.reason);
    if (p.universe !== this.#universe) return "other universe";
    const known = this.#sources.get(p.cid);
    if (p.terminated) {
      // Stream_Terminated: the source is gone; its data in this packet is not used.
      if (known) {
        this.#sources.delete(p.cid);
        this.#changed();
      }
      return "terminated";
    }
    if (known && !sequenceOk(p.sequence, known.seq)) return this.#reject("out of sequence");
    if (p.preview) return "preview"; // visualisers only, never live output
    if (p.startCode !== 0x00) return "start code"; // e.g. 0xDD per-address priority: not used
    const slots = new Uint8Array(512);
    slots.set(p.slots.subarray(0, 512));
    const src = known ?? { cid: p.cid, packets: 0, since: this.#now() };
    Object.assign(src, { name: p.name, ip, priority: p.priority, seq: p.sequence, lastSeen: this.#now(), slots });
    src.packets++;
    this.#sources.set(p.cid, src);
    this.#changed();
    return "ok";
  }

  /** Expire sources silent for longer than the data loss timeout. Call a few times a second. */
  tick() {
    const now = this.#now();
    let dropped = false;
    for (const [cid, src] of this.#sources) {
      if (now - src.lastSeen > SOURCE_LOSS_MS) {
        this.#sources.delete(cid);
        dropped = true;
      }
    }
    if (dropped) this.#changed();
  }

  /** Merged levels: highest priority wins; equal top priorities merge HTP. null if no source. */
  merged() {
    if (this.#sources.size === 0) return null;
    const top = Math.max(...[...this.#sources.values()].map((s) => s.priority));
    const out = new Uint8Array(512);
    for (const s of this.#sources.values()) {
      if (s.priority !== top) continue;
      for (let i = 0; i < 512; i++) if (s.slots[i] > out[i]) out[i] = s.slots[i];
    }
    return out;
  }

  status() {
    const now = this.#now();
    return {
      live: this.#live,
      rejected: this.#rejected,
      sources: [...this.#sources.values()].map((s) => ({
        name: s.name,
        ip: s.ip,
        priority: s.priority,
        packetsPerSecond: Math.round((s.packets / Math.max(1, (now - s.since) / 1000)) * 10) / 10,
        lastSeenMs: now - s.lastSeen,
      })),
    };
  }

  #reject(reason) {
    this.#rejected++;
    return reason;
  }

  #changed() {
    const levels = this.merged();
    this.#setLive(levels !== null);
    if (levels) this.emit("frame", levels);
  }

  #setLive(live) {
    if (live === this.#live) return;
    this.#live = live;
    this.emit("live", live);
  }
}

// --- the fixture: 8 channels from the start address

export const CHANNELS = ["power", "mode", "clip", "trigger", "volume", "mute", "dimmer", "reserved"];

/** Our 8 channel values from a 512-slot frame (start address 1-based). */
export function fixtureValues(levels, startAddress) {
  return Array.from({ length: 8 }, (_, i) => levels[startAddress - 1 + i] ?? 0);
}

/** What the channels ask for. */
export function interpret(values) {
  const [power, mode, clip, trigger, volume, mute, dimmer] = values;
  return {
    power: power >= 128,
    mode: mode >= 128 ? "scare" : "loop",
    clip, // 0 = normal content, N = playlist entry N looped
    trigger: trigger >= 128,
    volume: Math.round((volume / 255) * 100),
    muted: mute >= 128,
    dimmer, // 255 = normal, 0 = black
  };
}

/**
 * Hand-over between DMX and everything else, and pacing of DMX-driven changes.
 * While any valid source is live, DMX owns power, mode, clip, volume, mute and
 * dimmer. After the last source is lost (2.5 s data loss) and a further hold
 * time, control is released.
 *
 * Calls (all optional): takeover(), release(), setPower(on), setMode(mode),
 * setClip(n), trigger(), setVolume({level, muted}), setDimmer(v).
 */
export class DmxControl extends EventEmitter {
  #act;
  #holdMs;
  #now;
  #setTimer;
  #clearTimer;
  #inControl = false;
  #holdTimer = null;
  #lastTrigger = false;
  #last = {}; // last applied values
  #pending = new Map(); // key -> { value, timer }
  #lastApply = new Map();
  #values = null;

  // Pacing per output: minimum interval between applies, or a debounce (value
  // must be stable that long) for clip select.
  static PACE = { power: { interval: 1000 }, mode: { interval: 500 }, clip: { debounce: 300 }, volume: { interval: 100 }, dimmer: { interval: 100 } };

  constructor({ act, holdMs = 5000, now = Date.now, setTimeout: st = setTimeout, clearTimeout: ct = clearTimeout }) {
    super();
    this.#act = act;
    this.#holdMs = holdMs;
    this.#now = now;
    this.#setTimer = st;
    this.#clearTimer = ct;
  }

  get inControl() {
    return this.#inControl;
  }

  get values() {
    return this.#values;
  }

  setHold(ms) {
    this.#holdMs = ms;
  }

  /** Receiver went live / quiet. */
  live(isLive) {
    if (isLive) {
      if (this.#holdTimer) this.#clearTimer(this.#holdTimer);
      this.#holdTimer = null;
      if (!this.#inControl) {
        this.#inControl = true;
        this.#last = {};
        this.#lastTrigger = true; // a trigger level already high at takeover is not an edge
        this.#act.takeover?.();
        this.emit("control", true);
      }
      return;
    }
    if (!this.#inControl || this.#holdTimer) return;
    this.#holdTimer = this.#setTimer(() => {
      this.#holdTimer = null;
      this.#inControl = false;
      for (const p of this.#pending.values()) this.#clearTimer(p.timer);
      this.#pending.clear();
      this.#act.release?.();
      this.emit("control", false);
    }, this.#holdMs);
  }

  /** New channel values (8) while live. */
  frame(values) {
    this.#values = values;
    if (!this.#inControl) return;
    const want = interpret(values);
    // Rising edge through 128 fires once; the player applies its cooldown.
    if (want.trigger && !this.#lastTrigger) this.#act.trigger?.();
    this.#lastTrigger = want.trigger;
    this.#paced("power", want.power, (v) => this.#act.setPower?.(v));
    this.#paced("mode", want.mode, (v) => this.#act.setMode?.(v));
    this.#paced("clip", want.clip, (v) => this.#act.setClip?.(v));
    this.#paced("volume", `${want.volume}/${want.muted}`, () => this.#act.setVolume?.({ level: want.volume, muted: want.muted }));
    this.#paced("dimmer", want.dimmer, (v) => this.#act.setDimmer?.(v));
  }

  #paced(key, value, apply) {
    const pending = this.#pending.get(key);
    if (value === this.#last[key] && !pending) return;
    if (pending) {
      if (pending.value === value) return;
      this.#clearTimer(pending.timer);
      this.#pending.delete(key);
      if (value === this.#last[key]) return; // bounced back
    }
    const pace = DmxControl.PACE[key];
    const fire = () => {
      this.#pending.delete(key);
      this.#last[key] = value;
      this.#lastApply.set(key, this.#now());
      apply(value);
    };
    let wait = 0;
    if (pace.debounce && this.#last[key] !== undefined) wait = pace.debounce;
    else if (pace.interval) wait = Math.max(0, (this.#lastApply.get(key) ?? -Infinity) + pace.interval - this.#now());
    if (wait === 0) return fire();
    this.#pending.set(key, { value, timer: this.#setTimer(fire, wait) });
  }
}

/**
 * Gatekeeper for the main power. While DMX is in control only DMX may change it;
 * thermal protection always may switch off, and while it has tripped nothing may
 * switch on. request() returns { ok } or { ok: false, actual, reason } so the
 * caller can put Matter's attribute back.
 */
export class PowerArbiter {
  #dmx;
  #apply;
  #actual;
  #blocked;

  constructor({ dmx, apply, actual, blocked = () => null }) {
    this.#dmx = dmx;
    this.#apply = apply;
    this.#actual = actual;
    this.#blocked = blocked;
  }

  request(source, on) {
    const blocked = on ? this.#blocked() : null;
    if (blocked) return { ok: false, actual: this.#actual(), reason: blocked };
    if (this.#dmx.inControl && source !== "dmx" && source !== "thermal") {
      return { ok: false, actual: this.#actual(), reason: "DMX is in control" };
    }
    this.#apply(on, source);
    return { ok: true };
  }
}

/**
 * Tells our own writes to the Matter on/off attribute from a controller's. A tag
 * is used up by the change event its write causes. A write that causes no event
 * (the attribute already had that value, or the write failed) lets its tag
 * expire, so the next controller write is not mistaken for ours and waved past
 * the arbiter (DMX in control, over temperature).
 */
export class InternalWrites {
  #tags = new Set();
  #graceMs;
  #setTimer;

  constructor({ graceMs = 1000, setTimeout: st = setTimeout } = {}) {
    this.#graceMs = graceMs;
    this.#setTimer = st;
  }

  get pending() {
    return this.#tags.size;
  }

  /** Run write() (which sets the attribute to `on`) marked as ours. */
  async run(on, write) {
    const tag = { on };
    this.#tags.add(tag);
    try {
      await write();
    } catch (err) {
      this.#tags.delete(tag);
      throw err;
    }
    // The event normally comes before write() resolves; allow for it coming just after.
    const timer = this.#setTimer(() => this.#tags.delete(tag), this.#graceMs);
    timer?.unref?.();
  }

  /** From the change event: was this change to `on` ours? */
  take(on) {
    for (const tag of this.#tags) {
      if (tag.on !== on) continue;
      this.#tags.delete(tag);
      return true;
    }
    return false;
  }
}
