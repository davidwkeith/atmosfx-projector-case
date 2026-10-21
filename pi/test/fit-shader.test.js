import { describe, expect, it } from "vitest";
import { SHADER_DESC, fitParams, fitShader, fitShaderOpts } from "../src/fit-shader.js";
import { defaultFit } from "../src/fit-math.js";

const three = { name: "P", mirror: true, regions: [0, 1, 2].map((i) => ({ src: { x: i / 3, y: 0, w: 1 / 3, h: 1 }, dst: [[i / 3, 0], [(i + 1) / 3, 0], [(i + 1) / 3, 1], [i / 3, 1]] })) };

describe("fit shader", () => {
  it("has one PARAM per parameter, all floats, defaults from the fit", () => {
    const text = fitShader(three);
    const params = fitParams(three);
    expect(Object.keys(params)).toHaveLength(2 + 4 * 13);
    for (const [k, v] of Object.entries(params)) expect(text).toContain(`//!PARAM ${k}\n//!TYPE float\n${v.toPrecision(9)}\n`);
    expect(params.n).toBe(3);
    expect(params.mirror).toBe(1);
    expect(params.s3_w).toBe(0);
  });
  it("hooks OUTPUT with a named pass", () => {
    const text = fitShader(defaultFit());
    expect(text).toMatch(/\/\/!HOOK OUTPUT\n\/\/!BIND HOOKED\n\/\/!DESC videofx fit\n/);
    expect(SHADER_DESC).toBe("videofx fit");
  });
  it("constants variant: const floats, no PARAM, same hook header", () => {
    const text = fitShader(three, { params: false });
    expect(text).not.toContain("//!PARAM");
    const params = fitParams(three);
    for (const [k, v] of Object.entries(params)) expect(text).toContain(`const float ${k} = ${v.toPrecision(9)};\n`);
    expect(text.match(/^const float /gm)).toHaveLength(54);
    expect(text).toMatch(/\/\/!HOOK OUTPUT\n\/\/!BIND HOOKED\n\/\/!DESC videofx fit\n/);
    const desc = text.indexOf("//!DESC videofx fit");
    expect(text.indexOf("const float n ")).toBeGreaterThan(desc);
    expect(text.indexOf("const float s3_h ")).toBeGreaterThan(desc);
    expect(text.indexOf("const float s3_h ")).toBeLessThan(text.indexOf("vec4 region"));
    expect(fitShader(three)).toContain("//!PARAM");
  });
  it("opts string carries every parameter", () => {
    const opts = fitShaderOpts(three).split(",");
    expect(opts).toHaveLength(54);
    expect(opts[0]).toBe("n=3.00000000");
  });
});
