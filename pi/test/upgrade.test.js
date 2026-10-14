import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { askHelper } from "../src/upgrade.js";
import { handle } from "../src/upgrade-helper.js";

const deps = (over = {}) => ({
  user: async () => "videofx",
  verify: vi.fn(async (pw) => pw === "right"),
  check: vi.fn(async () => ({ ok: true })),
  start: vi.fn(async () => ({ ok: true })),
  sleep: vi.fn(async () => {}),
  log: vi.fn(),
  ...over,
});

describe("upgrade helper", () => {
  it("starts the update only for the right password", async () => {
    const d = deps();
    expect(await handle('{"action":"upgrade","password":"right"}', d)).toEqual({ ok: true });
    expect(d.start).toHaveBeenCalledTimes(1);
    expect(d.verify).toHaveBeenCalledWith("right", "videofx");
  });

  it("refuses and delays a wrong, empty, huge or non-string password, and never logs it", async () => {
    for (const password of ["hunter2-secret", "", "x".repeat(300), "a\0b", 5, undefined]) {
      const d = deps();
      expect(await handle(JSON.stringify({ action: "upgrade", password }), d)).toEqual({ error: "wrong-password" });
      expect(d.start).not.toHaveBeenCalled();
      expect(d.sleep).toHaveBeenCalled();
      expect(JSON.stringify(d.log.mock.calls)).not.toContain("hunter2");
    }
  });

  it("reports an upgrade already running", async () => {
    const d = deps({ start: async () => ({ ok: false, message: "unit exists" }) });
    expect(await handle('{"action":"upgrade","password":"right"}', d)).toEqual({ error: "busy", message: "unit exists" });
  });

  it("check needs no password; junk and unknown actions fail", async () => {
    const d = deps();
    expect(await handle('{"action":"check"}', d)).toEqual({ ok: true });
    expect(d.verify).not.toHaveBeenCalled();
    expect(await handle("nope", d)).toMatchObject({ error: "failed" });
    expect(await handle('{"action":"reboot"}', d)).toMatchObject({ error: "failed" });
  });
});

describe("askHelper", () => {
  it("round-trips a JSON line over a Unix socket", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vfx-up-"));
    const path = join(dir, "s.sock");
    let got;
    const srv = createServer((c) => c.on("data", (b) => ((got = JSON.parse(b.toString())), c.write('{"ok":true}\n'))));
    await new Promise((r) => srv.listen(path, r));
    try {
      expect(await askHelper({ action: "upgrade", password: "pw" }, { socketPath: path })).toEqual({ ok: true });
      expect(got).toEqual({ action: "upgrade", password: "pw" });
    } finally {
      srv.close();
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("says unavailable when nothing listens", async () => {
    expect(await askHelper({ action: "check" }, { socketPath: "/nonexistent/x.sock" })).toMatchObject({ error: "unavailable" });
  });
});
