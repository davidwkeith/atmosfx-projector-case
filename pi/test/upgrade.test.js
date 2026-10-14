import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { askHelper } from "../src/upgrade.js";
import { handle } from "../src/upgrade-helper.js";

const deps = (over = {}) => ({
  check: vi.fn(async () => ({ ok: true })),
  start: vi.fn(async () => ({ ok: true })),
  log: vi.fn(),
  ...over,
});

describe("upgrade helper", () => {
  it("starts the update; the socket's owner is the authorization", async () => {
    const d = deps();
    expect(await handle('{"action":"upgrade"}', d)).toEqual({ ok: true });
    expect(d.start).toHaveBeenCalledTimes(1);
  });

  it("reports an upgrade already running", async () => {
    const d = deps({ start: async () => ({ ok: false, message: "unit exists" }) });
    expect(await handle('{"action":"upgrade"}', d)).toEqual({ error: "busy", message: "unit exists" });
  });

  it("runs check; junk and unknown actions fail", async () => {
    const d = deps();
    expect(await handle('{"action":"check"}', d)).toEqual({ ok: true });
    expect(d.check).toHaveBeenCalledTimes(1);
    expect(await handle("nope", d)).toMatchObject({ error: "failed" });
    expect(await handle('{"action":"reboot"}', d)).toMatchObject({ error: "failed" });
    expect(d.start).not.toHaveBeenCalled();
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
      expect(await askHelper({ action: "upgrade" }, { socketPath: path })).toEqual({ ok: true });
      expect(got).toEqual({ action: "upgrade" });
    } finally {
      srv.close();
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("says unavailable when nothing listens", async () => {
    expect(await askHelper({ action: "check" }, { socketPath: "/nonexistent/x.sock" })).toMatchObject({ error: "unavailable" });
  });
});
