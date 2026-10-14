import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { pending, safeToRebuild, settingRow } from "../public/settings-form.js";
import { ensureLoaded, state } from "../public/state.js";

// A tiny stand-in for the DOM: it records what is appended, which is all these checks need.
function fakeEl(tag) {
  return { tag, children: [], classList: { toggle() {}, add() {} }, dataset: {}, append(...kids) { this.children.push(...kids); }, setAttribute() {}, addEventListener() {} };
}
const walk = (n) => n.children.flatMap((c) => [c, ...(c && typeof c === "object" ? walk(c) : [])]);

afterEach(() => {
  vi.unstubAllGlobals();
  delete globalThis.document;
  pending.clear();
  state.settings = state.media = state.status = null;
});

describe("rows", () => {
  it("never append null or undefined for a setting without a help string", () => {
    globalThis.document = { createElement: fakeEl, createElementNS: (_ns, tag) => fakeEl(tag) };
    const row = settingRow({ key: "irDoublePress", label: "Projector needs two power presses", apply: "live", source: "default", default: false, value: false, env: "VIDEOFX_IR_DOUBLE_PRESS" });
    const all = walk(row);
    expect(all.length).toBeGreaterThan(0);
    expect(all.filter((c) => c === null || c === undefined || c === "null")).toEqual([]);
  });
});

describe("safeToRebuild", () => {
  const root = { contains: () => true };
  const control = { matches: () => true };

  it("is true when nothing is focused inside the view, or only the view itself is", () => {
    pending.set("a", 1, 0);
    globalThis.document = { activeElement: null };
    expect(safeToRebuild(root)).toBe(true);
    globalThis.document = { activeElement: root };
    expect(safeToRebuild(root)).toBe(true);
  });

  it("is false while a control has focus and edits are waiting", () => {
    pending.set("a", 1, 0);
    globalThis.document = { activeElement: control };
    expect(safeToRebuild(root)).toBe(false);
  });

  it("is true again once nothing is pending, even if a tapped control keeps focus (phones)", () => {
    globalThis.document = { activeElement: control };
    expect(pending.count).toBe(0);
    expect(safeToRebuild(root)).toBe(true);
  });
});

describe("ensureLoaded", () => {
  const ok = (body) => ({ ok: true, headers: { get: () => "application/json" }, json: async () => body });

  it("fetches settings and media when the first load missed them, and not again once loaded", async () => {
    const fetchMock = vi.fn(async (path) => ok({ path }));
    vi.stubGlobal("fetch", fetchMock);
    await ensureLoaded();
    expect(state.settings).toEqual({ path: "/api/settings" });
    expect(state.media).toEqual({ path: "/api/media" });
    await ensureLoaded();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("stays quiet when the Pi is unreachable and tries again next time", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    await expect(ensureLoaded()).resolves.toBeUndefined();
    expect(state.settings).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async (path) => ok({ path })));
    await ensureLoaded();
    expect(state.settings).toEqual({ path: "/api/settings" });
  });
});

describe("toast", () => {
  it("sits above the tab bar and the Apply bar, away from both", () => {
    const css = readFileSync(new URL("../public/app.css", import.meta.url), "utf8");
    const rule = /#toast\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(Number(/z-index:\s*(\d+)/.exec(rule)?.[1] ?? 0)).toBeGreaterThan(20); // #nav is 20, .apply is 15
    expect(rule).not.toMatch(/bottom\s*:/);
  });
});
