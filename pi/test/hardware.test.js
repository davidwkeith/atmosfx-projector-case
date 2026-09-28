import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GpioOut, gpiosetArgs } from "../src/gpio.js";
import { Ir, codeFromCapture, decodeNec, lircFeatures, parseCapture, parseIrCode } from "../src/ir.js";
import { Pir, RESERVED_GPIOS, gpiomonMajor, pirArgs } from "../src/pir.js";
import { Projector, parsePhysicalAddress, parsePowerStatus } from "../src/projector.js";

class FakeChild extends EventEmitter {
  stdout = new PassThrough();
  stderr = new PassThrough();
  signals = [];
  kill(signal) {
    this.signals.push(signal);
    setImmediate(() => this.emit("exit", null, signal));
  }
}

const quiet = { info() {}, warn() {}, error() {} };

// --- CEC / relay / IR sequences

function projectorSetup({ mode = "cec", replies = {}, settleMs = 3000, code = "nec:0x40bf", doublePress = false } = {}) {
  const calls = [];
  const run = vi.fn(async (cmd, args) => {
    const key = args.slice(2).join(" ");
    calls.push(`${cmd} ${args.join(" ")}`);
    const reply = typeof replies[key] === "function" ? replies[key]() : replies[key];
    if (reply instanceof Error) throw reply;
    return { stdout: reply ?? "" };
  });
  const relay = { set: vi.fn(async (closed) => calls.push(`relay ${closed ? "closed" : "open"}`)) };
  const ir = { send: vi.fn(async (c) => calls.push(`ir ${c}`)) };
  const blank = vi.fn(async (down) => calls.push(`blank ${down}`));
  let setting = mode;
  const p = new Projector({
    run,
    mode: () => setting,
    device: () => "/dev/cec0",
    osdName: "VideoFX-BEEF-and-more",
    blank,
    relay,
    ir,
    settleMs: () => settleMs,
    irCode: () => code,
    doublePress: () => doublePress,
    retryDelayMs: 8000,
    pressGapMs: 1500,
    log: quiet,
  });
  return { p, calls, run, relay, ir, blank, setMode: (m) => (setting = m) };
}

const CONFIGURED = "Physical Address           : 1.0.0.0\n";
const PWR = (state) => `Received from TV (0): REPORT_POWER_STATUS (0x90):\n\t\tpwr-state: ${state} (0x00)\n`;

describe("CEC", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("parses cec-ctl output", () => {
    expect(parsePowerStatus(PWR("on"))).toBe("on");
    expect(parsePowerStatus(PWR("to-on"))).toBe("to-on");
    expect(parsePowerStatus("Transmit from Playback Device 1 to TV (4 to 0):\nGIVE_DEVICE_POWER_STATUS (0x8f)\n\tTx, Not Acknowledged (1)")).toBeUndefined();
    expect(parsePhysicalAddress(CONFIGURED)).toBe("1.0.0.0");
    expect(parsePhysicalAddress("Physical Address : f.f.f.f")).toBeNull();
  });

  it("on: configure as playback device, Image View On, Text View On, Active Source, then ask power status", async () => {
    const { p, calls } = projectorSetup({ replies: { "--playback --osd-name VideoFX-BEEF-a": CONFIGURED, "--to 0 --give-device-power-status": PWR("on") } });
    const state = await p.on();
    expect(calls).toEqual([
      "blank false",
      "cec-ctl -d /dev/cec0 --playback --osd-name VideoFX-BEEF-a",
      "cec-ctl -d /dev/cec0 --to 0 --image-view-on",
      "cec-ctl -d /dev/cec0 --to 0 --text-view-on",
      "cec-ctl -d /dev/cec0 --to 0 --active-source phys-addr=1.0.0.0",
      "cec-ctl -d /dev/cec0 --to 0 --give-device-power-status",
    ]);
    expect(state).toMatchObject({ cec: "supported", power: "on", effective: "cec", notice: null });
  });

  it("off: Standby", async () => {
    const { p, calls } = projectorSetup({ replies: { "--playback --osd-name VideoFX-BEEF-a": CONFIGURED, "--to 0 --give-device-power-status": PWR("on") } });
    await p.on();
    calls.length = 0;
    expect(await p.off()).toMatchObject({ power: "standby" });
    expect(calls).toEqual(["cec-ctl -d /dev/cec0 --to 0 --standby"]);
  });

  it("configures the adapter once, and CEC is not touched between power changes", async () => {
    const { p, run } = projectorSetup({ replies: { "--playback --osd-name VideoFX-BEEF-a": CONFIGURED, "--to 0 --give-device-power-status": PWR("on") } });
    await p.on();
    await p.off();
    await p.on();
    expect(run.mock.calls.filter((c) => c[1].includes("--playback"))).toHaveLength(1);
    const before = run.mock.calls.length;
    p.state;
    p.state; // status polls
    await vi.advanceTimersByTimeAsync(60_000);
    expect(run.mock.calls.length).toBe(before);
  });

  it("retries the wake once, later, if the projector isn't on yet", async () => {
    let n = 0;
    const { p, calls } = projectorSetup({
      replies: { "--playback --osd-name VideoFX-BEEF-a": CONFIGURED, "--to 0 --give-device-power-status": () => PWR(++n === 1 ? "standby" : "to-on") },
    });
    await p.on();
    const count = () => calls.filter((c) => c.endsWith("--image-view-on")).length;
    expect(count()).toBe(1);
    await vi.advanceTimersByTimeAsync(7999);
    expect(count()).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(count()).toBe(2);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(count()).toBe(2); // only once
    expect(p.state.power).toBe("to-on");
  });

  it("an off before the retry cancels it", async () => {
    const { p, calls } = projectorSetup({
      replies: { "--playback --osd-name VideoFX-BEEF-a": CONFIGURED, "--to 0 --give-device-power-status": PWR("standby") },
    });
    await p.on();
    await p.off();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(calls.filter((c) => c.endsWith("--image-view-on"))).toHaveLength(1);
  });

  it("no answer: falls back to hdmi-off with a notice, and tries CEC again at the next power-on", async () => {
    const { p, calls } = projectorSetup({ replies: { "--playback --osd-name VideoFX-BEEF-a": CONFIGURED, "--to 0 --give-device-power-status": "Tx, Not Acknowledged (1)" } });
    const on = await p.on();
    expect(on).toMatchObject({ cec: "no-response", effective: "hdmi-off", notice: expect.stringMatching(/hdmi-off/) });
    calls.length = 0;
    expect(await p.off()).toMatchObject({ power: "no-signal" });
    expect(calls).toEqual(["blank true"]);
    calls.length = 0;
    await p.on();
    expect(calls).toContain("cec-ctl -d /dev/cec0 --to 0 --image-view-on");
  });

  it("no CEC device (cec-ctl fails): same fallback", async () => {
    const { p } = projectorSetup({ replies: { "--playback --osd-name VideoFX-BEEF-a": new Error("No such file or directory") } });
    expect(await p.on()).toMatchObject({ cec: "no-response", effective: "hdmi-off" });
  });

  it("hdmi-off keeps the signal when asked (pairing code on screen)", async () => {
    const { p, calls } = projectorSetup({ mode: "hdmi-off" });
    await p.on();
    calls.length = 0;
    await p.off({ keepSignal: true });
    expect(calls).toEqual([]);
    await p.off();
    expect(calls).toEqual(["blank true"]);
  });

  it("none: never touches CEC or the signal beyond unblanking", async () => {
    const { p, calls } = projectorSetup({ mode: "none" });
    await p.on();
    await p.off();
    expect(calls).toEqual(["blank false"]);
  });
});

describe("relay modes", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("init opens the relay (projector off until the service decides)", async () => {
    const { p, calls } = projectorSetup({ mode: "relay" });
    await p.init();
    expect(calls).toEqual(["relay open"]);
    const cec = projectorSetup({ mode: "cec" });
    await cec.p.init();
    expect(cec.calls).toEqual([]);
  });

  it("relay: close, wait the settle time, nothing else; off opens it", async () => {
    const { p, calls, ir } = projectorSetup({ mode: "relay", settleMs: 3000 });
    let done = false;
    p.on().then(() => (done = true));
    await vi.advanceTimersByTimeAsync(2999);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
    expect(calls).toEqual(["blank false", "relay closed"]);
    expect(ir.send).not.toHaveBeenCalled();
    await p.off();
    expect(calls.at(-1)).toBe("relay open");
  });

  it("relay-ir: close, settle, one IR press", async () => {
    const { p, calls } = projectorSetup({ mode: "relay-ir", settleMs: 5000 });
    const on = p.on();
    await vi.advanceTimersByTimeAsync(4999);
    expect(calls).toEqual(["blank false", "relay closed"]);
    await vi.advanceTimersByTimeAsync(1);
    await on;
    expect(calls).toEqual(["blank false", "relay closed", "ir nec:0x40bf"]);
  });

  it("relay-ir with two presses: second press after the gap", async () => {
    const { p, calls } = projectorSetup({ mode: "relay-ir", settleMs: 1000, doublePress: true });
    const on = p.on();
    await vi.advanceTimersByTimeAsync(1000);
    expect(calls.filter((c) => c.startsWith("ir"))).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1499);
    expect(calls.filter((c) => c.startsWith("ir"))).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    await on;
    expect(calls.filter((c) => c.startsWith("ir"))).toHaveLength(2);
  });

  it("relay-ir with no code: relay only, with a notice", async () => {
    const { p, ir } = projectorSetup({ mode: "relay-ir", settleMs: 0, code: "" });
    const on = p.on();
    await vi.advanceTimersByTimeAsync(0);
    expect(await on).toMatchObject({ notice: expect.stringMatching(/no IR power code/) });
    expect(ir.send).not.toHaveBeenCalled();
  });

  it("relay-ir off: just opens the relay (no IR)", async () => {
    const { p, calls } = projectorSetup({ mode: "relay-ir" });
    await p.off();
    expect(calls).toEqual(["relay open"]);
  });
});

describe("IR codes", () => {
  it.each([
    ["nec:0x40bf", "nec:0x40bf"],
    ["NEC:0X40BF", "nec:0x40bf"],
    ["rc5:7681", "rc5:0x1e01"],
    ["necx:0xff00ff", "necx:0xff00ff"],
    ["raw:+9000 -4500 +560", "raw:+9000 -4500 +560"],
    ["raw: 9000, 4500, 560", "raw:+9000 -4500 +560"],
    ["", ""],
  ])("accepts %j", (input, out) => expect(parseIrCode(input)).toBe(out));

  it.each([
    ["foo:0x1", /unknown protocol/],
    ["nec", /protocol:scancode/],
    ["nec:0x1ffffffff", /protocol:scancode|too large/],
    ["raw:+9000 -4500", /odd/],
    ["raw:+9000", /3-511/],
    ["raw:-9000 +4500 -560", /pulse/],
    ["raw:+9000 -4500 +abc", /not a pulse/],
    ["raw:+9000 -4500 +900000", /out of range/],
  ])("rejects %j", (input, msg) => expect(() => parseIrCode(input)).toThrow(msg));

  // Build an NEC frame: 9 ms / 4.5 ms leader, 32 bits LSB first, stop pulse.
  function necCapture(bytes, jitter = 1) {
    const v = [9000 * jitter, 4500];
    for (const b of bytes) for (let i = 0; i < 8; i++) v.push(562 * jitter, (b >> i) & 1 ? 1687 : 562);
    v.push(562, 40000);
    return v.map((n, i) => `${i % 2 ? "-" : "+"}${Math.round(n)}`).join(" ") + "\n";
  }

  it("decodes NEC like the kernel encodes it: nec, necx, nec32", () => {
    expect(decodeNec(parseCapture(necCapture([0x40, 0xbf, 0x12, 0xed])))).toBe("nec:0x4012");
    expect(decodeNec(parseCapture(necCapture([0x40, 0x3f, 0x12, 0xed])))).toBe("necx:0x403f12");
    expect(decodeNec(parseCapture(necCapture([0x40, 0xbf, 0x12, 0x00])))).toBe("nec32:0x40bf1200");
    expect(decodeNec(parseCapture(necCapture([0x40, 0xbf, 0x12, 0xed], 1.15)))).toBe("nec:0x4012"); // sloppy timing
  });

  it("stores raw when it isn't NEC, dropping the trailing timeout", () => {
    const rc5ish = "+889 -889 +1778 -1778 +889 -125000\n";
    expect(codeFromCapture(rc5ish)).toBe("raw:+889 -889 +1778 -1778 +889");
    expect(codeFromCapture("# nothing\n")).toBeNull();
  });

  it("reads ir-ctl -f", () => {
    expect(lircFeatures("Send features /dev/lirc0:\n - Device can send raw IR\n")).toEqual({ send: true, receive: false });
    expect(lircFeatures("Receive features /dev/lirc1:\n - Device can receive raw IR\n")).toEqual({ send: false, receive: true });
  });

  it("sends a scancode through the kernel encoder, and raw via a temp file", async () => {
    const run = vi.fn(async () => ({ stdout: "" }));
    const ir = new Ir({ run, spawn: vi.fn(), txDevice: async () => "/dev/lirc0", rxDevice: async () => "/dev/lirc1", tmpDir: process.env.TMPDIR ?? "/tmp" });
    await ir.send("nec:0x40bf");
    expect(run).toHaveBeenLastCalledWith("ir-ctl", ["-d", "/dev/lirc0", "--scancode=nec:0x40bf"]);
    await ir.send("raw:+9000 -4500 +560");
    expect(run.mock.calls.at(-1)[1].slice(0, 3)).toEqual(["-d", "/dev/lirc0", "--carrier=38000"]);
    await expect(ir.send("")).rejects.toThrow(/no IR code/);
    const none = new Ir({ run, spawn: vi.fn(), txDevice: async () => null, rxDevice: async () => null, tmpDir: "/tmp" });
    await expect(none.send("nec:0x1")).rejects.toThrow(/no IR transmitter/);
  });

  it("learns one press: decodes it, or null on timeout", async () => {
    const child = new FakeChild();
    const spawn = vi.fn(() => child);
    const ir = new Ir({ run: vi.fn(), spawn, txDevice: async () => null, rxDevice: async () => "/dev/lirc1", tmpDir: "/tmp" });
    const learning = ir.learn({ timeoutMs: 10_000 });
    await new Promise((r) => setImmediate(r));
    expect(spawn).toHaveBeenCalledWith("ir-ctl", ["-d", "/dev/lirc1", "--receive", "--oneshot"], expect.any(Object));
    child.stdout.write(necCapture([0x40, 0xbf, 0x12, 0xed]));
    child.emit("exit", 0, null);
    expect(await learning).toBe("nec:0x4012");

    const quietChild = new FakeChild();
    const ir2 = new Ir({ run: vi.fn(), spawn: () => quietChild, txDevice: async () => null, rxDevice: async () => "/dev/lirc1", tmpDir: "/tmp" });
    expect(await ir2.learn({ timeoutMs: 20 })).toBeNull();
  });
});

describe("GPIO output (relay)", () => {
  it("builds gpioset args for libgpiod 2 and 1", () => {
    expect(gpiosetArgs(2, 27, true, true)).toEqual(["--consumer=videofx-relay", "--active-low", "GPIO27=1"]);
    expect(gpiosetArgs(2, 27, false, false)).toEqual(["--consumer=videofx-relay", "GPIO27=0"]);
    expect(gpiosetArgs(1, 27, true, true)).toEqual(["--mode=signal", "--active-low", "gpiochip0", "27=1"]);
  });

  it("replaces the holder process on change, waiting for the old one to exit", async () => {
    const children = [];
    const spawn = vi.fn(() => {
      const c = new FakeChild();
      children.push(c);
      return c;
    });
    const out = new GpioOut({ spawn, argsFor: (v) => [`GPIO27=${v ? 1 : 0}`], log: quiet });
    await out.set(false);
    await out.set(false); // no-op
    expect(spawn).toHaveBeenCalledTimes(1);
    await out.set(true);
    expect(children[0].signals).toEqual(["SIGTERM"]);
    expect(spawn.mock.calls.map((c) => c[1][0])).toEqual(["GPIO27=0", "GPIO27=1"]);
    expect(out.value).toBe(true);
  });
});

describe("PIR", () => {
  it("parses gpiomon versions and builds args", () => {
    expect(gpiomonMajor("gpiomon (libgpiod) v2.2.1\nCopyright")).toBe(2);
    expect(gpiomonMajor("gpiomon (libgpiod) v1.6.3")).toBe(1);
    expect(pirArgs(2, 17, 50)).toEqual(["--consumer=videofx-pir", "--edges=both", "--bias=pull-down", "--debounce-period=50ms", "--format=%e", "GPIO17"]);
    expect(pirArgs(1, 17, 50)).toEqual(["-B", "pull-down", "-r", "-f", "-F", "%e", "gpiochip0", "17"]);
    expect(RESERVED_GPIOS).toEqual([0, 1, 2, 3, 4, 18, 19, 20, 21]);
  });

  it("reports occupancy and motion, debounced, and restarts gpiomon if it dies", async () => {
    let now = 0;
    const children = [];
    const pir = new Pir({
      spawn: () => {
        const c = new FakeChild();
        children.push(c);
        return c;
      },
      args: ["GPIO17"],
      debounceMs: 50,
      now: () => now,
      setTimeout: (fn) => (now += 5000, setImmediate(fn)),
      log: quiet,
    });
    const changes = [];
    let motions = 0;
    pir.on("change", (o) => changes.push(o));
    pir.on("motion", () => motions++);
    pir.start();
    const line = (s) => children.at(-1).stdout.write(s + "\n");
    now = 1000;
    line("1");
    now = 1010;
    line("2"); // bounce, ignored
    now = 1020;
    line("1");
    now = 4000;
    line("2"); // v2 falling
    now = 9000;
    line("1");
    now = 9500;
    line("0"); // v1 falling
    await new Promise((r) => setImmediate(r));
    expect(changes).toEqual([true, false, true, false]);
    expect(motions).toBe(2);
    line("1");
    await new Promise((r) => setImmediate(r));
    children.at(-1).emit("exit", 1);
    expect(changes.at(-1)).toBe(false); // cleared when the monitor dies
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    expect(children).toHaveLength(2);
    pir.stop();
  });
});
