// VideoFX player: a Matter device that loops a playlist (or runs startle scares)
// full screen with mpv, switches the projector with it, and serves a LAN web UI.
//
// Matter endpoints: 1 "projector" (main on/off), 2 "scare" (on = fire a scare,
// goes back off when it ends), 3 "motion" (PIR occupancy sensor).

import { execFile, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { hostname } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { DeviceTypeId, Environment, ServerNode, VendorId } from "@matter/main";
import { OccupancySensingServer } from "@matter/main/behaviors";
import { OccupancySensorDevice, OnOffPlugInUnitDevice } from "@matter/main/devices";
import { QrCode } from "@matter/main/types";
import { defaultContext, resolveSettings } from "./config.js";
import { GpioOut, gpiosetArgs } from "./gpio.js";
import { Ir, lircFeatures } from "./ir.js";
import { createMediaStore } from "./media.js";
import { MpvSupervisor, mpvArgs } from "./mpv.js";
import { Pir, gpiomonMajor, pirArgs } from "./pir.js";
import { Player } from "./player.js";
import { Projector } from "./projector.js";
import { qrTextToSvg } from "./qr.js";
import { Scheduler } from "./schedule.js";
import { createScreen } from "./screen.js";
import { Settings } from "./settings.js";
import { Volume, amixerArgs } from "./volume.js";
import { createWebServer } from "./web.js";

const run = promisify(execFile);
const ctx = defaultContext();
// The state folder holds settings.json, so it comes from the environment only.
const stateDir = resolveSettings({ env: process.env, ctx }).values.stateDir;
mkdirSync(stateDir, { recursive: true });
// systemd RuntimeDirectory=videofx -> /run/videofx (mpv socket, temp IR files).
const runDir = process.env.RUNTIME_DIRECTORY || stateDir;
const settings = new Settings({ dir: stateDir, env: process.env, ctx });
const get = (key) => settings.get(key);

// Matter fabrics, keys and the random pairing passcode live here. Deleting this
// directory (or "Reset Matter pairing" in the web UI) is a factory reset.
Environment.default.vars.set("storage.path", join(stateDir, "matter"));

// --- audio, screen, media

const volume = new Volume({
  store: {
    load: () => ({ level: get("volume"), muted: get("muted") }),
    save: ({ level, muted }) => settings.update({ volume: level, muted }),
  },
  apply: (v) => run("amixer", amixerArgs(get("audioCard"), get("mixerControl"), v)),
});
// First boot: the safe default; later: the saved level. A missing card is logged, not fatal.
volume.applyCurrent().catch(() => {});

// Console device and ports are read once: changing them needs a restart.
const screen = createScreen(get("console"));
const media = createMediaStore({
  dir: get("mediaDir"),
  playlist: get("playlist"),
  maxUploadBytes: () => get("maxUploadMb") * 1024 * 1024,
});

// --- GPIO tools (libgpiod 1 on bookworm, 2 on trixie)

let gpiodMajor = null;
try {
  gpiodMajor = gpiomonMajor((await run("gpiomon", ["--version"])).stdout);
} catch {
  console.warn("gpiomon not found: PIR and relay are unavailable (install the gpiod package)");
}

// --- Matter node

const server = await ServerNode.create({
  id: "videofx",
  network: { port: get("matterPort") },
  productDescription: {
    name: get("name"),
    deviceType: DeviceTypeId(OnOffPlugInUnitDevice.deviceType),
  },
  basicInformation: {
    // 0xFFF1 / 0x8000 are the Matter test vendor and product IDs. Controllers
    // accept them but warn that the accessory is not certified.
    vendorName: "DIY",
    vendorId: VendorId(0xfff1),
    productName: "Projector",
    productLabel: get("name"),
    productId: 0x8000,
    nodeLabel: get("name"),
    // Identity stays videofx-xxxx even if the display name is changed.
    serialNumber: ctx.hostName,
    uniqueId: `${ctx.hostName}-plug`, // must differ from serialNumber
  },
});

const plug = await server.add(OnOffPlugInUnitDevice, { id: "projector" });
const scareSwitch = await server.add(OnOffPlugInUnitDevice, { id: "scare" });
// Always present (even with the PIR disabled) so the device layout never changes after pairing.
const motion = await server.add(OccupancySensorDevice.with(OccupancySensingServer.with("PassiveInfrared", "OccupancyEvent")), {
  id: "motion",
  occupancySensing: { occupancy: { occupied: false } },
});

function pairingCodes() {
  if (server.lifecycle.isCommissioned) return undefined;
  const { qrPairingCode, manualPairingCode } = server.state.commissioning.pairingCodes;
  return { qrText: QrCode.get(qrPairingCode).trim(), qrPairingCode, manualPairingCode };
}

// What to show when mpv is not drawing: pairing info until commissioned, then black.
function idleScreen() {
  const codes = pairingCodes();
  if (!codes) return screen.black();
  screen.pairing({ qr: codes.qrText, manualPairingCode: codes.manualPairingCode, name: get("name"), host: ctx.hostName });
}

// --- player

const mpv = new MpvSupervisor({
  spawn,
  command: get("mpv"),
  socket: join(runDir, "mpv.sock"),
  args: () => mpvArgs(settings.values, join(runDir, "mpv.sock")), // re-read on every start
});

const playerState = join(stateDir, "player.json");
const clipPath = (name) => (name ? join(get("mediaDir"), name) : "");
const scareNames = () => get("scareClips").filter((n) => existsSync(clipPath(n)));

const player = new Player({
  mpv,
  content: () => ({
    mode: get("mode"),
    playlist: get("playlist"),
    buffer: clipPath(get("scareBuffer")),
    scares: scareNames().map(clipPath),
    order: get("scareOrder"),
    cooldownMs: get("scareCooldown") * 1000,
    duringScare: get("scareDuringScare"),
    mirror: get("mirror"),
  }),
  blank: idleScreen,
  store: {
    load: () => {
      try {
        return JSON.parse(readFileSync(playerState, "utf8")).on;
      } catch {
        return undefined;
      }
    },
    save: (on) => writeFileSync(playerState, JSON.stringify({ on }) + "\n"),
  },
  preflight: () => media.problem({ mode: get("mode"), buffer: get("scareBuffer"), scares: get("scareClips") }),
});

// --- projector power (CEC / relay / IR / HDMI signal)

const relay = new GpioOut({ spawn, argsFor: (closed) => gpiosetArgs(gpiodMajor ?? 2, get("relayPin"), closed, get("relayActiveLow")) });

// The lirc devices for the IR LED and receiver, found by what they can do.
async function lircDevice(kind) {
  for (let n = 0; n < 4; n++) {
    const dev = `/dev/lirc${n}`;
    if (!existsSync(dev)) continue;
    try {
      if (lircFeatures((await run("ir-ctl", ["-f", "-d", dev])).stdout)[kind]) return dev;
    } catch {
      // not ours / no access
    }
  }
  return null;
}
const ir = new Ir({ run, spawn, txDevice: () => lircDevice("send"), rxDevice: () => lircDevice("receive"), tmpDir: runDir });

const projector = new Projector({
  run,
  mode: () => get("projectorPower"),
  device: () => get("cecDevice"),
  osdName: get("name"),
  relay,
  ir,
  settleMs: () => get("relaySettleSec") * 1000,
  irCode: () => get("irPowerCode"),
  doublePress: () => get("irDoublePress"),
  // hdmi-off: fbdev power-down blank turns the HDMI signal off (udev lets the video group write it).
  blank: (powerDown) => writeFile("/sys/class/graphics/fb0/blank", powerDown ? "4" : "0"),
});
await projector.init(); // relay open (projector off) until the restored state is applied

// --- power: one path for Matter, the web UI, the schedule and restore

const setPower = (on) => plug.set({ onOff: { onOff: on } });
let powerSeq = 0;

async function powerChanged(on) {
  const seq = ++powerSeq;
  if (on) {
    await projector.on(); // wake first (and wait out the relay settle time)
    if (seq !== powerSeq) return; // switched off meanwhile
    player.setOn(true);
  } else {
    player.setOn(false);
    await projector.off({ keepSignal: !server.lifecycle.isCommissioned });
  }
}

plug.events.onOff.onOff$Changed.on((on) => {
  powerChanged(on).catch((err) => console.error(`Power: ${err.message}`));
});

// The player gave up (no playlist, repeated crashes): report "off" so the
// controller shows the truth. Deferred so we never write inside the change event.
player.on("failed", () => setImmediate(() => setPower(false).catch((e) => console.error(e))));

// --- scares: Matter "scare" switch, PIR, web button

const setScareSwitch = (on) => scareSwitch.set({ onOff: { onOff: on } }).catch((e) => console.error(e));
player.on("scare", ({ state }) => setImmediate(() => setScareSwitch(state === "start")));

scareSwitch.events.onOff.onOff$Changed.on((on) => {
  if (!on || player.scareActive) return; // our own "on" while a scare plays
  const result = player.trigger("Matter");
  // Fired: stays on until the scare ends ("scare" event). Otherwise back off now.
  if (result.result !== "fired") setImmediate(() => setScareSwitch(false));
});

let pir = null;
function startPir() {
  pir?.stop();
  pir = null;
  if (!get("pirEnabled") || gpiodMajor === null) return;
  pir = new Pir({ spawn, args: pirArgs(gpiodMajor, get("pirPin"), get("pirDebounceMs")), debounceMs: get("pirDebounceMs") });
  pir.on("change", (occupied) => motion.set({ occupancySensing: { occupancy: { occupied } } }).catch((e) => console.error(e)));
  pir.on("motion", () => player.trigger("motion sensor"));
  pir.start();
}
startPir();

// --- schedule

const scheduler = new Scheduler({
  getSchedule: () => get("schedule"),
  getGeo: () => (get("latitude") !== null && get("longitude") !== null ? { lat: get("latitude"), lon: get("longitude") } : null),
  setPower,
});

// --- lifecycle and settings

server.lifecycle.online.on(() => {
  if (!player.isPlaying) idleScreen();
});
server.lifecycle.commissioned.on(() => {
  if (!player.isPlaying) screen.black();
});
server.lifecycle.decommissioned.on(() => {
  if (!player.isPlaying) idleScreen();
});

/** Apply a setting changed in the web UI. Returns a note for the page, if any. */
async function afterSettingChange(key) {
  switch (key) {
    case "volume":
    case "muted":
      await volume.applyCurrent().catch(() => {});
      return undefined;
    case "audioCard":
    case "mixerControl":
    case "videoOutput":
    case "mpvExtraArgs":
      if (key !== "videoOutput") await volume.applyCurrent().catch(() => {});
      player.argsChanged();
      return player.isOn ? "Applies the next time playback starts." : "Applied (the player restarted while stopped).";
    case "mirror":
      await player.setMirror(get("mirror"));
      return mpv.ready ? undefined : "Applies when the player starts.";
    case "mode":
    case "scareBuffer":
    case "scareClips":
    case "scareOrder":
      player.reload();
      return undefined;
    case "pirEnabled":
    case "pirPin":
    case "pirDebounceMs":
      startPir();
      return undefined;
    case "schedule":
    case "latitude":
    case "longitude":
      scheduler.start();
      return undefined;
    case "projectorPower":
    case "cecDevice":
      projector.reset();
      if (!player.isOn) await projector.init();
      return undefined;
    case "name":
      try {
        // Controllers that already show a name you gave them keep theirs.
        await server.set({ basicInformation: { nodeLabel: get("name") } });
      } catch (err) {
        console.warn(`Could not update the Matter node label: ${err.message}`);
        return "Saved. Matter picks up the new name after a service restart.";
      }
      if (!player.isPlaying) idleScreen();
      return "Matter node label updated. Apple Home keeps the name you gave it there.";
    case "console":
      return "Restart the service to use it.";
    default:
      return undefined;
  }
}

// Stop the way systemd does (SIGTERM, which matter.js handles); Restart=always
// starts a fresh process. Deferred so the HTTP response goes out first.
function restartService(before = async () => {}) {
  setTimeout(async () => {
    try {
      await before();
    } finally {
      process.kill(process.pid, "SIGTERM");
    }
  }, 200);
}

const web = createWebServer({
  media,
  settings,
  auth: settings,
  hostNames: () => {
    const name = get("name").toLowerCase();
    return [hostname(), `${hostname()}.local`, ctx.hostName, `${ctx.hostName}.local`, name, `${name}.local`, ...get("webHosts")];
  },
  status: () => {
    const codes = pairingCodes();
    const next = scheduler.next;
    return {
      name: get("name"),
      on: player.isOn,
      playing: player.isPlaying,
      problem: media.problem({ mode: get("mode"), buffer: get("scareBuffer"), scares: get("scareClips") }) ?? null,
      volume: volume.state,
      restartNeeded: settings.restartNeeded,
      player: player.status,
      pir: { enabled: get("pirEnabled"), running: pir?.running ?? false, occupied: pir?.occupied ?? false, available: gpiodMajor !== null },
      projector: projector.state,
      schedule: { enabled: get("schedule").enabled, next: next && { at: new Date(next.at).toISOString(), on: next.on, label: next.label } },
      matter: {
        commissioned: server.lifecycle.isCommissioned,
        fabrics: Object.keys(server.state.commissioning.fabrics ?? {}).length,
        manualPairingCode: codes?.manualPairingCode ?? null,
      },
    };
  },
  setPower,
  setVolume: (v) => volume.set(v),
  scare: () => player.trigger("web page"),
  irLearn: () => ir.learn(),
  irTest: (code) => ir.send(code ?? get("irPowerCode")),
  afterSettingChange,
  playlistChanged: () => {
    if (get("mode") === "loop") player.reload();
  },
  mediaDeleted: (name) => {
    const changes = {};
    if (get("scareBuffer") === name) changes.scareBuffer = "";
    if (get("scareClips").includes(name)) changes.scareClips = get("scareClips").filter((n) => n !== name);
    if (Object.keys(changes).length) settings.update(changes);
  },
  pairingSvg: () => {
    const codes = pairingCodes();
    return codes && qrTextToSvg(codes.qrText);
  },
  // Factory reset of the Matter node only (media, playlist and settings stay).
  resetMatter: async () =>
    restartService(async () => {
      console.warn("Resetting Matter pairing");
      await server.erase();
    }),
  restart: async () => {
    console.warn("Restart requested from the web UI");
    restartService();
  },
});
web.on("error", (err) => console.error(`Web UI: ${err.message}`));
web.listen(get("httpPort"), () => console.info(`Web UI on port ${get("httpPort")}`));

// Start mpv (it idles until there is something to play), the schedule, then
// restore the last state (or the configured one).
mpv.start();
scheduler.start();
const initial = player.initialState(get("restore"));
await setPower(initial);
// onOff$Changed fires only on change, so apply it directly too.
await powerChanged(initial);

// run() starts the node and resolves when it is closed; matter.js closes it on
// SIGTERM/SIGINT. While not commissioned it logs the pairing QR code and manual
// code to stdout, which is the journal under systemd.
await server.run();
web.close();
scheduler.stop();
pir?.stop();
await player.shutdown();
relay.release();
