// Pinned to a zone with DST; set before any Date is created.
process.env.TZ = "America/Los_Angeles";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SCHEDULE, Scheduler, eventsForDay, nextEvent, parseSchedule, sunset } from "../src/schedule.js";

const week = (on, off) => ({
  enabled: true,
  sunsetOffsetMin: 0,
  days: Object.fromEntries(["sun", "mon", "tue", "wed", "thu", "fri", "sat"].map((d) => [d, { on, off }])),
});
const local = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
const minutesOff = (a, b) => Math.abs(a - b) / 60000;

it("runs in a DST time zone", () => {
  expect(new Date(2026, 6, 1).getTimezoneOffset()).not.toBe(new Date(2026, 0, 1).getTimezoneOffset());
});

describe("sunset (NOAA)", () => {
  it.each([
    ["San Francisco, June solstice", 37.7749, -122.4194, 2026, 6, 21, Date.UTC(2026, 5, 22, 3, 35)],
    ["San Francisco, December solstice", 37.7749, -122.4194, 2026, 12, 21, Date.UTC(2026, 11, 22, 0, 55)],
    ["London, June solstice", 51.5074, -0.1278, 2026, 6, 21, Date.UTC(2026, 5, 21, 20, 21)],
    ["Sydney, June solstice", -33.8688, 151.2093, 2026, 6, 21, Date.UTC(2026, 5, 21, 6, 54)],
  ])("%s is within 5 minutes of the published time", (_, lat, lon, y, m, d, expected) => {
    expect(minutesOff(sunset(y, m, d, lat, lon), expected)).toBeLessThan(5);
  });

  it("has no sunset in the midnight sun or the polar night", () => {
    expect(sunset(2026, 6, 21, 78.22, 15.65)).toBeNull(); // Longyearbyen, summer
    expect(sunset(2026, 12, 21, 78.22, 15.65)).toBeNull(); // Longyearbyen, winter
    expect(sunset(2026, 6, 1, 69.65, 18.96)).toBeNull(); // Tromsø, early June
    expect(sunset(2026, 12, 21, -77.85, 166.67)).toBeNull(); // McMurdo, southern summer
  });
});

describe("parseSchedule", () => {
  it("fills in missing days and validates", () => {
    const s = parseSchedule({ enabled: true, days: { fri: { on: "sunset", off: "23:30" } } });
    expect(s.days.fri).toEqual({ on: "sunset", off: "23:30" });
    expect(s.days.mon).toEqual({ on: "", off: "" });
    expect(parseSchedule(JSON.stringify(DEFAULT_SCHEDULE))).toEqual(DEFAULT_SCHEDULE);
  });
  it.each([
    [{ days: { mon: { on: "25:00" } } }, /mon: on/],
    [{ days: { mon: { off: "sunset" } } }, /mon: off/],
    [{ sunsetOffsetMin: 999 }, /offset/],
    [{ enabled: "yes" }, /enabled/],
    ["not json", /JSON/],
    [[], /object/],
  ])("rejects %j", (v, msg) => expect(() => parseSchedule(v)).toThrow(msg));
});

describe("events", () => {
  it("an off time before the on time is after midnight", () => {
    const [on, off] = eventsForDay(week("18:00", "01:00"), 2026, 9, 30);
    expect(local(new Date(on.at))).toBe("2026-10-30 18:00");
    expect(local(new Date(off.at))).toBe("2026-10-31 01:00");
  });

  it("on at sunset + offset; skips days with no location or no sunset", () => {
    const s = { ...week("sunset", "23:00"), sunsetOffsetMin: 15 };
    const [on] = eventsForDay(s, 2026, 5, 21, { lat: 37.7749, lon: -122.4194 });
    expect(minutesOff(on.at, Date.UTC(2026, 5, 22, 3, 50))).toBeLessThan(5);
    expect(on.label).toMatch(/sunset \+ 15 min/);
    expect(eventsForDay(s, 2026, 5, 21, null).map((e) => e.on)).toEqual([false]);
    expect(eventsForDay(s, 2026, 5, 21, { lat: 78.22, lon: 15.65 }).map((e) => e.on)).toEqual([false]);
  });

  it("spring forward: 02:30 doesn't exist, fires once at 03:30", () => {
    const s = week("02:30", "");
    const events = eventsForDay(s, 2026, 2, 8); // Sunday 8 March 2026
    expect(events).toHaveLength(1);
    expect(local(new Date(events[0].at))).toBe("2026-3-8 03:30");
    const next = nextEvent(s, new Date(2026, 2, 8, 0, 0).getTime());
    expect(local(new Date(next.at))).toBe("2026-3-8 03:30");
    expect(local(new Date(nextEvent(s, next.at).at))).toBe("2026-3-9 02:30");
  });

  it("fall back: 01:30 happens twice, fires once", () => {
    const s = week("01:30", "");
    const first = nextEvent(s, new Date(2026, 10, 1, 0, 0).getTime()); // Sunday 1 November 2026
    expect(local(new Date(first.at))).toBe("2026-11-1 01:30");
    const second = nextEvent(s, first.at);
    expect(local(new Date(second.at))).toBe("2026-11-2 01:30");
    expect(second.at - first.at).toBe(25 * 3600_000); // the 25-hour day
  });

  it("a daily 23:00 stays 23:00 local across both DST changes", () => {
    const s = week("", "23:00");
    for (const start of [new Date(2026, 2, 6), new Date(2026, 9, 30)]) {
      let t = start.getTime();
      for (let i = 0; i < 4; i++) {
        const e = nextEvent(s, t);
        expect(new Date(e.at).getHours()).toBe(23);
        t = e.at;
      }
    }
  });

  it("disabled, or nothing set: no next event", () => {
    expect(nextEvent({ ...week("18:00", "23:00"), enabled: false }, Date.now())).toBeNull();
    expect(nextEvent({ ...week("", ""), enabled: true }, Date.now())).toBeNull();
  });
});

describe("Scheduler", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function run(schedule, startLocal) {
    vi.setSystemTime(startLocal);
    const calls = [];
    const scheduler = new Scheduler({
      getSchedule: () => schedule,
      getGeo: () => null,
      setPower: (on) => calls.push([local(new Date()), on]),
      log: { info() {}, warn() {}, error() {} },
    });
    scheduler.start();
    return { scheduler, calls };
  }

  it("turns on and off at the scheduled times", async () => {
    const { calls, scheduler } = run(week("18:00", "23:00"), new Date(2026, 9, 30, 17, 0));
    expect(local(new Date(scheduler.next.at))).toBe("2026-10-30 18:00");
    await vi.advanceTimersByTimeAsync(29 * 3600_000); // to Sat 22:00
    expect(calls).toEqual([
      ["2026-10-30 18:00", true],
      ["2026-10-30 23:00", false],
      ["2026-10-31 18:00", true],
    ]);
  });

  it("a manual change holds until the next scheduled event", async () => {
    const { calls } = run(week("18:00", "23:00"), new Date(2026, 9, 30, 17, 0));
    await vi.advanceTimersByTimeAsync(1.5 * 3600_000); // 18:30, schedule turned it on
    // Someone turns it off at 18:30 (Matter / web): the schedule doesn't fight it...
    await vi.advanceTimersByTimeAsync(4 * 3600_000); // 22:30
    expect(calls).toEqual([["2026-10-30 18:00", true]]);
    // ...and acts again only at its next event.
    await vi.advanceTimersByTimeAsync(3600_000);
    expect(calls.at(-1)).toEqual(["2026-10-30 23:00", false]);
  });

  it("re-plans when the schedule changes", async () => {
    const schedule = week("18:00", "23:00");
    const { calls, scheduler } = run(schedule, new Date(2026, 9, 30, 17, 0));
    schedule.days.fri.on = "17:30";
    scheduler.start();
    await vi.advanceTimersByTimeAsync(3600_000);
    expect(calls).toEqual([["2026-10-30 17:30", true]]);
  });

  it("skips events that are long past after a clock jump (no RTC, NTP at boot)", async () => {
    const schedule = week("18:00", "23:00");
    const { calls } = run(schedule, new Date(2026, 9, 1, 12, 0)); // clock wrong at boot
    vi.setSystemTime(new Date(2026, 9, 30, 12, 0)); // NTP fixes it
    await vi.advanceTimersByTimeAsync(3600_000);
    expect(calls).toEqual([]); // nothing replayed
    await vi.advanceTimersByTimeAsync(6 * 3600_000);
    expect(calls).toEqual([["2026-10-30 18:00", true]]);
  });
});
