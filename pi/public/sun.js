// Sunset from NOAA's general solar position equations. DOM-free: the Pi's scheduler
// (src/schedule.js) and the Schedule screen share it, so the page shows the time the Pi acts at.

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

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** A time zone Intl accepts, else undefined (the browser's own). */
const zoneOrLocal = (timeZone) => {
  try {
    return timeZone ? new Intl.DateTimeFormat("en", { timeZone }).resolvedOptions().timeZone : undefined;
  } catch {
    return undefined;
  }
};

/**
 * The "on at sunset" time for each weekday over the next seven days (today first) in
 * `timeZone` (the Pi's; the browser's if unknown or invalid): { mon: "18:21", ... },
 * null for a day with no sunset. offsetMin is the schedule's sunset offset.
 */
export function sunsetTimes(now, { lat, lon, offsetMin = 0, timeZone, locale } = {}) {
  const tz = zoneOrLocal(timeZone);
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(now).map((p) => [p.type, Number(p.value)]));
  const fmt = new Intl.DateTimeFormat(locale, { timeZone: tz, hour: "numeric", minute: "2-digit" });
  const out = {};
  for (let i = 0; i < 7; i++) {
    const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + i));
    const set = sunset(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), lat, lon);
    out[WEEKDAYS[date.getUTCDay()]] = set === null ? null : fmt.format(set + offsetMin * 60_000);
  }
  return out;
}
