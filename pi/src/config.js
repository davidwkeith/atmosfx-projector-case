// Every setting: its /etc/default/videofx variable, default, validation and how a
// change takes effect. settings.js layers web-made values (settings.json) on top;
// both paths validate with the parse() functions here.

import { readFileSync } from "node:fs";
import { homedir, hostname, networkInterfaces } from "node:os";
import { isAbsolute, join } from "node:path";
import { checkMpvArgs } from "./mpv.js";
import { parseIrCode } from "./ir.js";
import { RESERVED_GPIOS } from "./pir.js";
import { PROJECTOR_MODES } from "./projector.js";
import { isMediaFile } from "./playlist-core.js";
import { DEFAULT_QUIET, parseQuiet } from "./quiet.js";
import { DEFAULT_SCHEDULE, parseSchedule } from "./schedule.js";
import { parseCurve } from "./thermal.js";
import { clampLevel } from "./volume.js";

const RESTORE_POLICIES = ["last", "on", "off"];

// Words, not a shell: split on whitespace. mpv is spawned without a shell.
const words = (s) => (s ?? "").split(/\s+/).filter(Boolean);

/**
 * Names from the last 4 hex digits of eth0's MAC (wlan0 as fallback): the display
 * name VideoFX-ABCD (Matter, web page, Bonjour) and the hostname videofx-abcd.
 * The first-boot unit sets the hostname the same way, so normally both agree.
 */
export function deviceIds(host = hostname(), ifaces = networkInterfaces()) {
  let hex = /^videofx-([0-9a-f]{4})$/i.exec(host)?.[1];
  for (const name of ["eth0", "wlan0"]) {
    if (hex) break;
    const mac = ifaces[name]?.find((a) => a.mac && a.mac !== "00:00:00:00:00:00")?.mac;
    if (mac) hex = mac.replace(/:/g, "").slice(-4);
  }
  if (!hex) return { display: host, host: host.toLowerCase() };
  return { display: `VideoFX-${hex.toUpperCase()}`, host: `videofx-${hex.toLowerCase()}` };
}

export const deviceName = (host, ifaces) => deviceIds(host, ifaces).display;

const text = (re, why, max = 64) => (v) => {
  if (typeof v !== "string") throw new Error("must be text");
  const s = v.trim();
  if (s.length > max || !re.test(s)) throw new Error(why);
  return s;
};

const int = (min, max) => (v) => {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  if (typeof n !== "number" || !Number.isInteger(n) || n < min || n > max) {
    throw new Error(`must be a whole number from ${min} to ${max}`);
  }
  return n;
};

const bool = (v) => {
  if (v === true || v === "true" || v === "1") return true;
  if (v === false || v === "false" || v === "0") return false;
  throw new Error("must be true or false");
};

const oneOf = (options) => (v) => {
  if (!options.includes(v)) throw new Error(`must be one of ${options.join(", ")}`);
  return v;
};

const coord = (max) => (v) => {
  if (v === "" || v === null) return null;
  const n = typeof v === "string" ? Number(v) : v;
  if (typeof n !== "number" || !Number.isFinite(n) || n < -max || n > max) throw new Error(`must be a number from -${max} to ${max}, or empty`);
  return Math.round(n * 1e4) / 1e4;
};

// BCM GPIO on the 40-pin header, not one the Amp4 (or the ID EEPROM) uses.
const gpioPin = (v) => {
  const n = int(2, 27)(v);
  if (RESERVED_GPIOS.includes(n)) throw new Error(`GPIO${n} is used by the Amp4 or reserved; pick another`);
  return n;
};

const PIN_ROLES = {
  pirPin: "PIR",
  relayPin: "relay",
  irTxPin: "IR LED",
  irRxPin: "IR receiver",
  fan1PwmPin: "projector fan PWM",
  fan2PwmPin: "Pi fan PWM",
  fan1TachPin: "projector fan tach",
  fan2TachPin: "Pi fan tach",
  w1Pin: "1-wire sensors",
};

/** Cross-setting check: one role per pin, and pwm-ir-tx only on GPIO12. Returns an error message or undefined. */
export function checkPins(values) {
  const seen = new Map();
  for (const [key, role] of Object.entries(PIN_ROLES)) {
    const pin = values[key];
    if (pin === undefined) continue;
    if (RESERVED_GPIOS.includes(pin)) return `${role}: GPIO${pin} is used by the Amp4 or reserved`;
    if (seen.has(pin)) return `GPIO${pin} is set for both the ${seen.get(pin)} and the ${role}`;
    seen.set(pin, role);
  }
  if (values.irTxDriver === "pwm-ir-tx") return "pwm-ir-tx needs hardware PWM0 (GPIO12), which the projector fan uses: use gpio-ir-tx";
  if (values.tempWarnC !== undefined && values.tempCritC !== undefined && values.tempWarnC >= values.tempCritC) return "the warning temperature must be below the critical one";
  return undefined;
}

const romId = (v) => {
  if (v === "" || v === null) return "";
  if (typeof v !== "string" || !/^28-[0-9a-f]{12}$/.test(v)) throw new Error("must be a DS18B20 ROM ID like 28-0123456789ab, or empty");
  return v;
};

const absPath = (v) => {
  if (typeof v !== "string" || !isAbsolute(v)) throw new Error("must be an absolute path");
  return v;
};

/**
 * apply: "live" (at once), "play" (next time playback starts), "restart"
 * (service restart), "fixed" (only in /etc/default/videofx: needs root or is a path).
 * Order matters: a default may use values resolved above it.
 */
export const SETTINGS = [
  {
    key: "name",
    env: "VIDEOFX_NAME",
    group: "Device",
    label: "Device name",
    help: "Shown in Matter controllers and on this page. Up to 32 characters.",
    apply: "live",
    default: (_, ctx) => ctx.deviceName,
    parse: text(/^[A-Za-z0-9][A-Za-z0-9 ._'-]{0,31}$/, "must be 1-32 letters, digits, spaces or . _ ' - (starting with a letter or digit)", 32),
  },
  {
    key: "restore",
    env: "VIDEOFX_RESTORE",
    group: "Device",
    label: "After a power cut",
    help: "last: as it was; on: always play; off: always stay off.",
    apply: "live",
    options: RESTORE_POLICIES,
    default: () => "last",
    parse: oneOf(RESTORE_POLICIES),
  },
  {
    key: "password",
    env: "VIDEOFX_WEB_PASSWORD",
    group: "Web page",
    label: "Password",
    help: "HTTP basic auth, any user name. Plain HTTP on your LAN, not HTTPS.",
    apply: "live",
    secret: true,
    allowEmpty: true,
    default: () => "",
    parse: (v) => {
      if (typeof v !== "string") throw new Error("must be text");
      if (v === "") return "";
      if (v.length < 6 || v.length > 128) throw new Error("must be 6-128 characters");
      if (/[\x00-\x1f\x7f]/.test(v)) throw new Error("must not contain control characters");
      return v;
    },
  },
  {
    key: "webHosts",
    env: "VIDEOFX_WEB_HOSTS",
    group: "Web page",
    label: "Extra host names",
    help: "Other names this page answers to, e.g. a UniFi local DNS record. Space separated.",
    apply: "live",
    allowEmpty: true,
    default: () => [],
    parse: (v) => {
      const list = Array.isArray(v) ? v : typeof v === "string" ? words(v) : null;
      if (!list) throw new Error("must be a list of host names");
      if (list.length > 10) throw new Error("10 host names at most");
      for (const h of list) {
        if (typeof h !== "string" || h.length > 253 || !/^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)*$/.test(h)) {
          throw new Error(`"${h}" is not a valid host name`);
        }
      }
      return list.map((h) => h.toLowerCase());
    },
  },
  {
    key: "maxUploadMb",
    env: "VIDEOFX_MAX_UPLOAD_MB",
    group: "Web page",
    label: "Largest upload (MB)",
    apply: "live",
    default: () => 4096,
    parse: int(1, 65536),
  },
  {
    key: "volume",
    env: "VIDEOFX_VOLUME_DEFAULT",
    group: "Audio",
    label: "Volume (%)",
    help: "The slider above sets this too. The file value is only the starting level.",
    apply: "live",
    default: () => 30,
    parse: clampLevel,
  },
  {
    key: "muted",
    group: "Audio",
    label: "Muted",
    apply: "live",
    default: () => false,
    parse: bool,
  },
  {
    key: "audioCard",
    env: "VIDEOFX_AUDIO_CARD",
    group: "Audio",
    label: "ALSA card name",
    help: "Card by name, never by number. HiFiBerry Amp4: sndrpihifiberry.",
    apply: "play",
    default: () => "sndrpihifiberry",
    parse: text(/^[A-Za-z0-9_-]{1,32}$/, "must be 1-32 letters, digits, _ or -", 32),
  },
  {
    key: "mixerControl",
    env: "VIDEOFX_MIXER_CONTROL",
    group: "Audio",
    label: "Mixer control",
    help: "Hardware volume control on the card. Amp4: Digital.",
    apply: "play",
    default: () => "Digital",
    parse: text(/^[A-Za-z0-9][A-Za-z0-9 _-]{0,39}$/, "must be 1-40 letters, digits, spaces, _ or -", 40),
  },
  {
    key: "videoOutput",
    env: "VIDEOFX_VIDEO_OUTPUT",
    group: "Display",
    label: "Video output (DRM connector)",
    help: "HDMI-A-1 is the only HDMI port on a Pi 3 / Zero 2 W, and HDMI0 (next to USB-C) on a Pi 4B / 5. Empty lets mpv choose.",
    apply: "play",
    allowEmpty: true,
    default: () => "HDMI-A-1",
    parse: (v) => {
      if (v === "") return "";
      if (typeof v !== "string" || !/^[A-Za-z]+(-[A-Za-z])?-[0-9]{1,2}$/.test(v)) throw new Error("must be a DRM connector like HDMI-A-1, or empty");
      return v;
    },
  },
  {
    key: "projectorPower",
    env: "VIDEOFX_PROJECTOR_POWER",
    group: "Projector",
    label: "Projector power",
    help: "cec: HDMI-CEC wake/standby (falls back to hdmi-off if the projector never answers). relay-ir: relay on the DC feed, then the IR power code. relay: relay only, for projectors that switch on by themselves. hdmi-off: turn the HDMI signal off when stopped. none: leave it alone.",
    apply: "live",
    options: PROJECTOR_MODES,
    default: () => "cec",
    parse: oneOf(PROJECTOR_MODES),
  },
  {
    key: "relaySettleSec",
    env: "VIDEOFX_RELAY_SETTLE_SEC",
    group: "Projector",
    label: "Relay settle time (s)",
    help: "relay / relay-ir: wait this long after power-up before sending IR and starting playback.",
    apply: "live",
    default: () => 3,
    parse: int(0, 60),
  },
  {
    key: "irPowerCode",
    env: "VIDEOFX_IR_POWER_CODE",
    group: "Projector",
    label: "IR power code",
    help: "protocol:scancode (e.g. nec:0x40bf) or raw:+9000 -4500 ... Learn it with the receiver, or paste it.",
    apply: "live",
    custom: true,
    allowEmpty: true,
    default: () => "",
    parse: parseIrCode,
  },
  {
    key: "irDoublePress",
    env: "VIDEOFX_IR_DOUBLE_PRESS",
    group: "Projector",
    label: "Projector needs two power presses",
    apply: "live",
    default: () => false,
    parse: bool,
  },
  {
    key: "cecDevice",
    env: "VIDEOFX_CEC_DEVICE",
    group: "Projector",
    label: "CEC device",
    help: "/dev/cec0 is HDMI0 (the only port on a Pi 3 / Zero 2 W).",
    apply: "live",
    default: () => "/dev/cec0",
    parse: text(/^\/dev\/cec[0-9]$/, "must be /dev/cecN", 12),
  },
  {
    key: "mirror",
    env: "VIDEOFX_MIRROR",
    group: "Display",
    label: "Mirror (flip left-right)",
    help: "For rear projection onto window material. Uses more CPU: frames are flipped in software.",
    apply: "live",
    default: () => false,
    parse: bool,
  },
  {
    key: "mpvExtraArgs",
    env: "VIDEOFX_MPV_EXTRA_ARGS",
    group: "Advanced",
    label: "Extra mpv options",
    help: "--name=value options, space separated, added after the built-in ones (so they can override them), e.g. --hwdec=v4l2m2m-copy.",
    apply: "play",
    advanced: true,
    allowEmpty: true,
    default: () => "",
    parse: checkMpvArgs,
  },
  {
    key: "mode",
    env: "VIDEOFX_MODE",
    group: "Playback",
    label: "Mode",
    help: "loop: play the playlist over and over. scare: loop a calm clip and play a scare clip on a trigger.",
    apply: "live",
    options: ["loop", "scare"],
    default: () => "loop",
    parse: oneOf(["loop", "scare"]),
  },
  {
    key: "scareBuffer",
    env: "VIDEOFX_SCARE_BUFFER",
    group: "Scare",
    label: "Calm clip (loops between scares)",
    apply: "live",
    custom: true,
    allowEmpty: true,
    default: () => "",
    parse: (v) => {
      if (v === "" || v === null) return "";
      if (!isMediaFile(v)) throw new Error("must be a video file name in the media folder");
      return v;
    },
  },
  {
    key: "scareClips",
    env: "VIDEOFX_SCARE_CLIPS",
    group: "Scare",
    label: "Scare clips",
    help: "In /etc/default/videofx: a JSON list of file names.",
    apply: "live",
    custom: true,
    allowEmpty: true,
    default: () => [],
    parse: (v) => {
      if (typeof v === "string") {
        if (v.trim() === "") return [];
        try {
          v = JSON.parse(v);
        } catch {
          throw new Error("must be a JSON list of file names");
        }
      }
      if (!Array.isArray(v)) throw new Error("must be a list of file names");
      if (v.length > 100) throw new Error("100 clips at most");
      for (const f of v) if (!isMediaFile(f)) throw new Error(`"${f}" is not a video file name`);
      return [...new Set(v)];
    },
  },
  {
    key: "scareOrder",
    env: "VIDEOFX_SCARE_ORDER",
    group: "Scare",
    label: "Scare order",
    apply: "live",
    options: ["sequential", "random"],
    default: () => "sequential",
    parse: oneOf(["sequential", "random"]),
  },
  {
    key: "scareCooldown",
    env: "VIDEOFX_SCARE_COOLDOWN",
    group: "Scare",
    label: "Cooldown after a scare (s)",
    help: "Triggers are ignored for this long after a scare ends.",
    apply: "live",
    default: () => 20,
    parse: int(0, 3600),
  },
  {
    key: "scareDuringScare",
    env: "VIDEOFX_SCARE_DURING_SCARE",
    group: "Scare",
    label: "Trigger during a scare",
    help: "ignore it, or queue one scare that plays when this one ends and the cooldown is over.",
    apply: "live",
    options: ["ignore", "queue"],
    default: () => "ignore",
    parse: oneOf(["ignore", "queue"]),
  },
  {
    key: "pirEnabled",
    env: "VIDEOFX_PIR",
    group: "Motion sensor",
    label: "PIR motion sensor",
    help: "Scares only fire when playback is on and the mode is scare. Also shown in Matter as an occupancy sensor.",
    apply: "live",
    default: () => false,
    parse: bool,
  },
  {
    key: "pirPin",
    env: "VIDEOFX_PIR_GPIO",
    group: "Motion sensor",
    label: "PIR GPIO (BCM number)",
    help: "GPIO17 is physical pin 11. The Amp4 uses GPIO 2, 3, 4 and 18-21.",
    apply: "live",
    default: () => 17,
    parse: gpioPin,
  },
  {
    key: "pirDebounceMs",
    env: "VIDEOFX_PIR_DEBOUNCE_MS",
    group: "Motion sensor",
    label: "PIR debounce (ms)",
    apply: "live",
    default: () => 50,
    parse: int(0, 1000),
  },
  {
    key: "latitude",
    env: "VIDEOFX_LATITUDE",
    group: "Schedule",
    label: "Latitude",
    help: "For sunset. Degrees, north positive. Two decimals are plenty.",
    apply: "live",
    allowEmpty: true,
    default: () => null,
    parse: coord(90),
  },
  {
    key: "longitude",
    env: "VIDEOFX_LONGITUDE",
    group: "Schedule",
    label: "Longitude",
    help: "Degrees, east positive (west is negative).",
    apply: "live",
    allowEmpty: true,
    default: () => null,
    parse: coord(180),
  },
  {
    key: "schedule",
    env: "VIDEOFX_SCHEDULE",
    group: "Schedule",
    label: "Weekly schedule",
    help: "In /etc/default/videofx: JSON.",
    apply: "live",
    custom: true,
    default: () => structuredClone(DEFAULT_SCHEDULE),
    parse: parseSchedule,
  },
  {
    key: "thermalEnabled",
    env: "VIDEOFX_THERMAL",
    group: "Cooling",
    label: "Fans and temperature protection",
    help: "Turn on once the fans and DS18B20 sensors are wired.",
    apply: "live",
    default: () => false,
    parse: bool,
  },
  {
    key: "fan1Curve",
    env: "VIDEOFX_FAN1_CURVE",
    group: "Cooling",
    label: "Projector fan curve (°C:duty%)",
    help: "Linear between points, e.g. 30:25 40:50 50:100.",
    apply: "live",
    default: () => "30:25 40:50 50:100",
    parse: parseCurve,
  },
  {
    key: "fan2Curve",
    env: "VIDEOFX_FAN2_CURVE",
    group: "Cooling",
    label: "Pi/brick fan curve (°C:duty%)",
    help: "Follows the hotter of the Pi-zone sensor and the SoC.",
    apply: "live",
    default: () => "45:25 60:60 70:100",
    parse: parseCurve,
  },
  {
    key: "fanMinDuty",
    env: "VIDEOFX_FAN_MIN_DUTY",
    group: "Cooling",
    label: "Minimum fan duty while the projector is on (%)",
    apply: "live",
    default: () => 30,
    parse: int(0, 100),
  },
  {
    key: "fanCooldownSec",
    env: "VIDEOFX_FAN_COOLDOWN_SEC",
    group: "Cooling",
    label: "Projector fan run-on after power-off (s)",
    apply: "live",
    default: () => 120,
    parse: int(0, 3600),
  },
  {
    key: "tempWarnC",
    env: "VIDEOFX_TEMP_WARN_C",
    group: "Cooling",
    label: "Warning temperature (°C)",
    apply: "live",
    default: () => 45,
    parse: int(20, 90),
  },
  {
    key: "tempCritC",
    env: "VIDEOFX_TEMP_CRIT_C",
    group: "Cooling",
    label: "Critical projector-zone temperature (°C)",
    help: "Stops playback and switches the projector off until it cools by the hysteresis.",
    apply: "live",
    default: () => 55,
    parse: int(30, 95),
  },
  {
    key: "tempHysteresisC",
    env: "VIDEOFX_TEMP_HYSTERESIS_C",
    group: "Cooling",
    label: "Cool-down before resuming (°C below critical)",
    apply: "live",
    default: () => 5,
    parse: int(1, 20),
  },
  {
    key: "sensorProjector",
    env: "VIDEOFX_SENSOR_PROJECTOR",
    group: "Cooling",
    label: "Projector-zone sensor (DS18B20 ROM ID)",
    apply: "live",
    custom: true,
    allowEmpty: true,
    default: () => "",
    parse: romId,
  },
  {
    key: "sensorPi",
    env: "VIDEOFX_SENSOR_PI",
    group: "Cooling",
    label: "Pi-zone sensor (DS18B20 ROM ID)",
    apply: "live",
    custom: true,
    allowEmpty: true,
    default: () => "",
    parse: romId,
  },
  {
    key: "dmxEnabled",
    env: "VIDEOFX_DMX",
    group: "DMX",
    label: "DMX (sACN / E1.31) control",
    help: "While a source sends our universe, DMX controls power, mode, clip, volume, mute and dimmer.",
    apply: "live",
    default: () => false,
    parse: bool,
  },
  {
    key: "dmxUniverse",
    env: "VIDEOFX_DMX_UNIVERSE",
    group: "DMX",
    label: "Universe",
    apply: "live",
    default: () => 1,
    parse: int(1, 63999),
  },
  {
    key: "dmxAddress",
    env: "VIDEOFX_DMX_ADDRESS",
    group: "DMX",
    label: "Start address",
    help: "8 channels from here (1-505).",
    apply: "live",
    default: () => 1,
    parse: int(1, 505),
  },
  {
    key: "dmxHoldSec",
    env: "VIDEOFX_DMX_HOLD_SEC",
    group: "DMX",
    label: "Hold after the signal stops (s)",
    help: "Added to the 2.5 s sACN data-loss timeout before control goes back to Matter, the web page and the schedule.",
    apply: "live",
    default: () => 5,
    parse: int(0, 600),
  },
  {
    key: "dmxMulticast",
    env: "VIDEOFX_DMX_MULTICAST",
    group: "DMX",
    label: "Accept multicast",
    help: "Off: unicast only (recommended on Wi-Fi; send to this Pi's IP address).",
    apply: "live",
    default: () => true,
    parse: bool,
  },
  {
    key: "quietHours",
    env: "VIDEOFX_QUIET_HOURS",
    group: "Schedule",
    label: "Quiet hours",
    help: "In /etc/default/videofx: JSON.",
    apply: "live",
    custom: true,
    default: () => structuredClone(DEFAULT_QUIET),
    parse: parseQuiet,
  },
  {
    key: "hidePairingWhenPaired",
    env: "VIDEOFX_HIDE_PAIRING_WHEN_PAIRED",
    group: "Web page",
    label: "Hide the Matter pairing code once paired",
    help: "Anyone who can open this page could use the code while pairing mode is open.",
    apply: "live",
    default: () => true,
    parse: bool,
  },
  {
    key: "console",
    env: "VIDEOFX_CONSOLE",
    group: "Display",
    label: "Console for the black / pairing screen",
    help: "Empty disables it.",
    apply: "restart",
    allowEmpty: true,
    default: () => "/dev/tty1",
    parse: (v) => {
      if (v === "") return "";
      if (typeof v !== "string" || !/^\/dev\/tty[0-9]{1,2}$/.test(v)) throw new Error("must be empty or /dev/ttyN");
      return v;
    },
  },
  // Fixed: ports need root to change (port 80 capability, avahi service file);
  // paths and the player binary would let the web page point the service anywhere.
  // GPIO pins wired to the header. The relay and IR pins are also set in
  // config.txt (boot level, IR overlays), which needs root, so they are file-only.
  { key: "relayPin", env: "VIDEOFX_RELAY_GPIO", group: "Fixed", label: "Relay GPIO (BCM)", apply: "fixed", default: () => 27, parse: gpioPin },
  { key: "relayActiveLow", env: "VIDEOFX_RELAY_ACTIVE_LOW", group: "Fixed", label: "Relay input is active-low", apply: "fixed", default: () => true, parse: bool },
  { key: "irTxPin", env: "VIDEOFX_IR_TX_GPIO", group: "Fixed", label: "IR LED GPIO (BCM)", apply: "fixed", default: () => 22, parse: gpioPin },
  { key: "irTxDriver", env: "VIDEOFX_IR_TX_DRIVER", group: "Fixed", label: "IR LED driver", apply: "fixed", options: ["gpio-ir-tx", "pwm-ir-tx"], default: () => "gpio-ir-tx", parse: oneOf(["gpio-ir-tx", "pwm-ir-tx"]) },
  { key: "irRxPin", env: "VIDEOFX_IR_RX_GPIO", group: "Fixed", label: "IR receiver GPIO (BCM)", apply: "fixed", default: () => 23, parse: gpioPin },
  { key: "fan1PwmPin", env: "VIDEOFX_FAN1_PWM_GPIO", group: "Fixed", label: "Projector fan PWM GPIO (hardware PWM0)", apply: "fixed", default: () => 12, parse: oneOf([12]) },
  { key: "fan2PwmPin", env: "VIDEOFX_FAN2_PWM_GPIO", group: "Fixed", label: "Pi/brick fan PWM GPIO (hardware PWM1)", apply: "fixed", default: () => 13, parse: oneOf([13]) },
  { key: "fan1TachPin", env: "VIDEOFX_FAN1_TACH_GPIO", group: "Fixed", label: "Projector fan tach GPIO", apply: "fixed", default: () => 24, parse: gpioPin },
  { key: "fan2TachPin", env: "VIDEOFX_FAN2_TACH_GPIO", group: "Fixed", label: "Pi/brick fan tach GPIO", apply: "fixed", default: () => 25, parse: gpioPin },
  { key: "w1Pin", env: "VIDEOFX_W1_GPIO", group: "Fixed", label: "1-wire (DS18B20) GPIO", apply: "fixed", default: () => 26, parse: gpioPin },
  { key: "httpPort", env: "VIDEOFX_HTTP_PORT", group: "Fixed", label: "Web page port", apply: "fixed", default: () => 80, parse: int(1, 65535) },
  { key: "matterPort", env: "VIDEOFX_MATTER_PORT", group: "Fixed", label: "Matter port", apply: "fixed", default: () => 5540, parse: int(1, 65535) },
  { key: "mediaDir", env: "VIDEOFX_MEDIA_DIR", group: "Fixed", label: "Media folder", apply: "fixed", default: (_, ctx) => join(ctx.home, "media"), parse: absPath },
  { key: "playlist", env: "VIDEOFX_PLAYLIST", group: "Fixed", label: "Playlist file", apply: "fixed", default: (v) => join(v.mediaDir, "playlist.m3u"), parse: absPath },
  { key: "mpv", env: "VIDEOFX_MPV", group: "Fixed", label: "mpv command", apply: "fixed", default: () => "mpv", parse: text(/^\S+$/, "must be one word", 256) },
  // systemd sets STATE_DIRECTORY from StateDirectory=videofx (/var/lib/videofx).
  { key: "stateDir", env: ["STATE_DIRECTORY", "VIDEOFX_STATE_DIR"], group: "Fixed", label: "State folder", apply: "fixed", default: (_, ctx) => join(ctx.home, ".videofx"), parse: absPath },
];

export const SETTING = Object.fromEntries(SETTINGS.map((s) => [s.key, s]));

/** "Raspberry Pi 4 Model B Rev 1.4" etc., or null off a Pi. */
export function piModel(file = "/proc/device-tree/model") {
  try {
    return readFileSync(file, "latin1").replace(/\0/g, "").trim() || null;
  } catch {
    return null;
  }
}

export function defaultContext() {
  const ids = deviceIds();
  return { home: homedir(), deviceName: ids.display, hostName: ids.host, model: piModel() };
}

/** The raw /etc/default/videofx value for a setting, or undefined when not set there. */
export function envValue(def, env) {
  for (const name of [def.env ?? []].flat()) {
    const raw = env[name];
    if (raw === undefined) continue;
    if (raw === "" && !def.allowEmpty) continue; // empty means "use the default"
    return { name, raw };
  }
  return undefined;
}

/**
 * Resolve every setting: web value, else /etc/default/videofx, else default.
 * strict: throw on a bad file value (used by loadConfig); otherwise warn and
 * fall back to the default.
 */
export function resolveSettings({ env = {}, web = {}, ctx = defaultContext(), strict = false, warn = () => {} } = {}) {
  // The player moved from VLC to mpv: VLC options don't carry over.
  for (const name of ["VIDEOFX_VLC", "VIDEOFX_VLC_EXTRA_ARGS"]) {
    if (env[name]) warn(`/etc/default/videofx: ${name} is no longer used (the player is mpv now); see VIDEOFX_MPV_EXTRA_ARGS`);
  }
  const values = {};
  const sources = {};
  for (const def of SETTINGS) {
    if (def.apply !== "fixed" && Object.hasOwn(web, def.key)) {
      values[def.key] = web[def.key];
      sources[def.key] = "web";
      continue;
    }
    const fromEnv = envValue(def, env);
    if (fromEnv) {
      try {
        values[def.key] = def.parse(fromEnv.raw);
        sources[def.key] = "file";
        continue;
      } catch (err) {
        const message = `${fromEnv.name} ${err.message}, got "${fromEnv.raw}"`;
        if (strict) throw new Error(message);
        warn(`/etc/default/videofx: ${message}; using the default`);
      }
    }
    values[def.key] = def.default(values, ctx);
    sources[def.key] = "default";
  }
  const pinProblem = checkPins(values);
  if (pinProblem) {
    if (strict) throw new Error(pinProblem);
    warn(`GPIO pins: ${pinProblem}`);
  }
  return { values, sources };
}

/** Environment-only config (no web overrides), strict. Used by tests and tools. */
export function loadConfig(env = process.env, ctx = defaultContext()) {
  const { values } = resolveSettings({ env, ctx, strict: true });
  return values;
}
