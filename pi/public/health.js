// The health chart's geometry (System screen); DOM-free so it can be tested.
// Samples are the health log's one-minute rows: { t, soc, fan, thr, ... }.

/** A gap longer than this (service down, power cut) breaks the line. */
export const GAP_MS = 3 * 60_000;

/**
 * Lay samples out on a w x h box covering [to - hours, to], lo..hi °C bottom to top.
 * Returns polyline point strings (one per unbroken run), fan-on spans and
 * throttle/under-voltage marks as x positions, and y() for threshold lines.
 */
export function chart(samples, { to, hours = 24, w = 600, h = 160, lo = 30, hi = 90 }) {
  const from = to - hours * 3_600_000;
  const x = (t) => Math.round(((t - from) / (to - from)) * w * 10) / 10;
  const y = (c) => Math.round((h - ((Math.min(hi, Math.max(lo, c)) - lo) / (hi - lo)) * h) * 10) / 10;
  const lines = [];
  const fan = [];
  const throttle = [];
  let run = [];
  let prevT = null;
  let fanFrom = null;
  for (const s of samples) {
    if (s.t < from || s.t > to) continue;
    const gap = prevT !== null && s.t - prevT > GAP_MS;
    if ((gap || s.soc === null || s.soc === undefined) && run.length) {
      lines.push(run.join(" "));
      run = [];
    }
    if (typeof s.soc === "number") run.push(`${x(s.t)},${y(s.soc)}`);
    if (fanFrom !== null && (gap || !s.fan)) {
      fan.push([x(fanFrom), x(prevT)]);
      fanFrom = null;
    }
    if (s.fan && fanFrom === null) fanFrom = s.t;
    // Bits 0-3: under-voltage, frequency capped, throttled, soft temperature limit, right now.
    if (s.thr & 0xf) throttle.push({ x: x(s.t), underVoltage: Boolean(s.thr & 1) });
    prevT = s.t;
  }
  if (run.length) lines.push(run.join(" "));
  if (fanFrom !== null) fan.push([x(fanFrom), x(prevT)]);
  return { lines, fan, throttle, y };
}

/** Hottest reading in the samples, or null. */
export function peak(samples) {
  let best = null;
  for (const s of samples) if (typeof s.soc === "number" && (best === null || s.soc > best.soc)) best = s;
  return best;
}
