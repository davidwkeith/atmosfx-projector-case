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
// Just enough MP4 (ftyp + moov/mvhd) for the clip lengths to show.
function box(type, body) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(8 + body.length, 0);
  head.write(type, 4, "latin1");
  return Buffer.concat([head, body]);
}
const fakeMp4 = (seconds) => {
  const mvhd = Buffer.alloc(100);
  mvhd.writeUInt32BE(1000, 12);
  mvhd.writeUInt32BE(Math.round(seconds * 1000), 16);
  return Buffer.concat([box("ftyp", Buffer.from("isom")), box("moov", box("mvhd", mvhd)), Buffer.alloc(2048)]);
};
for (const [n, s] of [["ghost-buffer.mp4", 95], ["ghost-scare-1.mp4", 12.4], ["ghost-scare-2.mp4", 9], ["zombie.mp4", 312]]) writeFileSync(join(dir, n), fakeMp4(s));
writeFileSync(join(dir, "playlist.m3u"), "zombie.mp4\nghost-buffer.mp4\n");
const media = createMediaStore({ dir, playlist: join(dir, "playlist.m3u"), maxUploadBytes: 500 * 1024 * 1024 });
if (process.env.DEV_PASSWORD) writeFileSync(join(dir, "settings.json"), JSON.stringify({ password: hashPassword("pumpkin") }));
const settings = new Settings({ dir, env: {}, log: console });

let on = false;
let onSince = 0;
let pausedAt = null; // ms of play time when paused
const clips = { "zombie.mp4": 312, "ghost-buffer.mp4": 95 };
// A made-up poster per clip, so the header has something to show without mpv.
const posterSvg = (name) => {
  const hue = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 0);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 90"><rect width="160" height="90" fill="hsl(${hue} 45% 22%)"/><circle cx="80" cy="42" r="20" fill="hsl(${hue} 60% 70%)"/><text x="80" y="82" font-size="10" text-anchor="middle" fill="#fff" font-family="sans-serif">${name}</text></svg>`;
};
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
  player: { mode: "scare", paused: pausedAt !== null, scareActive: false, cooldownLeftMs: 0, lastSeamMs: { toScareMs: 38, toBufferMs: 41 } },
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
  setPower: async (v) => void ((on = v), (onSince = Date.now()), (pausedAt = null)),
  setPaused: (p) => {
    if (!on) throw new Error("nothing is playing");
    if (p && pausedAt === null) pausedAt = Date.now() - onSince;
    if (!p && pausedAt !== null) ((onSince = Date.now() - pausedAt), (pausedAt = null));
  },
  nowPlaying: async () => {
    if (!on) return null;
    const t = (pausedAt ?? Date.now() - onSince) / 1000;
    const [file, duration] = t % 407 < 312 ? ["zombie.mp4", clips["zombie.mp4"]] : ["ghost-buffer.mp4", clips["ghost-buffer.mp4"]];
    return { file, position: file === "zombie.mp4" ? t % 407 : (t % 407) - 312, duration, at: Date.now() };
  },
  poster: async (name) => (name in clips ? { body: posterSvg(name), type: "image/svg+xml" } : null),
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
