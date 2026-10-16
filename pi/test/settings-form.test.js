import { describe, expect, it, vi } from "vitest";
import { canon, createPending, placeOf, visibleItems } from "../public/settings-form.js";

describe("canon", () => {
  it("ignores object key order but not array order", () => {
    expect(canon({ a: 1, b: { c: 2, d: 3 } })).toBe(canon({ b: { d: 3, c: 2 }, a: 1 }));
    expect(canon([1, 2])).not.toBe(canon([2, 1]));
    expect(canon("1")).not.toBe(canon(1));
  });
});

describe("placeOf", () => {
  it("rounds a browser position to two decimals, without a negative zero", () => {
    expect(placeOf({ latitude: 37.774929, longitude: -122.419416 })).toEqual({ latitude: 37.77, longitude: -122.42 });
    expect(Object.is(placeOf({ latitude: -0.001, longitude: 0 }).latitude, 0)).toBe(true);
  });
});

describe("createPending", () => {
  it("records an edit, and drops it again when the value goes back to the current one", () => {
    const p = createPending();
    p.set("volume", 40, 30);
    expect(p.has("volume")).toBe(true);
    expect(p.get("volume")).toEqual({ value: 40 });
    p.set("volume", 30, 30);
    expect(p.count).toBe(0);
  });

  it("compares objects regardless of key order", () => {
    const p = createPending();
    p.set("schedule", { enabled: true, days: { mon: { on: "20:00", off: "23:00" } } }, { days: { mon: { off: "23:00", on: "20:00" } }, enabled: true });
    expect(p.count).toBe(0);
  });

  it("overwrites an edit and keeps insertion order", () => {
    const p = createPending();
    p.set("a", 1, 0);
    p.set("b", 1, 0);
    p.set("a", 2, 0);
    expect(p.keys()).toEqual(["a", "b"]);
    expect(p.get("a").value).toBe(2);
  });

  it("marks a reset, and undo removes any edit", () => {
    const p = createPending();
    p.reset("name");
    expect(p.get("name")).toEqual({ reset: true });
    p.undo("name");
    expect(p.count).toBe(0);
  });

  it("tells when a pending key needs a restart", () => {
    const p = createPending();
    const items = [{ key: "httpPort", apply: "restart" }, { key: "volume", apply: "live" }];
    p.set("volume", 1, 0);
    expect(p.restartNeeded(items)).toBe(false);
    p.set("httpPort", 8080, 80);
    expect(p.restartNeeded(items)).toBe(true);
  });

  it("notifies subscribers on every change and stops after unsubscribe", () => {
    const p = createPending();
    const fn = vi.fn();
    const off = p.subscribe(fn);
    p.set("a", 1, 0);
    p.reset("b");
    p.undo("b");
    p.clear();
    expect(fn).toHaveBeenCalledTimes(4);
    off();
    p.set("a", 1, 0);
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it("applies in order, using DELETE for resets", async () => {
    const p = createPending();
    p.set("a", 1, 0);
    p.reset("b");
    p.set("c", "x", "");
    const sent = [];
    const done = await p.apply(async (method, key, value) => void sent.push([method, key, value]));
    expect(sent).toEqual([["PUT", "a", 1], ["DELETE", "b", undefined], ["PUT", "c", "x"]]);
    expect(done).toEqual(["a", "b", "c"]);
    expect(p.count).toBe(0);
  });

  it("stops at the first error: earlier edits are cleared, the failing one and the rest stay pending", async () => {
    const p = createPending();
    p.set("a", 1, 0);
    p.set("b", 2, 0);
    p.set("c", 3, 0);
    const send = vi.fn(async (_m, key) => {
      if (key === "b") throw new Error("must be a whole number");
    });
    await expect(p.apply(send)).rejects.toMatchObject({ message: "must be a whole number", key: "b" });
    expect(send).toHaveBeenCalledTimes(2);
    expect(p.keys()).toEqual(["b", "c"]);
  });
});

describe("visibleItems", () => {
  const items = [
    { key: "name", label: "Device name", help: "Shown in Matter controllers", group: "Device" },
    { key: "mpvExtraArgs", label: "Extra mpv options", help: "decoding flags", group: "Advanced", advanced: true },
    { key: "irPowerCode", label: "IR power code", group: "Projector", custom: true },
    { key: "pirPin", label: "PIR GPIO", help: "pin 11", group: "Motion sensor" },
  ];
  it("hides advanced rows in Simple mode and never lists custom rows", () => {
    expect(visibleItems(items, { advanced: false, query: "" }).map((s) => s.key)).toEqual(["name", "pirPin"]);
    expect(visibleItems(items, { advanced: true, query: "" }).map((s) => s.key)).toEqual(["name", "mpvExtraArgs", "pirPin"]);
  });
  it("searches label and help, ignoring case and the Simple filter", () => {
    expect(visibleItems(items, { advanced: false, query: "MPV" }).map((s) => s.key)).toEqual(["mpvExtraArgs"]);
    expect(visibleItems(items, { advanced: false, query: "matter" }).map((s) => s.key)).toEqual(["name"]);
    expect(visibleItems(items, { advanced: false, query: "  " }).map((s) => s.key)).toEqual(["name", "pirPin"]);
    expect(visibleItems(items, { advanced: false, query: "ir power" })).toEqual([]);
  });
});
