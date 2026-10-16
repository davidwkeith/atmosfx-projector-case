// mpv user shader for a phone-made fit: up to MAX_REGIONS source rectangles,
// each warped onto an output quad. Every number is a //!PARAM float, so one
// shader text serves all fits (live glsl-shader-opts, or a rewritten file).
import { MAX_REGIONS, outputToSource } from "./fit-math.js";

export const SHADER_DESC = "videofx fit";

const paramNames = () => {
  const names = ["n", "mirror"];
  for (let i = 0; i < MAX_REGIONS; i++) {
    for (let k = 0; k < 9; k++) names.push(`h${i}_${k}`);
    for (const c of ["x", "y", "w", "h"]) names.push(`s${i}_${c}`);
  }
  return names;
};

export function fitParams(fit) {
  const out = { n: fit.regions.length, mirror: fit.mirror ? 1 : 0 };
  for (let i = 0; i < MAX_REGIONS; i++) {
    const r = fit.regions[i];
    const h = r ? outputToSource(r) : new Array(9).fill(0);
    for (let k = 0; k < 9; k++) out[`h${i}_${k}`] = h[k];
    out[`s${i}_x`] = r ? r.src.x : 0;
    out[`s${i}_y`] = r ? r.src.y : 0;
    out[`s${i}_w`] = r ? r.src.w : 0;
    out[`s${i}_h`] = r ? r.src.h : 0;
  }
  return out;
}

export function fitShaderOpts(fit) {
  const p = fitParams(fit);
  return paramNames().map((k) => `${k}=${p[k].toPrecision(9)}`).join(",");
}

/**
 * params true (default): //!PARAM blocks, for --vo=gpu-next (live glsl-shader-opts).
 * params false: `const float` declarations, for --vo=gpu (mpv 0.40's gpu has no //!PARAM);
 * a new fit means a new file.
 */
export function fitShader(fit, { params = true } = {}) {
  const p = fitParams(fit);
  const blocks = paramNames()
    .map((k) => (params ? `//!PARAM ${k}\n//!TYPE float\n${p[k].toPrecision(9)}\n` : `const float ${k} = ${p[k].toPrecision(9)};\n`))
    .join(params ? "\n" : "");
  const regions = [];
  for (let i = 0; i < MAX_REGIONS; i++) {
    const h = Array.from({ length: 9 }, (_, k) => `h${i}_${k}`).join(", ");
    regions.push(
      `  if (n > ${i}.5) { c = region(p, mat3(${h}), vec4(s${i}_x, s${i}_y, s${i}_w, s${i}_h)); if (c.a >= 0.0) return c; }`,
    );
  }
  return `${blocks}
//!HOOK OUTPUT
//!BIND HOOKED
//!DESC ${SHADER_DESC}
vec4 region(vec2 p, mat3 h, vec4 s) {
  vec3 q = vec3(p, 1.0) * h;
  if (q.z <= 0.0) return vec4(-1.0);
  vec2 t = q.xy / q.z;
  if (any(lessThan(t, s.xy)) || any(greaterThan(t, s.xy + s.zw))) return vec4(-1.0);
  return HOOKED_tex(t);
}
vec4 hook() {
  vec2 p = HOOKED_pos;
  if (mirror > 0.5) p.x = 1.0 - p.x;
  vec4 c;
${regions.join("\n")}
  return vec4(0.0, 0.0, 0.0, 1.0);
}
`;
}
