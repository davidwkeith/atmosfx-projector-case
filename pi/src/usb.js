// USB stick import. The root helper (system/videofx-usb, started by udev through
// videofx-usb@.service) mounts a stick read-only and writes <dir>/<device>.ready
// holding the mount point; pulling the stick removes it. scan() is called on a
// timer: each new .ready file copies the stick's video and audio files into the
// media folder and makes them the playlist. Read-only mounts are safe to pull.

import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { isMediaFile } from "./playlist-core.js";

const MAX_DEPTH = 8;
const MAX_FILES = 2000;

/**
 * Video and audio files under root, any depth, as [{ path, name, size }] in name
 * order. Skips hidden files and folders (macOS "._" copies, .Trashes) and
 * symlinks; a name seen twice (the same buffer clip in several folders) is kept once.
 */
export async function findMedia(root) {
  const found = new Map();
  async function walk(dir, depth) {
    let items;
    try {
      items = await readdir(dir, { withFileTypes: true });
    } catch {
      return; // unreadable folder: skip it
    }
    items.sort((a, b) => a.name.localeCompare(b.name));
    for (const d of items) {
      if (found.size >= MAX_FILES || d.name.startsWith(".")) continue;
      const path = join(dir, d.name);
      if (d.isDirectory() && depth < MAX_DEPTH) await walk(path, depth + 1);
      else if (d.isFile() && isMediaFile(d.name) && !found.has(d.name)) {
        found.set(d.name, { path, name: d.name, size: (await stat(path)).size });
      }
    }
  }
  await walk(root, 0);
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * @param {object} o
 * @param {string} o.dir  where the helper writes .ready files (/run/videofx-usb)
 * @param {ReturnType<import("./media.js").createMediaStore>} o.media
 * @param {(names: string[]) => void} o.onImported  the playlist was replaced
 */
export function createUsbImporter({ dir, media, onImported, log = console }) {
  let status = { state: "idle" };
  const handled = new Map(); // device -> the .ready contents it was imported from
  let busy = false;

  async function importFrom(device, mount) {
    status = { state: "copying", device, present: true, copied: 0, skipped: 0, total: 0, at: new Date().toISOString() };
    log.info(`USB ${device}: importing from ${mount}`);
    const files = await findMedia(mount);
    status.total = files.length;
    if (!files.length) {
      status = { ...status, state: "error", error: "No video or audio files on the USB stick." };
      return;
    }
    for (const f of files) {
      status.current = f.name;
      try {
        const r = await media.copyIn(f.path, f.name, f.size);
        r.skipped ? status.skipped++ : status.copied++;
      } catch (err) {
        log.warn(`USB ${device}: ${f.name}: ${err.message}`);
        status = { ...status, state: "error", current: undefined, error: `${f.name}: ${err.message}` };
        return;
      }
    }
    const names = files.map((f) => f.name);
    await media.replaceWithAuto(names);
    status = { ...status, state: "done", current: undefined, at: new Date().toISOString() };
    log.info(`USB ${device}: ${status.copied} copied, ${status.skipped} already here; playlist replaced`);
    onImported(names);
  }

  return {
    get status() {
      return status;
    },

    /** Look for sticks plugged in or pulled out since the last call. Never throws. */
    async scan() {
      if (busy) return;
      busy = true;
      try {
        let names;
        try {
          names = (await readdir(dir)).filter((n) => n.endsWith(".ready"));
        } catch {
          names = []; // no helper (not a Pi, or nothing plugged in yet)
        }
        const present = new Set(names.map((n) => n.slice(0, -".ready".length)));
        for (const device of handled.keys()) if (!present.has(device)) handled.delete(device);
        if (status.device && !present.has(status.device)) status = { ...status, present: false };
        for (const device of present) {
          const mount = (await readFile(join(dir, `${device}.ready`), "utf8").catch(() => "")).trim();
          if (!mount || handled.get(device) === mount) continue;
          handled.set(device, mount);
          await importFrom(device, mount).catch((err) => {
            status = { ...status, state: "error", current: undefined, error: err.message };
          });
        }
      } finally {
        busy = false;
      }
    },
  };
}
