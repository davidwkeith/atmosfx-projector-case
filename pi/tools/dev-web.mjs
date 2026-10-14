// A fake device for looking at the web page: `node tools/dev-web.mjs`, then open http://localhost:8080/.
// Real settings and media code on a temp folder; status, power and the rest are stubs.
// DEV_DMX=1 shows DMX in control, DEV_ALARM=1 shows a thermal alarm, DEV_PASSWORD=1 sets a password (user: any, password: "pumpkin").
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMediaStore } from "../src/media.js";
import { Settings, hashPassword } from "../src/settings.js";
import { createWebServer } from "../src/web.js";

const dir = mkdtempSync(join(tmpdir(), "videofx-dev-"));
for (const n of ["ghost-buffer.mp4", "ghost-scare-1.mp4", "ghost-scare-2.mp4", "zombie.mp4"]) writeFileSync(join(dir, n), "x".repeat(2048));
writeFileSync(join(dir, "playlist.m3u"), "zombie.mp4\nghost-buffer.mp4\n");
const media = createMediaStore({ dir, playlist: join(dir, "playlist.m3u"), maxUploadBytes: 500 * 1024 * 1024 });
if (process.env.DEV_PASSWORD) writeFileSync(join(dir, "settings.json"), JSON.stringify({ password: hashPassword("pumpkin") }));
const settings = new Settings({ dir, env: {}, log: console });

let on = false;
let volume = { level: 30, muted: false };
const status = () => ({
  name: "VideoFX-DEV",
  on,
  playing: on,
  problem: media.problem?.() ?? undefined,
  volume,
  restartNeeded: settings.restartNeeded,
  matter: { commissioned: false, manualPairingCode: "34970112332", fabrics: 0 },
  thermal: { enabled: true, temp: 48.2, tripped: null, alarms: process.env.DEV_ALARM ? [{ level: "warn", text: "Pi: 71.0 °C (warning at 70 °C)" }] : [] },
  projector: { mode: "cec", power: on ? "on" : "standby", cec: "supported", notice: null },
  dmx: { enabled: !!process.env.DEV_DMX, inControl: !!process.env.DEV_DMX, live: !!process.env.DEV_DMX, values: [255, 0, 1, 0, 200, 0, 255, 0], sources: [{ name: "Desk", ip: "192.168.1.9", priority: 100, packetsPerSecond: 44 }], rejected: 0 },
  player: { mode: "scare", scareActive: false, cooldownLeftMs: 0, lastSeamMs: { toScareMs: 38, toBufferMs: 41 } },
  schedule: { enabled: true, next: { on: !on, at: Date.now() + 3_600_000, label: "Mon sunset" } },
  network: { ethernet: false, wifi: { connected: true, ssid: "Home", band: "5 GHz", signalDbm: -52, quality: 80, verdict: "good" } },
  storage: { maintenance: false, dataMounted: true, state: "ok" },
  web: { passwordSet: settings.passwordSet },
  clock: { synced: true },
  quiet: { active: false },
  version: { version: "0.9.0", sha: "dev", available: false, latest: null, checkedAt: Date.now() },
});

const server = createWebServer({
  media,
  settings,
  auth: settings,
  hostNames: () => ["localhost"],
  status,
  setPower: async (v) => void (on = v),
  setVolume: async (v) => (volume = { level: v.level ?? volume.level, muted: v.muted ?? volume.muted }),
  playlistChanged: () => {},
  pairingSvg: () => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#fff"/><rect x="1" y="1" width="3" height="3"/><rect x="6" y="1" width="3" height="3"/><rect x="1" y="6" width="3" height="3"/></svg>',
  resetMatter: async () => {},
  restart: async () => {},
  scare: () => ({ result: "fired" }),
  irLearn: async () => "nec:0x40bf",
  irTest: async () => {},
  backup: async () => ({ format: "videofx-backup", device: "videofx-dev", createdAt: new Date().toISOString(), settings: {}, matter: {} }),
  restore: async () => ({ restored: true }),
  log: console,
});
server.listen(8080, "127.0.0.1", () => console.log("http://localhost:8080/  (files in " + dir + ")"));
