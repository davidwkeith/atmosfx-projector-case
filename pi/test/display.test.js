import { describe, expect, it, vi } from "vitest";
import { DisplayWatch, displayConnected } from "../src/display.js";

const sysfs = (tree) => ({
  readdir: async () => {
    if (!tree) throw new Error("ENOENT");
    return Object.keys(tree);
  },
  readFile: async (path) => {
    const name = path.split("/").at(-2);
    if (tree[name] === undefined) throw new Error("ENOENT");
    return `${tree[name]}\n`;
  },
});

describe("HDMI connector status", () => {
  const tree = { card1: undefined, "card1-HDMI-A-1": "disconnected", "card1-HDMI-A-2": "connected", "card1-Writeback-1": "unknown" };

  it("reads the chosen connector", async () => {
    expect(await displayConnected({ connector: "HDMI-A-1", fs: sysfs(tree) })).toBe(false);
    expect(await displayConnected({ connector: "HDMI-A-2", fs: sysfs(tree) })).toBe(true);
  });

  it("with no connector chosen, any HDMI output counts", async () => {
    expect(await displayConnected({ fs: sysfs(tree) })).toBe(true);
    expect(await displayConnected({ fs: sysfs({ "card0-HDMI-A-1": "disconnected" }) })).toBe(false);
  });

  it("is unknown off a Pi or for a connector that is not there", async () => {
    expect(await displayConnected({ fs: sysfs(null) })).toBeNull();
    expect(await displayConnected({ connector: "HDMI-A-3", fs: sysfs(tree) })).toBeNull();
  });
});

describe("waiting for the projector to appear", () => {
  function setup(states) {
    let now = 0;
    let i = 0;
    const probe = vi.fn(async () => states[Math.min(i++, states.length - 1)]);
    const sleep = async (ms) => void (now += ms);
    const watch = new DisplayWatch({ probe, sleep, now: () => now });
    const connected = vi.fn();
    watch.on("connected", connected);
    return { watch, probe, connected, elapsed: () => now };
  }

  it("returns as soon as it is connected (a projector powered by the relay a moment ago)", async () => {
    const { watch, elapsed } = setup([false, false, false, true]);
    expect(await watch.wait(20_000)).toBe(true);
    expect(elapsed()).toBe(1500);
  });

  it("does not wait when the state cannot be known", async () => {
    const { watch, probe } = setup([null]);
    expect(await watch.wait(20_000)).toBeNull();
    expect(probe).toHaveBeenCalledTimes(1);
  });

  it("gives up after the limit, then reports the display when it turns up", async () => {
    const { watch, connected, elapsed } = setup([false]);
    expect(await watch.wait(20_000)).toBe(false);
    expect(elapsed()).toBe(20_000);
    const late = setup([false, false, true, true]);
    expect(await late.watch.wait(0)).toBe(false);
    await late.watch.poll();
    expect(late.connected).not.toHaveBeenCalled();
    await late.watch.poll();
    expect(late.connected).toHaveBeenCalledTimes(1);
    await late.watch.poll(); // still connected: once only
    expect(late.connected).toHaveBeenCalledTimes(1);
    expect(connected).not.toHaveBeenCalled();
  });

  it("a one-poll drop of hot-plug detect does not restart playback; an unplug and replug does", async () => {
    const { watch, connected } = setup([true, false, true, false, false, true]);
    for (let n = 0; n < 3; n++) await watch.poll();
    expect(connected).not.toHaveBeenCalled();
    for (let n = 0; n < 3; n++) await watch.poll();
    expect(connected).toHaveBeenCalledTimes(1);
  });
});
