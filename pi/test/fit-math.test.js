import { describe, expect, it } from "vitest";
import { DEFAULT_FITS, activeFit, apply3, cssMatrix3d, defaultFit, invert3, isConvexQuad, isIdentity, outputToSource, parseFits, rectToQuad } from "../src/fit-math.js";

const near = (a, b) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 6));

describe("fit maths", () => {
  it("maps a rect's corners onto the quad", () => {
    const src = { x: 0.1, y: 0.2, w: 0.3, h: 0.4 };
    const dst = [[0.05, 0.1], [0.6, 0.15], [0.55, 0.9], [0.1, 0.8]];
    const m = rectToQuad(src, dst);
    near(apply3(m, [0.1, 0.2]), dst[0]);
    near(apply3(m, [0.4, 0.2]), dst[1]);
    near(apply3(m, [0.4, 0.6]), dst[2]);
    near(apply3(m, [0.1, 0.6]), dst[3]);
  });
  it("outputToSource inverts it", () => {
    const r = { src: { x: 0, y: 0, w: 0.5, h: 1 }, dst: [[0.2, 0], [0.8, 0.1], [0.7, 1], [0.3, 0.9]] };
    near(apply3(outputToSource(r), [0.8, 0.1]), [0.5, 0]);
  });
  it("invert3 round-trips", () => {
    const m = rectToQuad({ x: 0, y: 0, w: 1, h: 1 }, [[0.1, 0], [1, 0.1], [0.9, 1], [0, 0.8]]);
    const p = apply3(invert3(m), apply3(m, [0.3, 0.7]));
    near(p, [0.3, 0.7]);
  });
  it("rejects a non-convex quad", () => {
    expect(isConvexQuad([[0, 0], [1, 0], [0, 1], [1, 1]])).toBe(false); // bow-tie
    expect(isConvexQuad([[0, 0], [1, 0], [0.4, 0.4], [0, 1]])).toBe(false); // concave
    expect(isConvexQuad([[0, 0], [0, 0], [1, 1], [0, 1]])).toBe(false); // repeated
    expect(() => parseFits({ active: "A", fits: [{ name: "A", mirror: false, regions: [{ src: { x: 0, y: 0, w: 1, h: 1 }, dst: [[0, 0], [1, 0], [0, 1], [1, 1]] }] }] })).toThrow(/corners/);
  });
  it("validates shape and limits", () => {
    expect(parseFits(JSON.stringify(DEFAULT_FITS))).toEqual(DEFAULT_FITS);
    expect(() => parseFits({ active: "B", fits: [defaultFit("A")] })).toThrow(/active/);
    expect(() => parseFits({ active: "A", fits: [defaultFit("A"), defaultFit("A")] })).toThrow(/twice/);
    expect(() => parseFits({ active: "A", fits: [{ ...defaultFit("A"), regions: Array(5).fill(defaultFit().regions[0]) }] })).toThrow(/4 regions/);
    expect(() => parseFits({ active: "A", fits: [{ ...defaultFit("A"), regions: [] }] })).toThrow(/region/);
    expect(() => parseFits({ active: "x".repeat(41), fits: [defaultFit("x".repeat(41))] })).toThrow(/name/);
    expect(() => parseFits({ active: "A", fits: [{ ...defaultFit("A"), regions: [{ src: { x: 0.9, y: 0, w: 0.2, h: 1 }, dst: defaultFit().regions[0].dst }] }] })).toThrow(/inside the video/);
    expect(() => parseFits({ active: "A", fits: [{ ...defaultFit("A"), regions: [{ src: { x: 0, y: 0, w: 1, h: 1 }, dst: [[-2, 0], [1, 0], [1, 1], [0, 1]] }] }] })).toThrow(/-1 and 2/);
    expect(() => parseFits({ active: "F0", fits: Array.from({ length: 21 }, (_, i) => defaultFit(`F${i}`)) })).toThrow(/at most 20 fits/);
    expect(() => parseFits({ active: "A", fits: [{ ...defaultFit("A"), regions: [{ src: { x: 0, y: 0, w: 0.001, h: 1 }, dst: defaultFit().regions[0].dst }] }] })).toThrow(/inside the video/);
    expect(() => parseFits({ active: "A", fits: [{ ...defaultFit("A"), mirror: "yes" }] })).toThrow(/mirror/);
    expect(() => parseFits("{")).toThrow(/JSON/);
  });
  it("identity and active", () => {
    expect(isIdentity(defaultFit())).toBe(true);
    expect(isIdentity(defaultFit("D", true))).toBe(false);
    expect(activeFit(DEFAULT_FITS).name).toBe("Default");
  });
  it("cssMatrix3d is a 16-number matrix3d", () => {
    const s = cssMatrix3d(rectToQuad({ x: 0, y: 0, w: 1, h: 1 }, [[0, 0], [1, 0], [1, 1], [0, 1]]), 320, 180);
    expect(s).toMatch(/^matrix3d\((-?[\d.e-]+, ){15}-?[\d.e-]+\)$/);
  });
});
