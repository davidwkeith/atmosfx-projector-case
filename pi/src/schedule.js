// Weekly on/off schedule with optional "on at sunset + N minutes".
// Times are local (the system time zone); sunset comes from NOAA's general solar
// position equations, computed here, no network. The schedule acts only at its
// event times, so a manual change holds until the next scheduled event.

export const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]; // Date#getDay order

export const DEFAULT_SCHEDULE = Object.freeze({
  enabled: false,
  sunsetOffsetMin: 0,
  days: Object.fromEntries(DAYS.map((d) => [d, { on: "", off: "" }])),
});

const TIME = /^([01][0-9]|2[0-3]):([0-5][0-9])$/;

/** Validate and normalize a schedule object (throws with a readable message). */
export function parseSchedule(v) {
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      throw new Error("must be JSON");
    }
  }
  if (typeof v !== "object" || v === null || Array.isArray(v)) throw new Error("must be an object");
  const out = { enabled: v.enabled === true, sunsetOffsetMin: 0, days: {} };
  if (v.enabled !== undefined && typeof v.enabled !== "boolean") throw new Error("enabled must be true or false");
  if (v.sunsetOffsetMin !== undefined) {
    const n = v.sunsetOffsetMin;
    if (!Number.isInteger(n) || n < -180 || n > 240) throw new Error("sunset offset must be a whole number of minutes from -180 to 240");
    out.sunsetOffsetMin = n;
  }
  for (const day of DAYS) {
    const d = v.days?.[day] ?? {};
    const on = d.on ?? "";
    const off = d.off ?? "";
    if (on !== "" && on !== "sunset" && !TIME.test(on)) throw new Error(`${day}: on must be HH:MM, "sunset" or empty`);
    if (off !== "" && !TIME.test(off)) throw new Error(`${day}: off must be HH:MM or empty`);
    out.days[day] = { on, off };
  }
  return out;
}

const rad = Math.PI / 180;

/**
 * Sunset (sun's upper limb at the horizon, 90.833° zenith) for a calendar date,
 * as epoch ms, or null when the sun doesn't set (midnight sun) or doesn't rise
 * (polar night). lon: degrees east positive. NOAA general solar position.
 */
export function sunset(year, month, day, lat, lon) {
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const doy = Math.round((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 1)) / 86_400_000) + 1;
  let minutes = 720 - 4 * lon + 360; // first guess: 18:00 local solar time, in UTC minutes
  for (let i = 0; i < 2; i++) {
    const g = ((2 * Math.PI) / (leap ? 366 : 365)) * (doy - 1 + (minutes / 60 - 12) / 24);
    const eqtime =
      229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    const decl =
      0.006918 -
      0.399912 * Math.cos(g) +
      0.070257 * Math.sin(g) -
      0.006758 * Math.cos(2 * g) +
      0.000907 * Math.sin(2 * g) -
      0.002697 * Math.cos(3 * g) +
      0.00148 * Math.sin(3 * g);
    const cosH = Math.cos(90.833 * rad) / (Math.cos(lat * rad) * Math.cos(decl)) - Math.tan(lat * rad) * Math.tan(decl);
    if (cosH < -1 || cosH > 1) return null;
    const ha = Math.acos(cosH) / rad;
    minutes = 720 - 4 * (lon - ha) - eqtime;
  }
  return Date.UTC(year, month - 1, day) + Math.round(minutes * 60_000);
}

const localAt = (y, m, d, hhmm) => {
  const [h, min] = hhmm.split(":").map(Number);
  return new Date(y, m, d, h, min).getTime(); // local time; JS moves times in a DST gap forward
};

/**
 * Events for one local calendar day (y, m 0-based, d). An off time earlier than
 * that day's on time is taken to be after midnight (next day).
 */
export function eventsForDay(schedule, y, m, d, geo) {
  const dayKey = DAYS[new Date(y, m, d).getDay()];
  const { on, off } = schedule.days[dayKey];
  const events = [];
  let onAt = null;
  if (on === "sunset") {
    const set = geo ? sunset(y, m + 1, d, geo.lat, geo.lon) : null;
    if (set !== null) {
      onAt = set + schedule.sunsetOffsetMin * 60_000;
      events.push({ at: onAt, on: true, label: `${dayKey} sunset${fmtOffset(schedule.sunsetOffsetMin)}` });
    }
  } else if (on) {
    onAt = localAt(y, m, d, on);
    events.push({ at: onAt, on: true, label: `${dayKey} ${on}` });
  }
  if (off) {
    let offAt = localAt(y, m, d, off);
    if (onAt !== null && offAt <= onAt) offAt = localAt(y, m, d + 1, off);
    events.push({ at: offAt, on: false, label: `${dayKey} off ${off}` });
  }
  return events;
}

const fmtOffset = (n) => (n === 0 ? "" : n > 0 ? ` + ${n} min` : ` - ${-n} min`);

/** The first event strictly after `from` (epoch ms), looking up to 8 days ahead, or null. */
export function nextEvent(schedule, from, geo) {
  if (!schedule?.enabled) return null;
  const start = new Date(from);
  let best = null;
  // Start a day early: yesterday's after-midnight off can still be ahead.
  for (let i = -1; i <= 8; i++) {
    for (const e of eventsForDay(schedule, start.getFullYear(), start.getMonth(), start.getDate() + i, geo)) {
      if (e.at > from && (!best || e.at < best.at)) best = e;
    }
  }
  return best;
}

/** The latest event at or before `at`, looking back up to 8 days, or null. */
export function lastEvent(schedule, at, geo) {
  if (!schedule?.enabled) return null;
  const start = new Date(at);
  let best = null;
  for (let i = -8; i <= 0; i++) {
    for (const e of eventsForDay(schedule, start.getFullYear(), start.getMonth(), start.getDate() + i, geo)) {
      if (e.at <= at && (!best || e.at > best.at)) best = e;
    }
  }
  return best;
}

const STALE_MS = 5 * 60_000;

/**
 * Runs the schedule: at each event, calls setPower(on). Re-plans at least hourly
 * so clock changes (NTP, DST) are picked up.
 */
export class Scheduler {
  #getSchedule;
  #getGeo;
  #setPower;
  #now;
  #setTimer;
  #clearTimer;
  #log;
  #clockOk;
  #timer = null;
  #next = null;
  #lastFired = 0;

  /**
   * clockOk: false until the clock is known good (NTP synchronised). No RTC on the
   * Pi 3/4/Zero 2 W: until then the schedule neither acts nor answers desiredNow().
   */
  constructor({ getSchedule, getGeo, setPower, clockOk = () => true, now = Date.now, setTimeout: st = setTimeout, clearTimeout: ct = clearTimeout, log = console }) {
    this.#clockOk = clockOk;
    this.#getSchedule = getSchedule;
    this.#getGeo = getGeo;
    this.#setPower = setPower;
    this.#now = now;
    this.#setTimer = st;
    this.#clearTimer = ct;
    this.#log = log;
  }

  get next() {
    return this.#next;
  }

  get waitingForClock() {
    return !this.#clockOk();
  }

  /** What the schedule wants right now (its latest past event), or null if it has no opinion. */
  desiredNow() {
    if (!this.#clockOk()) return null;
    return lastEvent(this.#getSchedule(), this.#now(), this.#getGeo())?.on ?? null;
  }

  /** (Re)plan from now; call after the schedule or location changes. */
  start() {
    this.#lastFired = Math.max(this.#lastFired, this.#now());
    this.#plan();
  }

  stop() {
    if (this.#timer) this.#clearTimer(this.#timer);
    this.#timer = null;
    this.#next = null;
  }

  #plan() {
    if (this.#timer) this.#clearTimer(this.#timer);
    this.#timer = null;
    if (!this.#clockOk()) {
      // Wrong clock: act on nothing; look again in a minute.
      this.#next = null;
      this.#timer = this.#setTimer(() => this.start(), 60_000);
      this.#timer?.unref?.();
      return;
    }
    this.#next = nextEvent(this.#getSchedule(), this.#lastFired, this.#getGeo());
    if (!this.#next) return;
    const delay = Math.min(Math.max(0, this.#next.at - this.#now()), 3_600_000);
    this.#timer = this.#setTimer(() => this.#tick(), delay);
    this.#timer?.unref?.();
  }

  #tick() {
    this.#timer = null;
    const now = this.#now();
    if (!this.#clockOk()) {
      this.#lastFired = now;
      return this.#plan();
    }
    const due = this.#next;
    if (due && now >= due.at) {
      this.#lastFired = due.at;
      // Stale (the clock jumped, e.g. NTP sync at boot on a Pi with no RTC): skip
      // everything in the past rather than replaying it.
      if (now - due.at > STALE_MS) {
        this.#log.warn(`Schedule: skipping ${due.label}, ${Math.round((now - due.at) / 60000)} min late`);
        this.#lastFired = now;
        return this.#plan();
      }
      this.#log.info(`Schedule: ${due.label}: turning ${due.on ? "on" : "off"}`);
      Promise.resolve(this.#setPower(due.on)).catch((err) => this.#log.error(`Schedule: ${err.message}`));
    }
    this.#plan();
  }
}
