import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HealthLog, HealthWatch, parseThrottled, throttleNames, toCsv } from "../src/healthlog.js";

const tmp = () => mkdtemp(join(tmpdir(), "videofx-health-"));

describe("vcgencmd get_throttled", () => {
  it("parses the hex word", () => {
    expect(parseThrottled("throttled=0x50005\n")).toBe(0x50005);
    expect(parseThrottled("throttled=0x0")).toBe(0);
    expect(parseThrottled("")).toBeNull();
    expect(parseThrottled("error=1")).toBeNull();
  });
  it("names the current and since-boot flags", () => {
    expect(throttleNames(0x50005)).toEqual({ now: ["under-voltage", "throttled"], sinceBoot: ["under-voltage", "throttled"] });
    expect(throttleNames(0x80000)).toEqual({ now: [], sinceBoot: ["soft temperature limit"] });
    expect(throttleNames(null)).toEqual({ now: [], sinceBoot: [] });
  });
});

describe("HealthLog", () => {
  it("writes one sample per call with the hottest reading since the last one", async () => {
    const dir = await tmp();
    let t = 1_000_000;
    const log = new HealthLog({ file: join(dir, "health.jsonl"), now: () => t });
    log.noteTemp(50);
    log.noteTemp(55.26);
    log.noteTemp(52);
    log.sample({ fan: true, throttled: 0, dbm: -60, on: true, synced: true });
    t += 60_000;
    log.sample({ fan: false, throttled: 1, dbm: null, on: false, synced: false });
    const { samples } = log.read();
    expect(samples).toEqual([
      { t: 1_000_000, soc: 55.3, fan: 1, thr: 0, dbm: -60, on: 1 },
      { t: 1_060_000, soc: null, fan: 0, thr: 1, dbm: null, on: 0, ns: 1 },
    ]);
  });

  it("keeps events apart from samples and filters by time", async () => {
    const dir = await tmp();
    let t = 0;
    const log = new HealthLog({ file: join(dir, "health.jsonl"), now: () => t });
    log.event("warn", "old");
    t = 10_000;
    log.event("critical", "new");
    log.sample({ on: true, synced: true });
    const r = log.read({ sinceMs: 5_000 });
    expect(r.events).toEqual([{ t: 10_000, lv: "critical", ev: "new" }]);
    expect(r.samples).toHaveLength(1);
  });

  it("skips a half-written last line (power cut)", async () => {
    const dir = await tmp();
    const file = join(dir, "health.jsonl");
    await writeFile(file, '{"t":1,"lv":"info","ev":"a"}\n{"t":2,"so');
    const log = new HealthLog({ file, now: () => 3 });
    log.event("info", "b");
    expect(log.read().events.map((e) => e.ev)).toEqual(["a", "b"]);
  });

  it("rotates to one old file past maxBytes and still reads both", async () => {
    const dir = await tmp();
    const file = join(dir, "health.jsonl");
    let t = 0;
    const log = new HealthLog({ file, maxBytes: 200, now: () => t++ });
    for (let i = 0; i < 20; i++) log.event("info", `event ${i}`);
    expect(existsSync(`${file}.1`)).toBe(true);
    expect((await readFile(file, "utf8")).length).toBeLessThan(250);
    const evs = log.read().events.map((e) => e.ev);
    expect(evs.at(-1)).toBe("event 19");
    expect(evs.length).toBeGreaterThan(4);
    expect(evs.length).toBeLessThan(20); // the oldest went with the rotation
  });

  it("never throws when the folder is gone", () => {
    const warned = [];
    const log = new HealthLog({ file: "/nonexistent/dir/health.jsonl", log: { warn: (m) => warned.push(m) } });
    log.event("info", "x");
    log.event("info", "y");
    expect(warned).toHaveLength(1);
    expect(log.read()).toEqual({ samples: [], events: [] });
  });
});

describe("HealthWatch", () => {
  const ok = { alarm: null, throttled: 0, wifi: true, temp: 50 };

  it("reports flags already set since boot on the first look, then only changes", () => {
    const w = new HealthWatch();
    expect(w.check({ ...ok, throttled: 0x10000 })).toEqual([{ level: "warn", text: "Since boot: under-voltage" }]);
    expect(w.check({ ...ok, throttled: 0x10000 })).toEqual([]);
    expect(w.check({ ...ok, throttled: 0x10001 })).toEqual([{ level: "critical", text: "Under-voltage started" }]);
    expect(w.check({ ...ok, throttled: 0x10000 })).toEqual([{ level: "info", text: "Under-voltage ended" }]);
  });

  it("logs thermal alarm changes with the temperature", () => {
    const w = new HealthWatch();
    w.check(ok);
    expect(w.check({ ...ok, alarm: "warn", temp: 71.2 })).toEqual([{ level: "warn", text: "Pi temperature warning: 71.2 °C" }]);
    expect(w.check({ ...ok, alarm: "critical", temp: 80.4 })).toEqual([{ level: "critical", text: "Pi over-temperature cut-off: 80.4 °C" }]);
    expect(w.check({ ...ok, temp: 68 })).toEqual([{ level: "info", text: "Pi temperature back to normal: 68.0 °C" }]);
  });

  it("logs Wi-Fi drops but not the first state", () => {
    const w = new HealthWatch();
    expect(w.check({ ...ok, wifi: false })).toEqual([]);
    expect(w.check(ok)).toEqual([{ level: "info", text: "Wi-Fi connected" }]);
    expect(w.check({ ...ok, wifi: false })).toEqual([{ level: "warn", text: "Wi-Fi disconnected" }]);
  });

  it("ignores a missing throttle reading", () => {
    const w = new HealthWatch();
    w.check({ ...ok, throttled: 0x1 });
    expect(w.check({ ...ok, throttled: null })).toEqual([]);
  });
});

describe("CSV", () => {
  it("writes ISO times and empty cells for missing values", () => {
    const csv = toCsv([{ t: 0, soc: 48.2, fan: 1, thr: 0x50005, dbm: null, on: 1, ns: 1 }]);
    expect(csv).toBe("time,soc_c,fan,throttled,wifi_dbm,on,clock_synced\n1970-01-01T00:00:00.000Z,48.2,1,0x50005,,1,0\n");
  });
});
