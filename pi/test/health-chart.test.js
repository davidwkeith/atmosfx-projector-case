import { describe, expect, it } from "vitest";
import { chart, peak } from "../public/health.js";

const M = 60_000;
const opts = { to: 60 * M, hours: 1, w: 60, h: 60, lo: 30, hi: 90 }; // 1 px per minute, 1 px per °C

describe("health chart", () => {
  it("places samples by time and temperature, clamped to the range", () => {
    const r = chart([{ t: 0, soc: 30 }, { t: M, soc: 60 }, { t: 2 * M, soc: 120 }], opts);
    expect(r.lines).toEqual(["0,60 1,30 2,0"]);
    expect(r.y(70)).toBe(20);
  });

  it("breaks the line at a gap or a missing reading", () => {
    const r = chart([{ t: 0, soc: 40 }, { t: M, soc: 41 }, { t: 10 * M, soc: 42 }, { t: 11 * M, soc: null }, { t: 12 * M, soc: 43 }], opts);
    expect(r.lines).toEqual(["0,50 1,49", "10,48", "12,47"]);
  });

  it("drops samples outside the window", () => {
    expect(chart([{ t: -M, soc: 40 }, { t: 61 * M, soc: 40 }], opts).lines).toEqual([]);
  });

  it("collects fan-on spans and throttle marks", () => {
    const r = chart(
      [
        { t: 0, soc: 50, fan: 0, thr: 0 },
        { t: M, soc: 61, fan: 1, thr: 0 },
        { t: 2 * M, soc: 60, fan: 1, thr: 0x50005 },
        { t: 3 * M, soc: 50, fan: 0, thr: 0x50000 },
        { t: 4 * M, soc: 62, fan: 1, thr: 0x4 },
      ],
      opts,
    );
    expect(r.fan).toEqual([[1, 2], [4, 4]]);
    expect(r.throttle).toEqual([{ x: 2, underVoltage: true }, { x: 4, underVoltage: false }]);
  });

  it("finds the hottest sample", () => {
    expect(peak([{ t: 1, soc: 50 }, { t: 2, soc: null }, { t: 3, soc: 71.5 }])).toEqual({ t: 3, soc: 71.5 });
    expect(peak([])).toBeNull();
  });
});
