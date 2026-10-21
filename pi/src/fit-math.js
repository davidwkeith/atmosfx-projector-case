// Fit maths and validation shared by the server and the browser (served as
// /fit-math.js). No Node imports here.
//
// A fit places the video on the projector's output. Each region copies a
// rectangle of the video (src, 0..1 of the frame) onto a four-corner shape of
// the output (dst, 0..1 of the screen; corners TL, TR, BR, BL). A fit has 1 to 4
// regions, so one video can be split across several pumpkins or windows.

export const MAX_REGIONS = 4;
export const MAX_FITS = 20;
const MAX_NAME = 40;
const MIN_SIDE = 0.01; // smallest src width/height
const CORNER_MIN = -1; // the projector may overshoot its target a little
const CORNER_MAX = 2;
const EPS = 1e-6;

export const FULL = { x: 0, y: 0, w: 1, h: 1 };

export function defaultFit(name = "Default", mirror = false) {
  return {
    name,
    mirror,
    regions: [{ src: { ...FULL }, dst: [[0, 0], [1, 0], [1, 1], [0, 1]] }],
  };
}

export const DEFAULT_FITS = { active: "Default", fits: [defaultFit()] };

const isNum = (n) => typeof n === "number" && Number.isFinite(n);

/** Strictly convex (clockwise or counter-clockwise): every turn goes the same way, none is flat. */
export function isConvexQuad(q) {
  if (!Array.isArray(q) || q.length !== 4) return false;
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = q[i];
    const [bx, by] = q[(i + 1) % 4];
    const [cx, cy] = q[(i + 2) % 4];
    const cross = (bx - ax) * (cy - by) - (by - ay) * (cx - bx);
    if (Math.abs(cross) < EPS) return false; // repeated or collinear points
    const s = cross > 0 ? 1 : -1;
    if (sign !== 0 && s !== sign) return false; // bow-tie or concave
    sign = s;
  }
  return true;
}

function parseRegion(r) {
  if (typeof r !== "object" || r === null || typeof r.src !== "object" || r.src === null) throw new Error("a region needs src and dst");
  const { x, y, w, h } = r.src;
  if (![x, y, w, h].every(isNum) || x < 0 || y < 0 || w < MIN_SIDE || h < MIN_SIDE || x + w > 1 + EPS || y + h > 1 + EPS) {
    throw new Error("src must be inside the video (0 to 1)");
  }
  if (!Array.isArray(r.dst) || r.dst.length !== 4) throw new Error("dst needs 4 corners");
  const dst = r.dst.map((p) => {
    if (!Array.isArray(p) || p.length !== 2 || !p.every(isNum)) throw new Error("each corner must be [x, y]");
    if (p.some((n) => n < CORNER_MIN || n > CORNER_MAX)) throw new Error(`corners must be between ${CORNER_MIN} and ${CORNER_MAX}`);
    return [p[0], p[1]];
  });
  if (!isConvexQuad(dst)) throw new Error("corners must make a convex shape (a corner crossed another)");
  return { src: { x, y, w, h }, dst };
}

function parseFit(f) {
  if (typeof f !== "object" || f === null) throw new Error("a fit must be an object");
  if (typeof f.name !== "string" || f.name.length < 1 || f.name.length > MAX_NAME) throw new Error(`fit name must be 1 to ${MAX_NAME} characters`);
  if (typeof f.mirror !== "boolean") throw new Error(`fit "${f.name}": mirror must be true or false`);
  if (!Array.isArray(f.regions) || f.regions.length < 1 || f.regions.length > MAX_REGIONS) throw new Error(`fit "${f.name}": a fit needs 1 to ${MAX_REGIONS} regions`);
  try {
    return { name: f.name, mirror: f.mirror, regions: f.regions.map(parseRegion) };
  } catch (e) {
    throw new Error(`fit "${f.name}": ${e.message}`);
  }
}

/** Validate a fits document (JSON text or object); returns a clean copy of known keys only. */
export function parseFits(v) {
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      throw new Error("must be JSON");
    }
  }
  if (typeof v !== "object" || v === null || Array.isArray(v)) throw new Error("must be an object");
  if (!Array.isArray(v.fits) || v.fits.length < 1) throw new Error("needs at least one fit");
  if (v.fits.length > MAX_FITS) throw new Error(`at most ${MAX_FITS} fits`);
  const fits = v.fits.map(parseFit);
  const seen = new Set();
  for (const f of fits) {
    if (seen.has(f.name)) throw new Error(`fit "${f.name}" is listed twice`);
    seen.add(f.name);
  }
  if (!seen.has(v.active)) throw new Error("active must name one of the fits");
  return { active: v.active, fits };
}

export function activeFit(fits) {
  return fits.fits.find((f) => f.name === fits.active) ?? fits.fits[0];
}

/** One region, whole video onto the whole output, not mirrored: nothing to do. */
export function isIdentity(fit) {
  if (fit.mirror || fit.regions.length !== 1) return false;
  const { src, dst } = fit.regions[0];
  if (src.x !== 0 || src.y !== 0 || src.w !== 1 || src.h !== 1) return false;
  const corners = [[0, 0], [1, 0], [1, 1], [0, 1]];
  return dst.every((p, i) => Math.abs(p[0] - corners[i][0]) < EPS && Math.abs(p[1] - corners[i][1]) < EPS);
}

// 3x3 matrices are row-major arrays of 9.
const mul3 = (p, q) => {
  const o = new Array(9).fill(0);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) for (let k = 0; k < 3; k++) o[r * 3 + c] += p[r * 3 + k] * q[k * 3 + c];
  return o;
};

/** Homography taking a point of `src` (video, 0..1) to its place in the quad `dst`. */
export function rectToQuad(src, dst) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = dst;
  // Heckbert: unit square (u along TL->TR, v along TL->BL) onto the quad.
  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const sx = x0 - x1 + x2 - x3;
  const sy = y0 - y1 + y2 - y3;
  let g = 0;
  let h = 0;
  if (Math.abs(sx) > 1e-12 || Math.abs(sy) > 1e-12) {
    const den = dx1 * dy2 - dx2 * dy1;
    g = (sx * dy2 - dx2 * sy) / den;
    h = (dx1 * sy - sx * dy1) / den;
  }
  const sq = [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h, 1];
  // Normalise the video point into the unit square first.
  const norm = [1 / src.w, 0, -src.x / src.w, 0, 1 / src.h, -src.y / src.h, 0, 0, 1];
  return mul3(sq, norm);
}

export function invert3(m) {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-12) throw new Error("matrix is not invertible");
  return [A, -(b * i - c * h), b * f - c * e, B, a * i - c * g, -(a * f - c * d), C, -(a * h - b * g), a * e - b * d].map((n) => n / det);
}

export function apply3(m, [x, y]) {
  const w = m[6] * x + m[7] * y + m[8];
  return [(m[0] * x + m[1] * y + m[2]) / w, (m[3] * x + m[4] * y + m[5]) / w];
}

/** Output point -> video point for a region: what the shader samples with. */
export const outputToSource = (region) => invert3(rectToQuad(region.src, region.dst));

/**
 * CSS matrix3d (use with transform-origin: 0 0) that puts a w x h px element
 * showing the whole video onto the output, given the 0..1 matrix `m`.
 * px matrix = S·m·S⁻¹ with S = diag(w, h, 1), in CSS's column-major 4x4.
 */
export function cssMatrix3d(m, w, h) {
  const [a, b, c, d, e, f, g, hh, i] = m;
  const p = [a, (b * w) / h, c * w, (d * h) / w, e, f * h, g / w, hh / h, i];
  const n = (v) => (Object.is(v, -0) ? 0 : v);
  return `matrix3d(${[p[0], p[3], 0, p[6], p[1], p[4], 0, p[7], 0, 0, 1, 0, p[2], p[5], 0, p[8]].map(n).join(", ")})`;
}
