// Quiet hours: per-weekday windows when the speaker volume is capped (0 = mute)
// and, optionally, scares are off. They apply whoever asks: the web page, Matter,
// the schedule, the PIR. DMX is capped too unless "DMX bypasses quiet hours" is on.

import { DAYS } from "./schedule.js";

const TIME = /^([01][0-9]|2[0-3]):([0-5][0-9])$/;

export const DEFAULT_QUIET = Object.freeze({
  enabled: false,
  volumeCap: 10, // % ; 0 mutes
  disableScares: true,
  dmxBypass: false,
  days: Object.fromEntries(DAYS.map((d) => [d, { start: "", end: "" }])),
});

export function parseQuiet(v) {
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      throw new Error("must be JSON");
    }
  }
  if (typeof v !== "object" || v === null || Array.isArray(v)) throw new Error("must be an object");
  const bool = (k, d) => {
    if (v[k] === undefined) return d;
    if (typeof v[k] !== "boolean") throw new Error(`${k} must be true or false`);
    return v[k];
  };
  const cap = v.volumeCap ?? DEFAULT_QUIET.volumeCap;
  if (!Number.isInteger(cap) || cap < 0 || cap > 100) throw new Error("volume cap must be a whole number from 0 to 100");
  const out = {
    enabled: bool("enabled", false),
    volumeCap: cap,
    disableScares: bool("disableScares", true),
    dmxBypass: bool("dmxBypass", false),
    days: {},
  };
  for (const day of DAYS) {
    const d = v.days?.[day] ?? {};
    const start = d.start ?? "";
    const end = d.end ?? "";
    if (start !== "" && !TIME.test(start)) throw new Error(`${day}: start must be HH:MM or empty`);
    if (end !== "" && !TIME.test(end)) throw new Error(`${day}: end must be HH:MM or empty`);
    if ((start === "") !== (end === "")) throw new Error(`${day}: set both start and end, or neither`);
    out.days[day] = { start, end };
  }
  return out;
}

const minutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/**
 * Is `date` (local time) inside quiet hours? A window whose end is earlier than
 * its start runs past midnight into the next day; start == end means all day.
 */
export function inQuietHours(q, date) {
  if (!q?.enabled) return false;
  const t = date.getHours() * 60 + date.getMinutes();
  const today = q.days[DAYS[date.getDay()]];
  const yesterday = q.days[DAYS[(date.getDay() + 6) % 7]];
  if (today.start) {
    const [s, e] = [minutes(today.start), minutes(today.end)];
    if (s === e) return true;
    if (s < e ? t >= s && t < e : t >= s) return true;
  }
  if (yesterday.start) {
    const [s, e] = [minutes(yesterday.start), minutes(yesterday.end)];
    if (s > e && t < e) return true; // spill-over past midnight
  }
  return false;
}

const hasWindows = (q) => q?.enabled && Object.values(q.days).some((d) => d.start);

/**
 * Quiet right now, for a request. clockOk false (no NTP yet, no RTC): assume
 * quiet if any window is set, the neighbour-friendly guess.
 */
export function quietNow(q, date, { clockOk = true } = {}) {
  return clockOk ? inQuietHours(q, date) : Boolean(hasWindows(q));
}

/** Volume to apply: capped (or muted when the cap is 0) during quiet hours. */
export function capVolume({ level, muted }, q, date, { source = "settings", clockOk = true } = {}) {
  const quiet = quietNow(q, date, { clockOk }) && !(source === "dmx" && q.dmxBypass);
  if (!quiet) return { level, muted, capped: false };
  if (q.volumeCap === 0) return { level, muted: true, capped: true };
  return { level: Math.min(level, q.volumeCap), muted, capped: level > q.volumeCap };
}

/** Why a scare is not allowed now, or null. */
export function scareBlocked(q, date, { source = "", clockOk = true } = {}) {
  if (!q?.disableScares) return null;
  if (source === "DMX" && q.dmxBypass) return null;
  return quietNow(q, date, { clockOk }) ? "quiet hours" : null;
}
