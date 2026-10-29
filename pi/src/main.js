// VideoFX player: a Matter device that loops a playlist (or runs startle scares)
// full screen with mpv, switches the projector with it, and serves a LAN web UI.
//
// Matter endpoints: 1 "projector" (main on/off), 2 "scare" (on = fire a scare,
// goes back off when it ends), 3 "motion" (PIR occupancy sensor),
// 4 "temperature" (the Pi's SoC).
//
// Who controls the main power: Matter, the web page, the schedule and restore go
// through the PowerArbiter; while DMX (sACN) is live only DMX may; thermal
// protection can always switch off and blocks switching on while tripped.

import { execFile, spawn } from "node:child_process";
import dgram from "node:dgram";
import { createServer as createHttpServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { hostname, networkInterfaces, uptime } from "node:os";
import { fileURLToPath } from "node:url";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { join } from "node:path";
import { promisify } from "node:util";
import { DeviceTypeId, Environment, ServerNode, VendorId } from "@matter/main";
import { OccupancySensingServer } from "@matter/main/behaviors";
import { OccupancySensorDevice, OnOffPlugInUnitDevice, TemperatureSensorDevice } from "@matter/main/devices";
import { QrCode } from "@matter/main/types";
import { applyStagedRestore, createBackup, stageRestore, validateBackup } from "./backup.js";
import { defaultContext, resolveSettings } from "./config.js";
import { DisplayWatch, displayConnected, readEdid } from "./display.js";
import { DmxControl, InternalWrites, PowerArbiter, SACN_PORT, SacnReceiver, fixtureValues, interpret, multicastGroup } from "./dmx.js";
import { writeFileAtomicSync } from "./fsutil.js";
import { GpioOut, gpiosetArgs } from "./gpio.js";
import { HealthLog, HealthWatch, parseThrottled } from "./healthlog.js";
import { Ir, lircFeatures } from "./ir.js";
import { HttpError, createMediaStore } from "./media.js";
import { createUsbImporter } from "./usb.js";
import { isShuffled, parsePlaylist } from "./playlist-core.js";
import { MpvSupervisor, mpvArgs } from "./mpv.js";
import { Pir, gpiomonMajor, pirArgs } from "./pir.js";
import { Player } from "./player.js";
import { createPosterCache } from "./poster.js";
import { Projector } from "./projector.js";
import { qrTextToSvg } from "./qr.js";
import { Scheduler, missedEvent } from "./schedule.js";
import { SelfCheck } from "./selfcheck.js";
import { createScreen } from "./screen.js";
import { Settings } from "./settings.js";
import { TIMESYNC_FLAG, parseIwLink, parseNmcliDevices, signalVerdict, storageStatus } from "./system.js";
import { Watchdog } from "./watchdog.js";
import { capVolume, quietNow, scareBlocked } from "./quiet.js";
import { readVersion, updateStatus } from "./update.js";
import { askHelper } from "./upgrade.js";
import { OverTempGuard, SocWatch, parseMilli, readFanState } from "./thermal.js";
import { Volume, amixerArgs, missingCardMessage } from "./volume.js";
import { createWebHandler, isLanAddress } from "./web.js";
import { TlsStore } from "./tls.js";

const run = promisify(execFile);
// No RTC on the Pi 3/4/Zero 2 W: time-based rules wait for NTP (see schedule.js, quiet.js).
const clockSynced = () => existsSync(TIMESYNC_FLAG);
const ctx = defaultContext();
// The state folder holds settings.json, so it comes from the environment only.
const stateDir = resolveSettings({ env: process.env, ctx }).values.stateDir;
mkdirSync(stateDir, { recursive: true });
// systemd RuntimeDirectory=videofx -> /run/videofx (mpv socket, temp IR files).
const runDir = process.env.RUNTIME_DIRECTORY || stateDir;
const settings = new Settings({ dir: stateDir, env: process.env, ctx });
const get = (key) => settings.get(key);

// Temperatures and failures over time, on the data partition (the journal is in RAM).
const health = new HealthLog({ file: join(stateDir, "health.jsonl") });
// Short uptime: the Pi itself started (power-up, power cut or reboot), not just the service.
health.event("info", uptime() < 300 ? "Pi started" : "Service restarted");

// A restore from the web page staged Matter storage: swap it in before matter.js opens it.
await applyStagedRestore(stateDir);

// Matter fabrics, keys and the random pairing passcode live here. Deleting this
// directory (or "Reset Matter pairing" in the web UI) is a factory reset.
Environment.default.vars.set("storage.path", join(stateDir, "matter"));
const appDir = fileURLToPath(new URL("..", import.meta.url));
const currentVersion = readVersion(appDir);

// --- audio, screen, media

/** Set the amp's mixer. A missing card gets a useful message instead of amixer's "Invalid card number". */
async function setMixer(v, capOpts) {
  const card = get("audioCard");
  const cards = await readFile("/proc/asound/cards", "utf8").catch(() => null);
  const missing = cards === null ? null : missingCardMessage(card, cards);
  if (missing) throw new Error(missing);
  return run("amixer", amixerArgs(card, get("mixerControl"), capVolume(v, get("quietHours"), new Date(), { ...capOpts, clockOk: clockSynced() })));
}

const volume = new Volume({
  store: {
    load: () => ({ level: get("volume"), muted: get("muted") }),
    save: ({ level, muted }) => settings.update({ volume: level, muted }),
  },
  apply: (v) => setMixer(v),
});
// First boot: the safe default; later: the saved level. A missing card is logged, not fatal.
volume.applyCurrent().catch(() => {});

// Console device and ports are read once: changing them needs a restart.
const screen = createScreen(get("console"));
// Wipe whatever boot left on the console before anything can reveal it.
screen.black();
const media = createMediaStore({
  dir: get("mediaDir"),
  playlist: get("playlist"),
  maxUploadBytes: () => get("maxUploadMb") * 1024 * 1024,
  // A first upload (or one onto the built-in clip) builds the playlist by itself.
  autoPlaylist: true,
  defaultClip: "videofx-default.mp4",
});
// Uploads cut short by a crash or power cut would otherwise fill the card over time.
media
  .seedDefault(join(appDir, "src", "default", "videofx-default.mp4"))
  .then((seeded) => seeded && console.info("No playlist yet: added the built-in VideoFX test clip"), (err) => console.warn(`Could not add the built-in clip: ${err.message}`));
media.cleanTemp().then((n) => n && console.info(`Removed ${n} unfinished upload(s)`), () => {});

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
const temperature = await server.add(TemperatureSensorDevice, {
  id: "temperature",
  temperatureMeasurement: { measuredValue: null, minMeasuredValue: -2000, maxMeasuredValue: 12000 }, // 0.01 °C
});

function pairingCodes({ evenIfPaired = false } = {}) {
  if (server.lifecycle.isCommissioned && !evenIfPaired) return undefined;
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
// When the power state last changed before this boot (the file is rewritten on
// every change): tells a schedule event that was acted on from one that passed
// while the power was out.
let lastChangeAt = 0;
try {
  lastChangeAt = statSync(playerState).mtimeMs;
} catch {
  // never switched: any past schedule event counts as missed
}
let dmxOverride = {}; // runtime values DMX sets while in control (not saved)
const clipPath = (name) => (name ? join(get("mediaDir"), name) : "");
const scareNames = () => get("scareClips").filter((n) => existsSync(clipPath(n)));

const player = new Player({
  mpv,
  content: () => ({
    mode: dmxOverride.mode ?? get("mode"),
    playlist: get("playlist"),
    loopClips: () => media.enabledClips(),
    shuffleClips: () => media.shuffleClips(),
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
    save: (on) => writeFileAtomicSync(playerState, JSON.stringify({ on }) + "\n"),
  },
  preflight: () => media.problem({ mode: dmxOverride.mode ?? get("mode"), buffer: get("scareBuffer"), scares: get("scareClips") }),
  gate: (source) => scareBlocked(get("quietHours"), new Date(), { source, clockOk: clockSynced() }),
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

// The HDMI sink: playback waits for it, and starts again if it turns up late.
const DISPLAY_WAIT_MS = 20_000;
const display = new DisplayWatch({ probe: () => displayConnected({ connector: get("videoOutput") }) });
display.on("connected", () => {
  if (!player.isOn) return;
  console.info("HDMI display connected: starting playback again");
  player.reload();
});
display.on("disconnected", () => health.event("warn", "HDMI display lost"));
display.on("connected", () => health.event("info", "HDMI display back"));
display.start();
mpv.on("crashed", () => health.event("warn", "Video player crashed"));
// mpv gone (crash, kill, restart): the console shows until the next one draws.
// Black while playback is on, so a crash never shows pairing text or anything else.
mpv.on("down", () => (player.isOn ? screen.black() : idleScreen()));

// --- power

let powerSeq = 0;
async function powerChanged(on) {
  const seq = ++powerSeq;
  if (on) {
    await projector.on(); // wake first (and wait out the relay settle time)
    if (seq !== powerSeq) return; // switched off meanwhile
    // mpv gives a disconnected HDMI output no picture, and a projector that was
    // just powered takes a few seconds to appear.
    if ((await display.wait(DISPLAY_WAIT_MS)) === false) {
      console.warn(`No HDMI display after ${DISPLAY_WAIT_MS / 1000} s: starting anyway; playback starts again when it appears`);
    }
    if (seq !== powerSeq) return;
    player.setOn(true);
  } else {
    // Whatever happens to the player, the projector must still be switched off.
    try {
      player.setOn(false);
      // hdmi-off: the console blank is ignored while mpv still holds the display.
      await player.stopped();
    } catch (err) {
      console.error(`Player stop: ${err.message}`);
    }
    if (seq !== powerSeq) return; // switched back on meanwhile
    await projector.off({ keepSignal: !server.lifecycle.isCommissioned });
  }
}

// Our own writes to the Matter attribute vs. writes from a controller.
const ownWrites = new InternalWrites();
async function writePower(on) {
  if (plug.state.onOff.onOff === on) return powerChanged(on);
  await ownWrites.run(on, () => plug.set({ onOff: { onOff: on } }));
}

// Boot catch-up of a schedule event missed while the power was out (see
// scheduleCatchUp). Any power decision made since boot cancels it.
let catchUp = true;

plug.events.onOff.onOff$Changed.on((on) => {
  if (ownWrites.take(on)) {
    powerChanged(on).catch((err) => console.error(`Power: ${err.message}`));
    return;
  }
  const r = arbiter.request("matter", on);
  // Refused (DMX in control / over temperature): put Matter's attribute back to the truth.
  if (!r.ok) setImmediate(() => writePower(r.actual).catch((e) => console.error(e)));
});

// Matter already changed its attribute; everyone else writes it.
const arbiter = new PowerArbiter({
  dmx: { get inControl() { return dmx.inControl; } },
  actual: () => player.isOn,
  blocked: () => guard.blocked,
  apply: (on, source) => {
    if (source !== "catch-up") catchUp = false;
    const job = source === "matter" ? powerChanged(on) : writePower(on);
    job.catch((err) => console.error(`Power (${source}): ${err.message}`));
  },
});
const requestPower = (source, on) => {
  const r = arbiter.request(source, on);
  if (!r.ok) console.info(`Power ${on ? "on" : "off"} from ${source} refused: ${r.reason}`);
  return r;
};

// --- USB stick import: the stick's videos become the playlist and play (loop mode).
const usb = createUsbImporter({
  dir: "/run/videofx-usb",
  media,
  onImported: () => {
    if (get("mode") !== "loop") return; // scare mode plays its own clips
    player.reload();
    requestPower("usb stick", true);
  },
});
setInterval(() => usb.scan(), 2000).unref();

// The player gave up (no playlist, repeated crashes): report "off" so the
// controller shows the truth. Deferred so we never write inside the change event.
player.on("failed", (why) => health.event("critical", `Playback stopped: ${why}`));
player.on("failed", () => setImmediate(() => writePower(false).catch((e) => console.error(e))));

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
let pirSeen = false; // for the setup checks: has the sensor changed since it started?
function startPir() {
  pir?.stop();
  pir = null;
  pirSeen = false;
  if (!get("pirEnabled") || gpiodMajor === null) return;
  pir = new Pir({ spawn, args: pirArgs(gpiodMajor, get("pirPin"), get("pirDebounceMs")), debounceMs: get("pirDebounceMs") });
  pir.on("change", () => (pirSeen = true));
  pir.on("change", (occupied) => motion.set({ occupancySensing: { occupancy: { occupied } } }).catch((e) => console.error(e)));
  pir.on("motion", () => player.trigger("motion sensor"));
  pir.start();
}
startPir();

// --- schedule

// --- clock (no RTC on the Pi 3/4/Zero 2 W): the schedule waits for NTP

let wasSynced = clockSynced();
setInterval(() => {
  const now = clockSynced();
  if (now && !wasSynced) {
    console.info("Clock synchronised: schedule active");
    scheduler.start();
    scheduleCatchUp();
  }
  wasSynced = now;
}, 15_000).unref();

// The schedule only acts at its event times. One that passed while the Pi had no
// power (a cut across "on at sunset") would leave the show dark all night, so it
// is applied once at boot, as soon as the clock is known.
function scheduleCatchUp() {
  if (!catchUp || !clockSynced()) return;
  catchUp = false;
  // The Matter attribute is the intended state; the player lags it while the projector wakes.
  const missed = missedEvent(scheduler.lastEvent(), lastChangeAt, plug.state.onOff.onOff);
  if (!missed) return;
  console.info(`Schedule: ${missed.label} passed while the power was out: turning ${missed.on ? "on" : "off"}`);
  requestPower("catch-up", missed.on);
}

const scheduler = new Scheduler({
  clockOk: clockSynced,
  getSchedule: () => get("schedule"),
  getGeo: () => (get("latitude") !== null && get("longitude") !== null ? { lat: get("latitude"), lon: get("longitude") } : null),
  setPower: (on) => requestPower("schedule", on),
});

// --- DMX (sACN receive): overrides while a source is live

let beforeDmx = null;
let dmxVolume = null; // last DMX volume, re-applied when quiet hours start or end
const dmx = new DmxControl({
  holdMs: get("dmxHoldSec") * 1000,
  act: {
    takeover: () => {
      beforeDmx = { on: player.isOn };
      player.setPaused(false); // the desk is in charge of what shows
      console.info("DMX in control");
    },
    release: () => {
      dmxOverride = {};
      player.setClip(null);
      player.setDimmer(255);
      volume.applyCurrent().catch(() => {});
      player.reload();
      // Back to the schedule's current wish if it has one, else how it was before DMX.
      const want = scheduler.desiredNow() ?? beforeDmx?.on ?? false;
      console.info(`DMX released control; power ${want ? "on" : "off"}`);
      requestPower("handover", want);
    },
    setPower: (on) => requestPower("dmx", on),
    setMode: (mode) => {
      dmxOverride.mode = mode;
      player.reload();
    },
    setClip: (n) => {
      if (!n) return player.setClip(null);
      media
        .readPlaylist()
        .then((entries) => {
          const entry = entries.filter((e) => e.enabled)[n - 1];
          player.setClip(entry ? join(get("mediaDir"), entry.file) : null);
        })
        .catch((err) => console.error(`DMX clip: ${err.message}`));
    },
    trigger: () => player.trigger("DMX"),
    setVolume: (v) => {
      dmxVolume = v;
      return setMixer(v, { source: "dmx" }).catch(() => {});
    },
    setDimmer: (v) => player.setDimmer(v),
  },
});
const receiver = new SacnReceiver({ universe: get("dmxUniverse"), accept: isLanAddress });
receiver.on("live", (live) => dmx.live(live));
receiver.on("frame", (levels) => dmx.frame(fixtureValues(levels, get("dmxAddress"))));
setInterval(() => receiver.tick(), 250).unref();

let dmxSocket = null;
function startDmx() {
  dmxSocket?.close();
  dmxSocket = null;
  receiver.setUniverse(get("dmxUniverse"));
  dmx.setHold(get("dmxHoldSec") * 1000);
  if (!get("dmxEnabled")) return;
  const sock = dgram.createSocket({ type: "udp4", reuseAddr: true });
  sock.on("message", (msg, rinfo) => receiver.handle(msg, rinfo.address));
  sock.on("error", (err) => console.error(`DMX: ${err.message}`));
  sock.bind(SACN_PORT, () => {
    if (!get("dmxMulticast")) return;
    try {
      sock.addMembership(multicastGroup(get("dmxUniverse")));
    } catch (err) {
      console.error(`DMX multicast: ${err.message} (unicast still works)`);
    }
  });
  dmxSocket = sock;
}
startDmx();

// --- heat: the Pi's own SoC temperature (its sled fan is the kernel's; we only report it)

const guard = new OverTempGuard({
  isOn: () => player.isOn,
  powerOff: () => requestPower("thermal", false),
  // Resume: under DMX, whatever DMX asks for; otherwise back on.
  powerOn: () => requestPower("thermal", dmx.inControl ? interpret(dmx.values ?? [0]).power : true),
});
const thermal = new SocWatch({
  cfg: () => ({ warnC: get("tempWarnC"), critC: get("tempCritC"), hysteresisC: get("tempHysteresisC") }),
  guard,
});
let thermalState = { temp: null, alarms: [], locked: false };
let thermalTimer = null;
let stopping = false;

async function thermalTick() {
  try {
    const socC = await readFile("/sys/class/thermal/thermal_zone0/temp", "utf8").then(parseMilli, () => null);
    health.noteTemp(socC);
    if (stopping || !get("thermalEnabled")) return; // switched off while reading
    const fan = await readFanState();
    thermalState = { ...thermal.update(socC), fan };
    const value = socC === null ? null : Math.round(socC * 100);
    if (temperature.state.temperatureMeasurement.measuredValue !== value) {
      await temperature.set({ temperatureMeasurement: { measuredValue: value } });
    }
  } catch (err) {
    console.error(`Thermal: ${err.message}`);
  }
}

function startThermal() {
  if (thermalTimer) clearInterval(thermalTimer);
  thermalTimer = null;
  if (!get("thermalEnabled")) {
    // No protection: forget any trip (or it would block power-on for good).
    thermal.reset();
    guard.reset();
    thermalState = { temp: null, alarms: [], locked: false };
    return;
  }
  thermalTimer = setInterval(thermalTick, 5000);
  thermalTick();
}
startThermal();

// --- quiet hours: re-apply the volume when they start or end

let quietActive = null;
setInterval(() => {
  const now = quietNow(get("quietHours"), new Date(), { clockOk: clockSynced() });
  if (now === quietActive) return;
  quietActive = now;
  if (dmx.inControl && dmxVolume) setMixer(dmxVolume, { source: "dmx" }).catch(() => {});
  else volume.applyCurrent().catch(() => {});
}, 30_000).unref();

// --- OS status for the page: network, power-cut protection

let network = { wifi: { connected: false }, ethernet: false, active: null };
async function refreshNetwork() {
  const out = (cmd, args) => run(cmd, args).then((r) => r.stdout, () => "");
  const [iw, nm] = await Promise.all([out("iw", ["dev", "wlan0", "link"]), out("nmcli", ["-t", "-f", "DEVICE,TYPE,STATE", "device"])]);
  const wifi = parseIwLink(iw);
  network = { wifi: { ...wifi, verdict: signalVerdict(wifi.signalDbm) }, ...parseNmcliDevices(nm) };
}
refreshNetwork();
setInterval(refreshNetwork, 30_000).unref();

let storage = null;
async function refreshStorage() {
  const read = (f) => readFile(f, "utf8").catch(() => "");
  storage = storageStatus({
    procCmdline: await read("/proc/cmdline"),
    bootCmdline: (await read("/boot/firmware/cmdline.txt")) || (await read("/boot/cmdline.txt")),
    procMounts: await read("/proc/mounts"),
    storageState: await read("/var/lib/videofx-storage.state"),
  });
}
refreshStorage();
setInterval(refreshStorage, 60_000).unref();

// --- health log: one sample a minute, plus an event whenever something changes

const healthWatch = new HealthWatch();
async function healthTick() {
  try {
    // Under-voltage and throttling flags from the firmware (needs the video group).
    const throttled = await run("vcgencmd", ["get_throttled"], { timeout: 5000 }).then((r) => parseThrottled(r.stdout), () => null);
    if (stopping) return;
    const alarm = thermalState.locked ? "critical" : thermalState.alarms.some((a) => a.level === "warn") ? "warn" : null;
    for (const e of healthWatch.check({ alarm, temp: thermalState.temp, throttled, wifi: Boolean(network.wifi.connected) })) {
      health.event(e.level, e.text);
    }
    health.sample({ fan: thermalState.fan, throttled, dbm: network.wifi.signalDbm, on: player.isOn, synced: clockSynced() });
  } catch (err) {
    console.error(`Health log: ${err.message}`);
  }
}
// After the first thermal and network readings are in.
setTimeout(healthTick, 10_000).unref();
setInterval(healthTick, 60_000).unref();

// --- setup checks: the dashboard's list of what works, once at start-up and from the page

const selfCheck = new SelfCheck({
  gather: async () => {
    const mode = get("projectorPower");
    const playMode = get("mode");
    const [model, cardsText, connected, edid, cec, socC, throttled] = await Promise.all([
      readFile("/proc/device-tree/model", "utf8").catch(() => null),
      readFile("/proc/asound/cards", "utf8").catch(() => null),
      displayConnected({ connector: get("videoOutput") }),
      readEdid({ connector: get("videoOutput") }),
      // Relay modes: the projector may have no power, so its silence would mean nothing.
      mode === "cec" || mode === "hdmi-off" ? projector.checkCec().catch(() => "no-device") : null,
      readFile("/sys/class/thermal/thermal_zone0/temp", "utf8").then(parseMilli, () => null),
      run("vcgencmd", ["get_throttled"], { timeout: 5000 }).then((r) => parseThrottled(r.stdout), () => null),
    ]);
    return {
      board: { model },
      audio: { card: get("audioCard"), cardsText },
      display: { connected, edid },
      projector: { mode, cec },
      pir: { enabled: get("pirEnabled"), available: gpiodMajor !== null, running: pir?.running ?? false, seen: pirSeen },
      thermal: { temp: socC, warnC: get("tempWarnC"), throttled },
      network,
      clock: { synced: clockSynced() },
      media: {
        problem: media.problem({ mode: playMode, buffer: get("scareBuffer"), scares: get("scareClips") }) ?? null,
        mode: playMode,
        clips: playMode === "scare" ? scareNames().length : (media.enabledClips()?.length ?? null),
      },
    };
  },
});
selfCheck.on("done", ({ checks, summary }) => {
  const failed = checks.filter((c) => c.status === "fail").map((c) => c.label);
  if (failed.length) health.event("warn", `Setup checks: ${failed.join(", ")}`);
  console.info(`Setup checks: ${summary.pass} ok, ${summary.fail} failed, ${summary.unknown} unknown`);
});
// Late enough for the network, the clock and a projector switched on with the Pi.
setTimeout(() => selfCheck.run().catch((err) => console.error(`Setup checks: ${err.message}`)), 30_000).unref();

// --- watchdog: systemd restarts us if the event loop stops pinging

const loopDelay = monitorEventLoopDelay({ resolution: 50 });
loopDelay.enable();
const watchdog = new Watchdog({
  watchdogUsec: process.env.WATCHDOG_USEC,
  // Not under systemd (development): nothing to tell.
  notify: (message) => (process.env.NOTIFY_SOCKET ? run("systemd-notify", [message], { timeout: 5000 }).then(() => {}) : Promise.resolve()),
  healthy: () => {
    const lagMs = loopDelay.max / 1e6;
    loopDelay.reset();
    if (lagMs <= 5000) return null;
    health.event("critical", `Event loop blocked for ${Math.round(lagMs)} ms`);
    return `event loop blocked for ${Math.round(lagMs)} ms`;
  },
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
      return dmx.inControl ? "Saved. The schedule is paused while DMX is in control." : undefined;
    case "dmxEnabled":
    case "dmxUniverse":
    case "dmxMulticast":
    case "dmxHoldSec":
      startDmx();
      return undefined;
    case "thermalEnabled":
      startThermal();
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
    case "httpsEnabled":
      await startHttps();
      if (!get("httpsEnabled")) return undefined;
      return httpsError ?? `HTTPS on port ${get("httpsPort")}. A self-signed certificate makes the browser warn once; accept it for this Pi.`;
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

// What the last `videofx-update --check` found (the page never reaches the network itself),
// and how the last update run went (update-last.json, written by videofx-update).
const readState = (name) => { try { return readFileSync(join(stateDir, name), "utf8"); } catch { return ""; } };
const versionStatus = () => updateStatus(currentVersion, readState("update-check.json"), readState("update-last.json"));

const posters = createPosterCache({ dir: join(stateDir, "posters"), resolve: media.resolve, mpv: get("mpv") });

// Names this page answers to (the Host header guard) and that a self-signed certificate covers.
const webHostNames = () => {
  const name = get("name").toLowerCase();
  return [hostname(), `${hostname()}.local`, ctx.hostName, `${ctx.hostName}.local`, name, `${name}.local`, ...get("webHosts")];
};
// The Pi's own addresses for a self-signed certificate (not link-local: those carry a scope).
const ownAddresses = () =>
  Object.values(networkInterfaces())
    .flat()
    .filter((a) => a && !a.internal && !/^fe80:/i.test(a.address))
    .map((a) => a.address);

// --- HTTPS: the same handler as port 80, on httpsPort, while enabled and a certificate is stored.
const tlsStore = new TlsStore({ dir: join(stateDir, "tls") });
let https = null;
let httpsError = null;
const httpsState = () => ({ enabled: get("httpsEnabled"), only: get("httpsOnly"), running: !!https?.listening, port: get("httpsPort"), error: httpsError });

function stopHttps() {
  if (!https) return;
  https.close();
  https.closeAllConnections();
  https = null;
}

/** Resolves once the listener is up or has failed (httpsError says which). */
async function startHttps() {
  const pair = get("httpsEnabled") ? tlsStore.load() : null;
  if (!pair) {
    stopHttps();
    httpsError = get("httpsEnabled") ? "No certificate yet: upload one or make a self-signed one." : null;
    return;
  }
  try {
    // A running listener takes the new certificate for new connections; no restart.
    if (https) return https.setSecureContext(pair), (httpsError = null);
    const server = createHttpsServer(pair, webHandler);
    server.on("error", (err) => {
      httpsError = err.message;
      console.error(`HTTPS: ${err.message}`);
      if (https === server) https = null;
      server.close();
    });
    https = server;
    return new Promise((resolve) => {
      server.once("error", resolve);
      server.listen(get("httpsPort"), () => {
        httpsError = null;
        console.info(`Web UI (HTTPS) on port ${get("httpsPort")}`);
        resolve();
      });
    });
  } catch (err) {
    stopHttps();
    httpsError = `The certificate is not usable: ${err.message}`;
    console.error(`HTTPS: ${httpsError}`);
  }
}
const tlsView = () => ({ https: httpsState(), cert: tlsStore.info() });

const webHandler = createWebHandler({
  media,
  nowPlaying: () => player.nowPlaying(),
  poster: (name) => posters.poster(name),
  settings,
  // The chart draws the warning and cut-off lines too.
  health: { read: (q) => ({ ...health.read(q), warnC: get("tempWarnC"), critC: get("tempCritC") }) },
  auth: settings,
  hostNames: webHostNames,
  httpsRedirect: () => (get("httpsOnly") && https?.listening ? get("httpsPort") : null),
  tls: {
    get: tlsView,
    upload: async (cert, key) => {
      tlsStore.install(cert, key);
      await startHttps();
      return tlsView();
    },
    selfSigned: async () => {
      await tlsStore.generate({ names: webHostNames(), ips: ownAddresses() });
      await startHttps();
      return tlsView();
    },
    remove: async () => {
      tlsStore.remove();
      await startHttps();
      return tlsView();
    },
  },
  status: () => {
    const codes = pairingCodes({ evenIfPaired: !get("hidePairingWhenPaired") });
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
      dmx: { enabled: get("dmxEnabled"), inControl: dmx.inControl, values: dmx.values, ...receiver.status() },
      thermal: { enabled: get("thermalEnabled"), ...thermalState, tripped: guard.blocked },
      schedule: { enabled: get("schedule").enabled, waitingForClock: scheduler.waitingForClock, next: next && { at: new Date(next.at).toISOString(), on: next.on, label: next.label } },
      clock: { synced: clockSynced(), now: new Date().toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      quiet: { active: quietNow(get("quietHours"), new Date(), { clockOk: clockSynced() }), cap: get("quietHours").volumeCap, noScares: get("quietHours").disableScares },
      version: versionStatus(),
      checks: selfCheck.last && { at: selfCheck.last.at, ...selfCheck.last.summary },
      web: { passwordSet: settings.passwordSet, https: httpsState() },
      network,
      storage,
      usb: usb.status,
      matter: {
        commissioned: server.lifecycle.isCommissioned,
        fabrics: Object.keys(server.state.commissioning.fabrics ?? {}).length,
        manualPairingCode: codes?.manualPairingCode ?? null,
      },
    };
  },
  problem: () => media.problem({ mode: dmxOverride.mode ?? get("mode"), buffer: get("scareBuffer"), scares: get("scareClips") }),
  setPower: async (on) => {
    const r = requestPower("web", on);
    if (!r.ok) throw new HttpError(409, r.reason);
  },
  setPaused: (paused) => {
    if (dmx.inControl) throw new HttpError(409, "DMX is in control");
    if (!player.isPlaying) throw new HttpError(409, "nothing is playing");
    player.setPaused(paused);
  },
  setVolume: (v) => {
    if (dmx.inControl) throw new HttpError(409, "DMX is in control");
    return volume.set(v);
  },
  scare: () => player.trigger("web page"),
  backup: () =>
    createBackup({
      settingsFile: settings.file,
      playlistPath: get("playlist"),
      matterDir: join(stateDir, "matter"),
      device: ctx.hostName,
      version: currentVersion,
    }),
  restore: async (body) => {
    let v;
    try {
      v = validateBackup(body.backup);
    } catch (err) {
      throw new HttpError(400, err.message);
    }
    if (body.includeMatter === true && body.confirmMatter !== true) {
      throw new HttpError(400, "Restoring the Matter pairing needs confirmation");
    }
    // Entries may carry the other Pi's absolute paths: keep the file names.
    const entries = parsePlaylist(v.playlist, "").map((e) => ({ ...e, file: e.file.split("/").pop() }));
    if (entries.length) await media.writePlaylist(entries, { shuffle: isShuffled(v.playlist) });
    const r = await stageRestore(v, { settingsFile: settings.file, stateDir, includeMatter: body.includeMatter === true });
    restartService();
    return { restored: { settings: true, playlist: entries.length, matter: r.matter }, restarting: true };
  },
  checks: { last: () => selfCheck.last, run: () => selfCheck.run() },
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
    const codes = pairingCodes({ evenIfPaired: !get("hidePairingWhenPaired") });
    return codes && qrTextToSvg(codes.qrText);
  },
  // Factory reset of the Matter node only (media, playlist and settings stay).
  resetMatter: async () =>
    restartService(async () => {
      console.warn("Resetting Matter pairing");
      await server.erase();
    }),
  checkUpdate: () => askHelper({ action: "check" }),
  upgrade: async () => {
    if (!versionStatus().available) return { error: "no-update" };
    return askHelper({ action: "upgrade" });
  },
  restart: async () => {
    console.warn("Restart requested from the web UI");
    restartService();
  },
});
const web = createHttpServer(webHandler);
web.on("error", (err) => console.error(`Web UI: ${err.message}`));
web.listen(get("httpPort"), () => console.info(`Web UI on port ${get("httpPort")}`));
startHttps();

// Start mpv (it idles until there is something to play), the schedule, then
// restore the last state (or the configured one).
mpv.start();
scheduler.start();
const initial = player.initialState(get("restore"));
// Matter's saved attribute already matches: apply it without holding start-up
// while the projector wakes (relay settle time, then up to 20 s for HDMI).
if (plug.state.onOff.onOff === initial) powerChanged(initial).catch((err) => console.error(`Power: ${err.message}`));
else await writePower(initial);
scheduleCatchUp();

// Tell systemd we are up once our own start-up is done. Not when Matter comes
// online: with the Wi-Fi down that may never happen, and systemd would restart us
// every TimeoutStartSec (cycling the projector) although playback works.
watchdog.ready().catch(() => {});

// run() starts the node and resolves when it is closed; matter.js closes it on
// SIGTERM/SIGINT. While not commissioned it logs the pairing QR code and manual
// code to stdout, which is the journal under systemd.
await server.run();
stopping = true;
health.event("info", "Service stopped");
await watchdog.stopping();
web.close();
stopHttps();
scheduler.stop();
display.stop();
pir?.stop();
if (thermalTimer) clearInterval(thermalTimer);
dmxSocket?.close();
// Fade out rather than cut, and leave the console black behind mpv.
await player.fadeOut();
screen.black();
await player.shutdown();
// A relay-switched projector goes off (videofx-relay-open covers a crash or kill).
await projector.shutdown();
relay.release();
