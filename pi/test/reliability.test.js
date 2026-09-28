import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { commitFile, writeFileAtomic, writeFileAtomicSync } from "../src/fsutil.js";
import { parseIwLink, parseNmcliDevices, signalVerdict, storageStatus } from "../src/system.js";
import { Watchdog } from "../src/watchdog.js";

describe("durable atomic writes", () => {
  // A fake fs that records the call order.
  function recorder({ failRename = false } = {}) {
    const calls = [];
    const fs = {
      openSync: (p) => (calls.push(`open ${p.endsWith(".tmp") ? "tmp" : p}`), 3),
      writeSync: () => calls.push("write"),
      fsyncSync: () => calls.push("fsync"),
      closeSync: () => calls.push("close"),
      renameSync: () => {
        calls.push("rename");
        if (failRename) throw new Error("EIO");
      },
      unlinkSync: () => calls.push("unlink tmp"),
    };
    return { fs, calls };
  }

  it("writes a temp file, fsyncs it, renames it, then fsyncs the folder", () => {
    const { fs, calls } = recorder();
    writeFileAtomicSync("/data/settings.json", "{}", { fs });
    expect(calls).toEqual(["open tmp", "write", "fsync", "close", "rename", "open /data", "fsync", "close"]);
  });

  it("on failure removes the temp file and leaves the old file alone", () => {
    const { fs, calls } = recorder({ failRename: true });
    expect(() => writeFileAtomicSync("/data/settings.json", "{}", { fs })).toThrow("EIO");
    expect(calls.at(-1)).toBe("unlink tmp");
    expect(calls).not.toContain("open /data");
  });

  describe("on disk", () => {
    let dir;
    beforeEach(async () => (dir = await mkdtemp(join(tmpdir(), "videofx-fs-"))));
    afterEach(() => rm(dir, { recursive: true, force: true }));

    it("sync and async versions replace the file and leave no temp files", async () => {
      writeFileAtomicSync(join(dir, "a.json"), "one");
      writeFileAtomicSync(join(dir, "a.json"), "two");
      await writeFileAtomic(join(dir, "b.m3u"), "#EXTM3U\n");
      expect(await readFile(join(dir, "a.json"), "utf8")).toBe("two");
      expect((await stat(join(dir, "a.json"))).mode & 0o777).toBe(0o600);
      expect((await readdir(dir)).sort()).toEqual(["a.json", "b.m3u"]);
    });

    it("commitFile makes an upload durable and moves it into place", async () => {
      const { writeFile } = await import("node:fs/promises");
      await writeFile(join(dir, ".upload"), "video");
      await commitFile(join(dir, ".upload"), join(dir, "clip.mp4"));
      expect(await readdir(dir)).toEqual(["clip.mp4"]);
    });
  });
});

describe("watchdog pings", () => {
  function setup({ usec = "30000000", healthy = () => null, notify } = {}) {
    const sent = [];
    const timers = [];
    const log = { error: vi.fn(), warn: vi.fn() };
    const wd = new Watchdog({
      notify: notify ?? (async (m) => sent.push(m)),
      watchdogUsec: usec,
      healthy,
      log,
      setInterval: (fn, ms) => (timers.push({ fn, ms }), timers.length),
      clearInterval: vi.fn(),
    });
    return { wd, sent, timers, log };
  }

  it("pings at half of WatchdogSec and says READY once", async () => {
    const { wd, sent, timers } = setup({ usec: "30000000" });
    expect(wd.intervalMs).toBe(15_000);
    await wd.ready();
    await wd.ready();
    expect(sent).toEqual(["READY=1"]);
    expect(timers).toHaveLength(1);
    expect(timers[0].ms).toBe(15_000);
    await timers[0].fn();
    await timers[0].fn();
    expect(sent).toEqual(["READY=1", "WATCHDOG=1", "WATCHDOG=1"]);
  });

  it("without a watchdog (not under systemd): READY only, no timer", async () => {
    const { wd, sent, timers } = setup({ usec: "" }); // no WATCHDOG_USEC
    expect(wd.enabled).toBe(false);
    await wd.ready();
    expect(sent).toEqual(["READY=1"]);
    expect(timers).toHaveLength(0);
  });

  it("stops pinging while unhealthy (systemd then restarts us), logs once, resumes when fine", async () => {
    let problem = "event loop lag 9000 ms";
    const { wd, sent, log } = setup({ healthy: () => problem });
    expect(await wd.tick()).toBe("unhealthy");
    expect(await wd.tick()).toBe("unhealthy");
    expect(sent).toEqual([]);
    expect(log.error).toHaveBeenCalledTimes(1);
    problem = null;
    expect(await wd.tick()).toBe("pinged");
    expect(sent).toEqual(["WATCHDOG=1"]);
  });

  it("never piles up helper processes if systemd-notify hangs", async () => {
    let release;
    const { wd } = setup({ notify: () => new Promise((r) => (release = r)) });
    const first = wd.tick();
    expect(await wd.tick()).toBe("busy");
    release();
    await first;
    expect(wd.tick()).toBeInstanceOf(Promise);
  });

  it("a failing systemd-notify is logged, not thrown", async () => {
    const { wd, log } = setup({ notify: async () => { throw new Error("ENOENT"); } });
    await expect(wd.tick()).resolves.toBe("pinged");
    expect(log.warn).toHaveBeenCalled();
  });
});

describe("Wi-Fi status", () => {
  it("parses iw's link output", () => {
    const out = "Connected to 74:ac:b9:12:34:56 (on wlan0)\n\tSSID: Porch\n\tfreq: 5180.0\n\tRX: 1234 bytes (10 packets)\n\tsignal: -61 dBm\n\trx bitrate: 433.3 MBit/s\n";
    expect(parseIwLink(out)).toEqual({ connected: true, ssid: "Porch", signalDbm: -61, freqMhz: 5180, band: "5 GHz", quality: 78 });
    expect(parseIwLink("Connected to x (on wlan0)\n\tSSID: Yard\n\tfreq: 2437\n\tsignal: -82 dBm\n")).toMatchObject({ band: "2.4 GHz", quality: 36 });
    expect(parseIwLink("Not connected.\n")).toEqual({ connected: false });
  });
  it("rates the signal like Ubiquiti's guide", () => {
    expect([-55, -65, -75, -85].map(signalVerdict)).toEqual(["excellent", "acceptable", "weak", "poor: expect dropouts"]);
  });
  it("tells whether Ethernet is carrying traffic", () => {
    expect(parseNmcliDevices("eth0:ethernet:connected\nwlan0:wifi:connected\nlo:loopback:connected (externally)\n")).toEqual({ ethernet: true, wifiUp: true, active: "ethernet" });
    expect(parseNmcliDevices("eth0:ethernet:unavailable\nwlan0:wifi:connected\n").active).toBe("wifi");
  });
});

describe("power-cut protection status", () => {
  const mounts = (root) => `${root}\n/dev/mmcblk0p3 /srv/videofx ext4 rw,noatime,data=journal,commit=5 0 0\n`;
  it("protected: root is an overlay and the data partition is mounted", () => {
    const st = storageStatus({
      procCmdline: "overlayroot=tmpfs:recurse=0 console=tty1 root=PARTUUID=x",
      bootCmdline: "overlayroot=tmpfs:recurse=0 console=tty1 root=PARTUUID=x",
      procMounts: mounts("overlayroot / overlay rw,relatime,lowerdir=/media/root-ro 0 0"),
      storageState: "ok\n",
    });
    expect(st).toEqual({ overlay: true, configured: true, dataMounted: true, dataOptions: "rw,noatime,data=journal,commit=5", maintenance: false, rebootPending: false, state: "ok" });
  });
  it("maintenance: writable root; reboot pending when cmdline.txt changed", () => {
    const st = storageStatus({ procCmdline: "console=tty1", bootCmdline: "overlayroot=tmpfs:recurse=0 console=tty1", procMounts: mounts("/dev/mmcblk0p2 / ext4 rw 0 0") });
    expect(st).toMatchObject({ overlay: false, configured: true, maintenance: true, rebootPending: true });
  });
  it("the flag alone isn't enough: root must actually be an overlay", () => {
    expect(storageStatus({ procCmdline: "overlayroot=tmpfs", procMounts: mounts("/dev/mmcblk0p2 / ext4 rw 0 0") }).overlay).toBe(false);
  });
});
