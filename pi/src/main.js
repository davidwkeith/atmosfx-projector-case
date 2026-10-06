// VideoFX player: a Matter device that loops a playlist (or runs startle scares)
// full screen with mpv, switches the projector with it, and serves a LAN web UI.
//
// Matter endpoints: 1 "projector" (main on/off), 2 "scare" (on = fire a scare,
// goes back off when it ends), 3 "motion" (PIR occupancy sensor),
// 4 "temperature" (projector zone).
//
// Who controls the main power: Matter, the web page, the schedule and restore go
// through the PowerArbiter; while DMX (sACN) is live only DMX may; thermal
// protection can always switch off and blocks switching on while tripped.

import { execFile, spawn } from "node:child_process";
import dgram from "node:dgram";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { access, readFile, readdir, writeFile } from "node:fs/promises";
import { hostname } from "node:os";
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
import { DisplayWatch, displayConnected } from "./display.js";
import { DmxControl, InternalWrites, PowerArbiter, SACN_PORT, SacnReceiver, fixtureValues, interpret, multicastGroup } from "./dmx.js";
import { writeFileAtomicSync } from "./fsutil.js";
import { GpioOut, gpiosetArgs } from "./gpio.js";
import { Ir, lircFeatures } from "./ir.js";
import { HttpError, createMediaStore } from "./media.js";
import { parsePlaylist } from "./playlist-core.js";
import { MpvSupervisor, mpvArgs } from "./mpv.js";
import { Pir, gpiomonMajor, pirArgs } from "./pir.js";
import { Player } from "./player.js";
import { Projector } from "./projector.js";
import { qrTextToSvg } from "./qr.js";
import { Scheduler, missedEvent } from "./schedule.js";
import { createScreen } from "./screen.js";
import { Settings } from "./settings.js";
import { TIMESYNC_FLAG, parseIwLink, parseNmcliDevices, signalVerdict, storageStatus } from "./system.js";
import { Watchdog } from "./watchdog.js";
import { capVolume, quietNow, scareBlocked } from "./quiet.js";
import { readVersion, updateStatus } from "./update.js";
import { OverTempGuard, SysfsPwm, Tach, ThermalControl, parseDs18b20, parseMilli, tachArgs } from "./thermal.js";
import { Volume, amixerArgs } from "./volume.js";
import { createWebServer } from "./web.js";

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

// A restore from the web page staged Matter storage: swap it in before matter.js opens it.
await applyStagedRestore(stateDir);

// Matter fabrics, keys and the random pairing passcode live here. Deleting this
// directory (or "Reset Matter pairing" in the web UI) is a factory reset.
Environment.default.vars.set("storage.path", join(stateDir, "matter"));
const appDir = fileURLToPath(new URL("..", import.meta.url));
const currentVersion = readVersion(appDir);

// --- audio, screen, media

const volume = new Volume({
  store: {
    load: () => ({ level: get("volume"), muted: get("muted") }),
    save: ({ level, muted }) => settings.update({ volume: level, muted }),
  },
  apply: (v) => run("amixer", amixerArgs(get("audioCard"), get("mixerControl"), capVolume(v, get("quietHours"), new Date(), { clockOk: clockSynced() }))),
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
// Uploads cut short by a crash or power cut would otherwise fill the card over time.
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
display.start();

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

// The player gave up (no playlist, repeated crashes): report "off" so the
// controller shows the truth. Deferred so we never write inside the change event.
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
      return run("amixer", amixerArgs(get("audioCard"), get("mixerControl"), capVolume(v, get("quietHours"), new Date(), { source: "dmx", clockOk: clockSynced() }))).catch(() => {});
    },
    setDimmer: (v) => player.setDimmer(v),
  },
});
const receiver = new SacnReceiver({ universe: get("dmxUniverse") });
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

// --- heat: fans, sensors, protection

const guard = new OverTempGuard({
  isOn: () => player.isOn,
  powerOff: () => requestPower("thermal", false),
  // Resume: under DMX, whatever DMX asks for; otherwise back on.
  powerOn: () => requestPower("thermal", dmx.inControl ? interpret(dmx.values ?? [0]).power : true),
});
const thermal = new ThermalControl({
  cfg: () => ({
    curves: [get("fan1Curve"), get("fan2Curve")],
    minDuty: get("fanMinDuty"),
    cooldownSec: get("fanCooldownSec"),
    warnC: get("tempWarnC"),
    critC: get("tempCritC"),
    hysteresisC: get("tempHysteresisC"),
    failRpm: 200,
    failAfterSec: 5,
    sensorLossSec: 60,
  }),
});
thermal.on("critical", ({ temp, reason }) => guard.critical(temp, get("tempCritC"), reason));
thermal.on("cleared", ({ temp }) => guard.cleared(temp));
const sysfs = { access, readFile, writeFile };
const fans = [new SysfsPwm({ channel: 0, fs: sysfs }), new SysfsPwm({ channel: 1, fs: sysfs })];
let tach = null;
let sensorsSeen = [];
let lastRpm = [null, null];
const fanErrors = [null, null];
let thermalTimer = null;
let stopping = false;

// Not under thermal control (Cooling off, or shutting down): run the fans flat
// out. Left alone, the PWM pins idle low, which a 4-pin fan reads as "stop".
async function fansFull() {
  await Promise.all(
    fans.map((f, i) =>
      f.set(100).then(
        () => (fanErrors[i] = null),
        (err) => {
          if (fanErrors[i] !== err.message) console.info(`Fan ${i + 1}: not driven (${err.message})`); // once per new error
          fanErrors[i] = err.message;
        },
      ),
    ),
  );
}

async function readSensor(id) {
  if (!id) return null;
  const dir = `/sys/bus/w1/devices/${id}`;
  for (const f of ["temperature", "w1_slave"]) {
    try {
      return parseDs18b20(await readFile(`${dir}/${f}`, "utf8"));
    } catch {
      // try the next file
    }
  }
  return null;
}

async function thermalTick() {
  try {
    sensorsSeen = (await readdir("/sys/bus/w1/devices").catch(() => [])).filter((d) => d.startsWith("28-"));
    const [projectorC, piC, socC] = await Promise.all([
      readSensor(get("sensorProjector")),
      readSensor(get("sensorPi")),
      readFile("/sys/class/thermal/thermal_zone0/temp", "utf8").then(parseMilli, () => null),
    ]);
    lastRpm = tach?.rpm() ?? [null, null];
    if (stopping || !get("thermalEnabled")) return; // switched off while reading
    const state = thermal.update({ projectorC, piC, socC, rpm: lastRpm, on: player.isOn });
    await Promise.all(
      fans.map((f, i) =>
        f.set(state.duty[i]).then(
          () => (fanErrors[i] = null),
          (err) => {
            if (fanErrors[i] !== err.message) console.warn(`Fan ${i + 1}: ${err.message}`); // once per new error
            fanErrors[i] = err.message;
          },
        ),
      ),
    );
    const value = projectorC === null ? null : Math.round(projectorC * 100);
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
  tach?.stop();
  tach = null;
  if (!get("thermalEnabled")) {
    // No protection: forget any trip (or it would block power-on for good).
    thermal.reset();
    guard.reset();
    lastRpm = [null, null];
    fansFull();
    return;
  }
  if (gpiodMajor !== null) {
    tach = new Tach({ spawn, args: tachArgs(gpiodMajor, [get("fan1TachPin"), get("fan2TachPin")]), lines: gpiodMajor >= 2 ? [`GPIO${get("fan1TachPin")}`, `GPIO${get("fan2TachPin")}`] : [get("fan1TachPin"), get("fan2TachPin")] });
    tach.start();
  }
  thermalTimer = setInterval(thermalTick, 2000);
  thermalTick();
}
startThermal();

// --- quiet hours: re-apply the volume when they start or end

let quietActive = null;
setInterval(() => {
  const now = quietNow(get("quietHours"), new Date(), { clockOk: clockSynced() });
  if (now === quietActive) return;
  quietActive = now;
  if (dmx.inControl && dmxVolume) run("amixer", amixerArgs(get("audioCard"), get("mixerControl"), capVolume(dmxVolume, get("quietHours"), new Date(), { source: "dmx", clockOk: clockSynced() }))).catch(() => {});
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
    return lagMs > 5000 ? `event loop blocked for ${Math.round(lagMs)} ms` : null;
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
      if (get("thermalEnabled") && !get("sensorProjector")) {
        return "Choose the projector-zone sensor: with no reading, playback stops after 60 s.";
      }
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
      thermal: { enabled: get("thermalEnabled"), ...thermal.state, rpm: lastRpm, sensors: sensorsSeen, tripped: guard.blocked },
      schedule: { enabled: get("schedule").enabled, waitingForClock: scheduler.waitingForClock, next: next && { at: new Date(next.at).toISOString(), on: next.on, label: next.label } },
      clock: { synced: clockSynced(), now: new Date().toISOString() },
      quiet: { active: quietNow(get("quietHours"), new Date(), { clockOk: clockSynced() }), cap: get("quietHours").volumeCap, noScares: get("quietHours").disableScares },
      version: updateStatus(currentVersion, (() => { try { return readFileSync(join(stateDir, "update-check.json"), "utf8"); } catch { return ""; } })()),
      web: { passwordSet: settings.passwordSet },
      network,
      storage,
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
    if (entries.length) await media.writePlaylist(entries);
    const r = await stageRestore(v, { settingsFile: settings.file, stateDir, includeMatter: body.includeMatter === true });
    restartService();
    return { restored: { settings: true, playlist: entries.length, matter: r.matter }, restarting: true };
  },
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
await watchdog.stopping();
web.close();
scheduler.stop();
display.stop();
pir?.stop();
tach?.stop();
if (thermalTimer) clearInterval(thermalTimer);
dmxSocket?.close();
await player.shutdown();
// Nothing watches the temperature from here on: fans flat out, and a
// relay-switched projector off (videofx-relay-open covers a crash or kill).
await fansFull();
await projector.shutdown();
relay.release();
