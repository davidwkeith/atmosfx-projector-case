import { describe, expect, it, vi } from "vitest";
import { SelfCheck, evaluateChecks, parseBoardModel, parseEdid, summarize } from "../src/selfcheck.js";

/** A 128-byte EDID base block: preferred mode 1920 x 1080 at 60 Hz (CEA 148.5 MHz timing) and a name. */
function edid({ name = "S2-TEK TV", maker = "STK" } = {}) {
  const b = Buffer.alloc(128);
  Buffer.from([0x00, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x00]).copy(b, 0);
  const id = [...maker].reduce((v, c) => (v << 5) | (c.charCodeAt(0) - 64), 0);
  b.writeUInt16BE(id, 8);
  // Detailed timing: 148.5 MHz, 1920 + 280, 1080 + 45.
  Buffer.from([0x02, 0x3a, 0x80, 0x18, 0x71, 0x38, 0x2d, 0x40]).copy(b, 54);
  // Monitor name descriptor.
  b[72 + 3] = 0xfc;
  Buffer.from(`${name}\n`.padEnd(13, " "), "latin1").copy(b, 72 + 5);
  return b;
}

const good = {
  board: { model: "Raspberry Pi 3 Model B Rev 1.2\0" },
  audio: { card: "DigiAMP", cardsText: " 0 [vc4hdmi       ]: vc4-hdmi - vc4-hdmi\n 1 [DigiAMP        ]: IQaudIODAC - DigiAMP\n" },
  display: { connected: true, edid: edid() },
  projector: { mode: "cec", cec: "supported" },
  pir: { enabled: true, available: true, running: true, seen: true },
  thermal: { temp: 51.24, warnC: 70, throttled: 0 },
  network: { ethernet: false, wifi: { connected: true, ssid: "Home", signalDbm: -55, verdict: "good" } },
  clock: { synced: true },
  media: { problem: null, clips: 3 },
};
const byId = (checks) => Object.fromEntries(checks.map((c) => [c.id, c]));

describe("board model", () => {
  it("knows every supported board", () => {
    expect(parseBoardModel("Raspberry Pi 3 Model B Plus Rev 1.3\0").board).toBe("pi3");
    expect(parseBoardModel("Raspberry Pi 4 Model B Rev 1.4").board).toBe("pi4");
    expect(parseBoardModel("Raspberry Pi 5 Model B Rev 1.0").board).toBe("pi5");
    expect(parseBoardModel("Raspberry Pi Zero 2 W Rev 1.0").board).toBe("zero2w");
  });

  it("is null off a Pi", () => {
    expect(parseBoardModel("")).toEqual({ model: null, board: null });
    expect(parseBoardModel("Raspberry Pi Model B Rev 2").board).toBeNull();
  });
});

describe("EDID", () => {
  it("reads the maker, name and preferred mode", () => {
    expect(parseEdid(edid())).toEqual({ maker: "STK", name: "S2-TEK TV", width: 1920, height: 1080, hz: 60 });
  });

  it("is null for an empty or broken EDID", () => {
    expect(parseEdid(null)).toBeNull();
    expect(parseEdid(Buffer.alloc(0))).toBeNull();
    expect(parseEdid(Buffer.alloc(128))).toBeNull();
  });
});

describe("evaluating the checks", () => {
  it("passes a healthy setup", () => {
    const checks = evaluateChecks(good);
    expect(checks.filter((c) => c.status !== "pass")).toEqual([]);
    const c = byId(checks);
    expect(c.display.detail).toBe("S2-TEK TV, 1920 × 1080 at 60 Hz");
    expect(c.temp.detail).toBe("51.2 °C");
    expect(c.media.detail).toBe("3 in the playlist");
    expect(byId(evaluateChecks({ ...good, media: { mode: "scare", clips: 1 } })).media.detail).toBe("A calm clip and 1 scare clip");
  });

  it("gives every check a fix link", () => {
    for (const c of evaluateChecks(good)) expect(c.href, c.id).toMatch(/^#\//);
  });

  it("says unknown, not fail, for anything it could not read", () => {
    const c = byId(evaluateChecks({}));
    for (const id of ["board", "audio", "display", "cec", "power", "temp"]) expect(c[id].status, id).toBe("unknown");
    expect(c.pir.status).toBe("off"); // disabled by default
  });

  it("explains a missing amplifier", () => {
    const c = byId(evaluateChecks({ ...good, audio: { card: "DigiAMP", cardsText: " 0 [vc4hdmi ]: vc4-hdmi\n" } }));
    expect(c.audio).toMatchObject({ status: "fail", detail: 'Sound card "DigiAMP" not found' });
    expect(c.audio.fix).toMatch(/seated on the header/);
  });

  it("counts a sleeping projector that left its EDID as connected", () => {
    const c = byId(evaluateChecks({ ...good, display: { connected: false, edid: edid() } }));
    expect(c.display).toMatchObject({ status: "pass", detail: "S2-TEK TV, 1920 × 1080 at 60 Hz (asleep or switched off)" });
    expect(byId(evaluateChecks({ ...good, display: { connected: false, edid: null } })).display.status).toBe("fail");
  });

  it("covers each CEC outcome", () => {
    const cec = (projector) => byId(evaluateChecks({ ...good, projector })).cec.status;
    expect(cec({ mode: "cec", cec: "no-response" })).toBe("fail");
    expect(cec({ mode: "cec", cec: "no-device" })).toBe("unknown");
    expect(cec({ mode: "hdmi-off", cec: null })).toBe("unknown");
    expect(cec({ mode: "relay-ir", cec: "no-response" })).toBe("off");
  });

  it("waits for the motion sensor to see something", () => {
    const pir = (p) => byId(evaluateChecks({ ...good, pir: { ...good.pir, ...p } })).pir.status;
    expect(pir({ seen: false })).toBe("unknown");
    expect(pir({ running: false })).toBe("fail");
    expect(pir({ available: false })).toBe("fail");
    expect(pir({ enabled: false })).toBe("off");
  });

  it("fails on under-voltage now or since boot, and on heat", () => {
    expect(byId(evaluateChecks({ ...good, thermal: { ...good.thermal, throttled: 0x1 } })).power.detail).toBe("Under-voltage now");
    expect(byId(evaluateChecks({ ...good, thermal: { ...good.thermal, throttled: 0x50000 } })).power.detail).toBe("Under-voltage since start-up");
    expect(byId(evaluateChecks({ ...good, thermal: { ...good.thermal, temp: 71 } })).temp.status).toBe("fail");
  });

  it("fails with no network, no time or nothing to play", () => {
    const c = byId(evaluateChecks({ ...good, network: { wifi: { connected: false } }, clock: { synced: false }, media: { problem: "the playlist is empty" } }));
    expect([c.network.status, c.clock.status, c.media.status]).toEqual(["fail", "fail", "fail"]);
    expect(c.media.detail).toBe("the playlist is empty");
    expect(byId(evaluateChecks({ ...good, network: { ethernet: true } })).network.detail).toBe("Ethernet");
  });

  it("summarizes", () => {
    expect(summarize([{ status: "pass" }, { status: "fail" }, { status: "unknown" }, { status: "off" }, { status: "pass" }])).toEqual({ pass: 2, fail: 1, off: 1, unknown: 1, total: 5 });
  });
});

describe("running the checks", () => {
  it("runs one at a time and keeps the last result", async () => {
    let release;
    const gather = vi.fn(() => new Promise((r) => (release = () => r(good))));
    const sc = new SelfCheck({ gather, now: () => Date.UTC(2026, 9, 15, 18) });
    const done = vi.fn();
    sc.on("done", done);
    expect(sc.last).toBeNull();
    const a = sc.run();
    const b = sc.run();
    expect(sc.running).toBe(true);
    release();
    expect(await a).toBe(await b);
    expect(gather).toHaveBeenCalledTimes(1);
    expect(sc.running).toBe(false);
    expect(sc.last).toMatchObject({ at: "2026-10-15T18:00:00.000Z", summary: { pass: 10, fail: 0, total: 10 } });
    expect(done).toHaveBeenCalledWith(sc.last);
  });

  it("can run again after a failed gather", async () => {
    const gather = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValue(good);
    const sc = new SelfCheck({ gather });
    await expect(sc.run()).rejects.toThrow("boom");
    await expect(sc.run()).resolves.toMatchObject({ summary: { pass: 10 } });
  });
});
