import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DmxControl, PowerArbiter, SacnReceiver, fixtureValues, interpret, multicastGroup, parseSacn, sequenceOk, InternalWrites } from "../src/dmx.js";
import { buildPacket } from "../tools/sacn-packet.mjs";

const cidA = Buffer.alloc(16, 0xaa);
const cidB = Buffer.alloc(16, 0xbb);

describe("E1.31 packet parsing", () => {
  it("parses a valid data packet", () => {
    const p = parseSacn(buildPacket({ universe: 7, levels: [255, 128, 3], sequence: 42, priority: 150, name: "QLC+", cid: cidA }));
    expect(p).toMatchObject({ ok: true, universe: 7, sequence: 42, priority: 150, name: "QLC+", preview: false, terminated: false, startCode: 0 });
    expect(p.cid).toBe("aa".repeat(16));
    expect([...p.slots.subarray(0, 4)]).toEqual([255, 128, 3, 0]);
    expect(p.slots.length).toBe(512);
  });

  it("accepts short universes (fewer than 512 slots)", () => {
    const p = parseSacn(buildPacket({ levels: [9, 8], slots: 24 }));
    expect(p.ok).toBe(true);
    expect(p.slots.length).toBe(24);
  });

  const corrupt = (fn) => {
    const b = buildPacket({ levels: [1] });
    fn(b);
    return parseSacn(b).reason;
  };
  it.each([
    ["too short", () => parseSacn(Buffer.alloc(100)).reason, "length"],
    ["bad preamble", () => corrupt((b) => b.writeUInt16BE(0x0011, 0)), "preamble"],
    ["bad ACN identifier", () => corrupt((b) => (b[4] = 0x42)), "packet identifier"],
    ["root length mismatch", () => corrupt((b) => b.writeUInt16BE(0x7000 | 10, 16)), "root length"],
    ["root flags not 0x7", () => corrupt((b) => (b[16] = (b[16] & 0x0f) | 0x60)), "root length"],
    ["sync/discovery (extended) root vector", () => corrupt((b) => b.writeUInt32BE(8, 18)), "extended (sync/discovery) packet"],
    ["unknown root vector", () => corrupt((b) => b.writeUInt32BE(5, 18)), "root vector"],
    ["framing vector", () => corrupt((b) => b.writeUInt32BE(1, 40)), "framing vector"],
    ["framing length", () => corrupt((b) => b.writeUInt16BE(0x7000 | 5, 38)), "framing length"],
    ["DMP vector", () => corrupt((b) => (b[117] = 0x01)), "DMP header"],
    ["DMP address type", () => corrupt((b) => (b[118] = 0xa0)), "DMP header"],
    ["DMP first address", () => corrupt((b) => b.writeUInt16BE(1, 119)), "DMP header"],
    ["DMP increment", () => corrupt((b) => b.writeUInt16BE(2, 121)), "DMP header"],
    ["property count vs length", () => corrupt((b) => b.writeUInt16BE(100, 123)), "property count"],
    ["universe 0", () => corrupt((b) => b.writeUInt16BE(0, 113)), "universe"],
    ["universe 64000", () => corrupt((b) => b.writeUInt16BE(64000, 113)), "universe"],
    ["priority over 200", () => corrupt((b) => (b[108] = 201)), "priority"],
  ])("rejects %s", (_, get, reason) => expect(get()).toBe(reason));

  it("multicast group per universe", () => {
    expect(multicastGroup(1)).toBe("239.255.0.1");
    expect(multicastGroup(63999)).toBe("239.255.249.255");
  });

  it("sequence rule (ETC's check_sequence): newer, or far enough behind to be a wrap/restart", () => {
    expect(sequenceOk(11, 10)).toBe(true);
    expect(sequenceOk(10, 10)).toBe(false);
    expect(sequenceOk(0, 255)).toBe(true); // wrap
    expect(sequenceOk(5, 250)).toBe(true); // wrap with loss
    expect(sequenceOk(236, 255)).toBe(false); // -19: late packet
    expect(sequenceOk(235, 255)).toBe(true); // -20: treated as restart
  });
});

describe("receiver: sources, merge, timeout", () => {
  let now;
  let rx;
  const send = (opts, ip = "10.0.0.5") => rx.handle(buildPacket({ universe: 1, ...opts }), ip);
  beforeEach(() => {
    now = 0;
    rx = new SacnReceiver({ universe: 1, now: () => now });
  });

  it("ignores other universes, preview data and non-zero start codes", () => {
    expect(send({ universe: 2, cid: cidA })).toBe("other universe");
    expect(send({ preview: true, cid: cidA })).toBe("preview");
    expect(send({ startCode: 0xdd, cid: cidA })).toBe("start code");
    expect(rx.live).toBe(false);
  });

  it("goes live on the first packet and drops out-of-order ones", () => {
    const live = vi.fn();
    rx.on("live", live);
    expect(send({ cid: cidA, sequence: 10, levels: [1] })).toBe("ok");
    expect(send({ cid: cidA, sequence: 9, levels: [2] })).toBe("out of sequence");
    expect(rx.merged()[0]).toBe(1);
    expect(send({ cid: cidA, sequence: 11, levels: [3] })).toBe("ok");
    expect(rx.merged()[0]).toBe(3);
    expect(live).toHaveBeenCalledWith(true);
  });

  it("follows the sequence through a wrap", () => {
    let seq = 250;
    for (let i = 0; i < 10; i++) expect(send({ cid: cidA, sequence: seq++ & 0xff })).toBe("ok");
  });

  it("highest priority wins", () => {
    send({ cid: cidA, priority: 100, levels: [255, 255] });
    send({ cid: cidB, priority: 150, levels: [10, 0] });
    expect([...rx.merged().subarray(0, 2)]).toEqual([10, 0]);
  });

  it("equal priorities merge highest-takes-precedence per slot", () => {
    send({ cid: cidA, priority: 100, levels: [255, 0, 7] });
    send({ cid: cidB, priority: 100, levels: [10, 200, 9] });
    expect([...rx.merged().subarray(0, 3)]).toEqual([255, 200, 9]);
  });

  it("a source silent for 2.5 s is dropped; the other takes over; all gone = not live", () => {
    const live = vi.fn();
    rx.on("live", live);
    send({ cid: cidA, priority: 150, levels: [1] });
    now = 1000;
    send({ cid: cidB, priority: 100, levels: [2] });
    now = 2500;
    rx.tick();
    expect(rx.merged()[0]).toBe(1); // exactly 2.5 s: still there
    now = 2501;
    rx.tick();
    expect(rx.merged()[0]).toBe(2);
    now = 3501;
    rx.tick();
    expect(rx.merged()).toBeNull();
    expect(live.mock.calls).toEqual([[true], [false]]);
  });

  it("Stream_Terminated drops the source at once and its data is not used", () => {
    send({ cid: cidA, sequence: 1, levels: [50] });
    expect(send({ cid: cidA, sequence: 2, terminated: true, levels: [99] })).toBe("terminated");
    expect(rx.live).toBe(false);
    expect(rx.merged()).toBeNull();
  });

  it("reports sources for the Settings page", () => {
    send({ cid: cidA, name: "FPP", priority: 120 }, "192.168.1.9");
    now = 1000;
    send({ cid: cidA, name: "FPP", priority: 120, sequence: 1 }, "192.168.1.9");
    expect(rx.status().sources).toEqual([{ name: "FPP", ip: "192.168.1.9", priority: 120, packetsPerSecond: 2, lastSeenMs: 0 }]);
  });
});

describe("fixture channel map", () => {
  it("reads 8 channels from the start address", () => {
    const levels = new Uint8Array(512);
    levels.set([1, 2, 3, 4, 5, 6, 7, 8], 99);
    expect(fixtureValues(levels, 100)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(fixtureValues(levels, 505)).toHaveLength(8);
  });
  it.each([
    [[0, 0, 0, 0, 0, 0, 255, 0], { power: false, mode: "loop", clip: 0, trigger: false, volume: 0, muted: false, dimmer: 255 }],
    [[127, 127, 0, 127, 128, 127, 0, 0], { power: false, mode: "loop", trigger: false, volume: 50, muted: false, dimmer: 0 }],
    [[128, 128, 3, 128, 255, 128, 128, 99], { power: true, mode: "scare", clip: 3, trigger: true, volume: 100, muted: true, dimmer: 128 }],
  ])("%j", (values, want) => expect(interpret(values)).toMatchObject(want));
});

describe("DMX control: handover, pacing, trigger", () => {
  let now;
  let act;
  let dmx;
  beforeEach(() => {
    vi.useFakeTimers();
    now = 0;
    vi.setSystemTime(0);
    act = { takeover: vi.fn(), release: vi.fn(), setPower: vi.fn(), setMode: vi.fn(), setClip: vi.fn(), trigger: vi.fn(), setVolume: vi.fn(), setDimmer: vi.fn() };
    dmx = new DmxControl({ act, holdMs: 5000, now: () => Date.now() });
  });
  afterEach(() => vi.useRealTimers());
  const frame = (v) => dmx.frame(v);
  const ch = (power = 0, mode = 0, clip = 0, trig = 0, vol = 0, mute = 0, dim = 255) => [power, mode, clip, trig, vol, mute, dim, 0];

  it("takes control when live and applies the channels at once", () => {
    dmx.live(true);
    frame(ch(255, 200, 2, 0, 128, 0, 255));
    expect(act.takeover).toHaveBeenCalledTimes(1);
    expect(act.setPower).toHaveBeenCalledWith(true);
    expect(act.setMode).toHaveBeenCalledWith("scare");
    expect(act.setClip).toHaveBeenCalledWith(2);
    expect(act.setVolume).toHaveBeenCalledWith({ level: 50, muted: false });
    expect(dmx.inControl).toBe(true);
  });

  it("ignores frames when not in control", () => {
    frame(ch(255));
    expect(act.setPower).not.toHaveBeenCalled();
  });

  it("releases only after the hold time, and a returning signal cancels the release", async () => {
    dmx.live(true);
    dmx.live(false); // receiver reports data loss (already 2.5 s in)
    await vi.advanceTimersByTimeAsync(4999);
    expect(dmx.inControl).toBe(true);
    dmx.live(true); // back before the hold ended
    await vi.advanceTimersByTimeAsync(10_000);
    expect(act.release).not.toHaveBeenCalled();
    dmx.live(false);
    await vi.advanceTimersByTimeAsync(5000);
    expect(act.release).toHaveBeenCalledTimes(1);
    expect(dmx.inControl).toBe(false);
  });

  it("paces power toggles to one per second, latest value wins", async () => {
    dmx.live(true);
    frame(ch(255));
    frame(ch(0));
    frame(ch(255));
    frame(ch(0));
    expect(act.setPower.mock.calls).toEqual([[true]]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(act.setPower.mock.calls).toEqual([[true], [false]]);
  });

  it("debounces clip select: the value must hold 300 ms", async () => {
    dmx.live(true);
    frame(ch(0, 0, 0));
    for (let c = 1; c <= 5; c++) {
      frame(ch(0, 0, c)); // fader sweep
      await vi.advanceTimersByTimeAsync(100);
    }
    expect(act.setClip.mock.calls).toEqual([[0]]);
    await vi.advanceTimersByTimeAsync(300);
    expect(act.setClip.mock.calls).toEqual([[0], [5]]);
  });

  it("rate-limits volume and dimmer to 10 per second", async () => {
    dmx.live(true);
    for (let i = 0; i < 44; i++) frame(ch(0, 0, 0, 0, i, 0, 255 - i)); // one second of 44 Hz frames
    expect(act.setVolume).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(100);
    expect(act.setVolume).toHaveBeenCalledTimes(2);
    expect(act.setVolume).toHaveBeenLastCalledWith({ level: Math.round((43 / 255) * 100), muted: false });
    expect(act.setDimmer).toHaveBeenLastCalledWith(212);
  });

  it("trigger fires on the rising edge through 128 only", () => {
    dmx.live(true);
    frame(ch(255, 255, 0, 0));
    frame(ch(255, 255, 0, 127));
    frame(ch(255, 255, 0, 128));
    frame(ch(255, 255, 0, 255));
    frame(ch(255, 255, 0, 10));
    frame(ch(255, 255, 0, 200));
    expect(act.trigger).toHaveBeenCalledTimes(2);
  });

  it("a trigger already high at takeover is not an edge", () => {
    dmx.live(true);
    frame(ch(255, 255, 0, 255));
    expect(act.trigger).not.toHaveBeenCalled();
  });
});

describe("power arbiter", () => {
  it("while DMX is in control, only DMX (and thermal protection, via its own path) changes power", () => {
    const dmx = { inControl: false };
    const apply = vi.fn();
    const arbiter = new PowerArbiter({ dmx, apply, actual: () => true });
    expect(arbiter.request("matter", false)).toEqual({ ok: true });
    dmx.inControl = true;
    expect(arbiter.request("matter", false)).toEqual({ ok: false, actual: true, reason: "DMX is in control" });
    expect(arbiter.request("web", false)).toMatchObject({ ok: false });
    expect(arbiter.request("schedule", false)).toMatchObject({ ok: false });
    expect(arbiter.request("dmx", false)).toEqual({ ok: true });
    expect(apply.mock.calls).toEqual([
      [false, "matter"],
      [false, "dmx"],
    ]);
  });
});

it("thermal protection switches off even under DMX, and blocks switching on while tripped", () => {
  const dmx = { inControl: true };
  const apply = vi.fn();
  let tripped = null;
  const arbiter = new PowerArbiter({ dmx, apply, actual: () => false, blocked: () => tripped });
  expect(arbiter.request("thermal", false)).toEqual({ ok: true });
  tripped = "too hot";
  expect(arbiter.request("dmx", true)).toEqual({ ok: false, actual: false, reason: "too hot" });
  expect(arbiter.request("dmx", false)).toEqual({ ok: true });
});

describe("our own writes to the Matter attribute", () => {
  it("a write is matched to the change event it causes, once", async () => {
    const w = new InternalWrites();
    let fire;
    const done = w.run(true, () => new Promise((r) => (fire = r)));
    expect(w.take(false)).toBe(false); // a controller's "off" racing ours is not ours
    expect(w.take(true)).toBe(true);
    expect(w.take(true)).toBe(false); // the next "on" comes from a controller
    fire();
    await done;
    expect(w.pending).toBe(0);
  });

  it("a write that causes no event expires instead of waving the next controller write through", async () => {
    vi.useFakeTimers();
    try {
      const w = new InternalWrites({ graceMs: 1000 });
      await w.run(true, async () => {}); // attribute already true: no change event
      expect(w.pending).toBe(1);
      await vi.advanceTimersByTimeAsync(1000);
      expect(w.pending).toBe(0);
      expect(w.take(true)).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("a failed write leaves nothing behind", async () => {
    const w = new InternalWrites();
    await expect(w.run(false, async () => { throw new Error("no such endpoint"); })).rejects.toThrow("no such endpoint");
    expect(w.pending).toBe(0);
  });
});
