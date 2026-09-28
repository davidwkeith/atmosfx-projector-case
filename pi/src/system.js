// Read-only looks at the OS for the status page: clock sync, Wi-Fi link, and the
// power-cut protection (read-only root with overlay + persistent data partition).

export const TIMESYNC_FLAG = "/run/systemd/timesync/synchronized";
export const DATA_MOUNT = "/srv/videofx";

/**
 * `iw dev wlan0 link` -> { connected, ssid, signalDbm, freqMhz, band, quality }.
 * Quality: -50 dBm or better = 100 %, -100 dBm = 0 % (linear, the common NM-style mapping).
 */
export function parseIwLink(text) {
  const t = text ?? "";
  if (!/^Connected to /m.test(t)) return { connected: false };
  const ssid = /^\s*SSID:\s*(.*)$/m.exec(t)?.[1] ?? null;
  const freq = Number(/^\s*freq:\s*([\d.]+)/m.exec(t)?.[1]);
  const signal = Number(/^\s*signal:\s*(-?\d+)\s*dBm/m.exec(t)?.[1]);
  const freqMhz = Number.isFinite(freq) ? Math.round(freq) : null;
  const signalDbm = Number.isFinite(signal) ? signal : null;
  return {
    connected: true,
    ssid,
    signalDbm,
    freqMhz,
    band: freqMhz === null ? null : freqMhz >= 5925 ? "6 GHz" : freqMhz >= 4900 ? "5 GHz" : "2.4 GHz",
    quality: signalDbm === null ? null : Math.max(0, Math.min(100, 2 * (signalDbm + 100))),
  };
}

/** Ubiquiti's guidance (WiFi Troubleshooting Guide): > -60 excellent, -60..-70 acceptable, < -80 unstable. */
export function signalVerdict(dbm) {
  if (dbm === null || dbm === undefined) return null;
  if (dbm > -60) return "excellent";
  if (dbm >= -70) return "acceptable";
  if (dbm >= -80) return "weak";
  return "poor: expect dropouts";
}

/** `nmcli -t -f DEVICE,TYPE,STATE device` -> which link carries traffic. */
export function parseNmcliDevices(text) {
  const rows = (text ?? "")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      const [device, type, state] = l.split(":");
      return { device, type, state };
    });
  const up = (type) => rows.some((r) => r.type === type && r.state === "connected");
  return { ethernet: up("ethernet"), wifiUp: up("wifi"), active: up("ethernet") ? "ethernet" : up("wifi") ? "wifi" : null };
}

/**
 * Power-cut protection from /proc/cmdline and /proc/mounts.
 * overlay: root is an overlay now; configured: the next boot will use one
 * (cmdline.txt); maintenance: overlay off (root writable).
 */
export function storageStatus({ procCmdline, bootCmdline, procMounts, storageState }) {
  const flag = /(^|\s)overlayroot=tmpfs(:\S*)?(\s|$)/;
  const mounts = (procMounts ?? "").split("\n").map((l) => l.split(" "));
  const rootMount = mounts.find((m) => m[1] === "/");
  const dataMount = mounts.find((m) => m[1] === DATA_MOUNT);
  const overlay = flag.test(procCmdline ?? "") && rootMount?.[2] === "overlay";
  const configured = flag.test(bootCmdline ?? "");
  const state = (storageState ?? "").trim() || null; // written by videofx-storage: ok | no-space | ...
  return {
    overlay,
    configured,
    dataMounted: Boolean(dataMount),
    dataOptions: dataMount?.[3] ?? null,
    maintenance: !overlay,
    rebootPending: overlay !== configured,
    state,
  };
}
