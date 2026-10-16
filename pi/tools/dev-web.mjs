// A fake device for looking at the web page: `node tools/dev-web.mjs`, then open http://localhost:8080/.
// Real settings and media code on a temp folder; status, power and the rest are stubs.
// DEV_DMX=1 shows DMX in control, DEV_ALARM=1 shows a thermal alarm, DEV_PASSWORD=1 sets a password (user: any, password: "pumpkin"),
// DEV_CHECKS_OK=1 makes every setup check pass.
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMediaStore } from "../src/media.js";
import { SelfCheck } from "../src/selfcheck.js";
import { Settings, hashPassword } from "../src/settings.js";
import { TlsStore } from "../src/tls.js";
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

// A made-up warm day for the System screen's health log: SoC follows the afternoon,
// the fan cycles above 60 °C, a short under-voltage at 14:00, and a 20-minute power cut.
const healthLog = (() => {
  const now = Date.now();
  const samples = [];
  for (let t = now - 24 * 3_600_000; t <= now; t += 60_000) {
    const hour = new Date(t).getHours() + new Date(t).getMinutes() / 60;
    if (hour > 3 && hour < 3.33) continue; // power cut
    const soc = Math.round((48 + 16 * Math.max(0, Math.sin(((hour - 8) / 14) * Math.PI)) + 2 * Math.sin(t / 400_000)) * 10) / 10;
    samples.push({ t, soc, fan: soc > 60 ? 1 : 0, thr: hour > 14 && hour < 14.05 ? 0x50005 : 0, dbm: -58, on: hour > 18 || hour < 1 ? 1 : 0 });
  }
  const at = (h) => { const d = new Date(now); d.setHours(h, 0, 0, 0); return d > now ? d - 86_400_000 : +d; };
  const events = [
    { t: at(3) + 20 * 60_000, lv: "info", ev: "Pi started" },
    { t: at(14), lv: "critical", ev: "Under-voltage started" },
    { t: at(14) + 180_000, lv: "info", ev: "Under-voltage ended" },
    { t: at(15), lv: "warn", ev: "Pi temperature warning: 70.4 °C" },
    { t: at(15) + 600_000, lv: "info", ev: "Pi temperature back to normal: 68.9 °C" },
  ].sort((a, b) => a.t - b.t);
  return { read: ({ sinceMs = 0 } = {}) => ({ samples: samples.filter((s) => s.t >= sinceMs), events: events.filter((e) => e.t >= sinceMs), warnC: 70, critC: 80 }) };
})();

// Setup checks from made-up facts: a Pi 3 with its amp and a sleeping projector that
// answers CEC, a PIR nobody has walked past yet, one past under-voltage and IR unused.
// DEV_CHECKS_OK=1 makes them all pass.
const edid = (() => {
  const b = Buffer.alloc(128);
  Buffer.from([0, 255, 255, 255, 255, 255, 255, 0]).copy(b);
  b.writeUInt16BE((19 << 10) | (20 << 5) | 11, 8); // "STK"
  Buffer.from([0x02, 0x3a, 0x80, 0x18, 0x71, 0x38, 0x2d, 0x40]).copy(b, 54); // 1920 x 1080 at 60 Hz
  b[75] = 0xfc;
  Buffer.from("S2-TEK TV\n   ", "latin1").copy(b, 77);
  return b;
})();
const allOk = !!process.env.DEV_CHECKS_OK;
const selfCheck = new SelfCheck({
  gather: async () => {
    await new Promise((r) => setTimeout(r, 1200)); // CEC takes a moment on a real Pi
    return {
      board: { model: "Raspberry Pi 3 Model B Rev 1.2" },
      audio: { card: "DigiAMP", cardsText: " 0 [vc4hdmi        ]: vc4-hdmi\n 1 [DigiAMP        ]: IQaudIODAC\n" },
      display: { connected: on, edid },
      projector: { mode: "cec", cec: "supported" },
      pir: { enabled: true, available: true, running: true, seen: allOk },
      thermal: { temp: 48.2, warnC: 70, throttled: allOk ? 0 : 0x50000 },
      network: status().network,
      clock: { synced: true },
      media: { problem: null, mode: "loop", clips: 2 },
    };
  },
});
setTimeout(() => selfCheck.run(), 3000);

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
  checks: selfCheck.last && { at: selfCheck.last.at, ...selfCheck.last.summary },
});

// Real certificate store on the temp folder; no HTTPS listener here.
const tlsStore = new TlsStore({ dir: join(dir, "tls") });
const tlsView = () => ({ https: { enabled: settings.get("httpsEnabled"), only: settings.get("httpsOnly"), running: false, port: 443, error: settings.get("httpsEnabled") ? "Not on the dev server." : null }, cert: tlsStore.info() });

const server = createWebServer({
  media,
  tls: {
    get: tlsView,
    upload: (c, k) => (tlsStore.install(c, k), tlsView()),
    selfSigned: async () => (await tlsStore.generate({ names: ["videofx-dev", "videofx-dev.local", "localhost"], ips: ["127.0.0.1"] }), tlsView()),
    remove: () => (tlsStore.remove(), tlsView()),
  },
  settings,
  auth: settings,
  hostNames: () => ["localhost"],
  health: healthLog,
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
  checks: { last: () => selfCheck.last, run: () => selfCheck.run() },
  irLearn: async () => "nec:0x40bf",
  irTest: async () => {},
  backup: async () => ({ format: "videofx-backup", device: "videofx-dev", createdAt: new Date().toISOString(), settings: {}, matter: {} }),
  restore: async () => ({ restored: true }),
  log: console,
});
server.listen(8080, "127.0.0.1", () => console.log("http://localhost:8080/  (files in " + dir + ")"));
