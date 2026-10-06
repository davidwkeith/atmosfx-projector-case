import { describe, expect, it, vi } from "vitest";
import { DEFAULT_VOLUME, Volume, amixerArgs, clampLevel } from "../src/volume.js";

function setup(saved, opts = {}) {
  let disk = saved;
  const store = { load: vi.fn(() => disk), save: vi.fn((v) => (disk = v)) };
  const apply = vi.fn(async () => {});
  const log = { error: vi.fn() };
  const volume = new Volume({ store, apply, log, ...opts });
  return { volume, store, apply, log, disk: () => disk };
}

describe("clampLevel", () => {
  it.each([
    [30, 30],
    [0, 0],
    [100, 100],
    [-5, 0],
    [250, 100],
    [42.6, 43],
    ["55", 55],
  ])("%j -> %j", (input, out) => expect(clampLevel(input)).toBe(out));

  it.each([NaN, Infinity, "loud", "", null, true, undefined, {}])("rejects %j", (bad) => {
    expect(() => clampLevel(bad)).toThrow(/0 to 100/);
  });
});

describe("volume", () => {
  it("starts at the safe default on first boot and applies it", async () => {
    const { volume, apply } = setup(undefined);
    expect(volume.state).toEqual(DEFAULT_VOLUME);
    expect(DEFAULT_VOLUME.level).toBeLessThanOrEqual(30);
    await volume.applyCurrent();
    expect(apply).toHaveBeenCalledWith({ level: 30, muted: false });
  });

  it("honours a configured default", () => {
    expect(setup(undefined, { defaultLevel: 20 }).volume.state.level).toBe(20);
    expect(setup(undefined, { defaultLevel: 500 }).volume.state.level).toBe(100);
  });

  it("restores the saved level and mute after a reboot", () => {
    expect(setup({ level: 72, muted: true }).volume.state).toEqual({ level: 72, muted: true });
  });

  it("clamps a saved level that is out of range, and ignores a corrupt one", () => {
    expect(setup({ level: 900 }).volume.state).toEqual({ level: 100, muted: false });
    expect(setup({ level: "garbage", muted: "yes" }).volume.state).toEqual({ level: 30, muted: false });
  });

  it("persists and applies changes, clamping the level", async () => {
    const { volume, apply, disk } = setup(undefined);
    expect(await volume.set({ level: 150 })).toEqual({ level: 100, muted: false });
    expect(disk()).toEqual({ level: 100, muted: false });
    expect(await volume.set({ muted: true })).toEqual({ level: 100, muted: true });
    expect(disk()).toEqual({ level: 100, muted: true });
    expect(apply).toHaveBeenLastCalledWith({ level: 100, muted: true });
    // the next boot sees the same thing
    expect(setup(disk()).volume.state).toEqual({ level: 100, muted: true });
  });

  it("rejects bad input without changing or saving anything", async () => {
    const { volume, store, apply } = setup({ level: 40, muted: false });
    await expect(volume.set({ level: "loud" })).rejects.toThrow();
    await expect(volume.set({ level: 50, muted: "yes" })).rejects.toThrow(/muted/);
    expect(volume.state).toEqual({ level: 40, muted: false });
    expect(store.save).not.toHaveBeenCalled();
    expect(apply).not.toHaveBeenCalled();
  });

  it("keeps the saved setting when the mixer fails (e.g. amp not detected yet)", async () => {
    const { volume, disk, log } = setup(undefined);
    const failing = new Volume({
      store: { load: () => undefined, save: (v) => (failing.saved = v) },
      apply: async () => {
        throw new Error("amixer: Invalid card number");
      },
      log,
    });
    await expect(failing.set({ level: 10 })).rejects.toThrow(/Invalid card/);
    expect(failing.saved).toEqual({ level: 10, muted: false });
    expect(log.error).toHaveBeenCalled();
    expect(volume.state.level).toBe(30);
    expect(disk()).toBeUndefined();
  });
});

describe("amixerArgs", () => {
  it("addresses the card by name and uses the mapped scale", () => {
    expect(amixerArgs("RPiDigiAMP", "Digital", { level: 30, muted: false })).toEqual([
      "-q", "-c", "RPiDigiAMP", "-M", "sset", "Digital", "30%", "unmute",
    ]);
    expect(amixerArgs("RPiDigiAMP", "Digital", { level: 0, muted: true }).at(-1)).toBe("mute");
  });
});
