// Backup / restore as one JSON file: settings (incl. the schedule, quiet hours
// and the password hash), the playlist, and optionally the Matter storage
// (fabrics, keys: the device's identity). Videos are not included.
//
// Restore is staged in the state folder and applied when the service restarts,
// because matter.js holds its storage open while running.

import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fsyncDir, writeFileAtomic } from "./fsutil.js";

export const FORMAT = "videofx-backup";
export const FORMAT_VERSION = 1;
const MAX_FILES = 2000;
const MAX_BYTES = 16 * 1024 * 1024;
const SEGMENT = /^[A-Za-z0-9._-]{1,128}$/;

/** A relative path inside the Matter folder: plain segments only. */
export function safeRelPath(p) {
  if (typeof p !== "string" || p.length > 512) return false;
  const parts = p.split("/");
  return parts.length <= 6 && parts.every((s) => SEGMENT.test(s) && s !== "." && s !== "..");
}

async function listFiles(dir, base = dir) {
  let out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out = out.concat(await listFiles(full, base));
    else if (e.isFile()) out.push(relative(base, full).split(sep).join("/"));
  }
  return out;
}

export async function createBackup({ settingsFile, playlistPath, matterDir, device, version, now = new Date() }) {
  const read = (f) => readFile(f, "utf8").catch((err) => (err.code === "ENOENT" ? null : Promise.reject(err)));
  const settingsText = await read(settingsFile);
  const matter = {};
  for (const rel of await listFiles(matterDir)) {
    if (rel.endsWith(".lock") || rel.endsWith(".tmp")) continue;
    matter[rel] = (await readFile(join(matterDir, rel))).toString("base64");
  }
  return {
    format: FORMAT,
    formatVersion: FORMAT_VERSION,
    createdAt: now.toISOString(),
    device,
    version,
    settings: settingsText ? JSON.parse(settingsText) : {},
    playlist: (await read(playlistPath)) ?? "",
    matter,
  };
}

/** Structural checks; throws with a readable message. Returns what can be restored. */
export function validateBackup(b) {
  if (typeof b !== "object" || b === null) throw new Error("not a backup file");
  if (b.format !== FORMAT) throw new Error("not a VideoFX backup file");
  if (b.formatVersion !== FORMAT_VERSION) throw new Error(`backup format ${b.formatVersion} is not supported by this version`);
  if (typeof b.settings !== "object" || b.settings === null || Array.isArray(b.settings)) throw new Error("settings are missing");
  if (typeof b.playlist !== "string" || b.playlist.length > 1024 * 1024) throw new Error("the playlist is missing or too big");
  const matter = b.matter ?? {};
  if (typeof matter !== "object" || Array.isArray(matter)) throw new Error("Matter storage is malformed");
  const names = Object.keys(matter);
  if (names.length > MAX_FILES) throw new Error("too many Matter files");
  let bytes = 0;
  for (const name of names) {
    if (!safeRelPath(name)) throw new Error(`bad Matter file name "${name}"`);
    if (typeof matter[name] !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/.test(matter[name])) throw new Error(`bad Matter file content for "${name}"`);
    bytes += Math.floor((matter[name].length * 3) / 4);
  }
  if (bytes > MAX_BYTES) throw new Error("Matter storage is too big");
  return { settings: b.settings, playlist: b.playlist, matter, device: b.device ?? null, createdAt: b.createdAt ?? null, hasMatter: names.length > 0 };
}

/**
 * Stage a restore: settings.json now (the service restarts right after), Matter
 * storage into matter.restore/ (swapped in at the next start). Playlist is
 * written by the caller through the media store (it validates entries).
 */
export async function stageRestore(v, { settingsFile, stateDir, includeMatter }) {
  await writeFileAtomic(settingsFile, JSON.stringify(v.settings, null, 2) + "\n", { mode: 0o600 });
  const staging = join(stateDir, "matter.restore");
  await rm(staging, { recursive: true, force: true });
  if (!includeMatter) return { matter: false };
  if (!v.hasMatter) throw new Error("this backup has no Matter pairing in it");
  for (const [rel, b64] of Object.entries(v.matter)) {
    const target = join(staging, ...rel.split("/"));
    await mkdir(join(target, ".."), { recursive: true, mode: 0o700 });
    await writeFile(target, Buffer.from(b64, "base64"), { mode: 0o600 });
  }
  await fsyncDir(staging);
  return { matter: true };
}

/** At startup, before matter.js opens its storage: swap in a staged restore. */
export async function applyStagedRestore(stateDir, log = console) {
  const staging = join(stateDir, "matter.restore");
  try {
    if (!(await stat(staging)).isDirectory()) return false;
  } catch {
    return false;
  }
  const live = join(stateDir, "matter");
  const old = join(stateDir, "matter.before-restore");
  await rm(old, { recursive: true, force: true });
  await rename(live, old).catch((err) => (err.code === "ENOENT" ? null : Promise.reject(err)));
  await rename(staging, live);
  await fsyncDir(stateDir);
  log.warn(`Restored Matter pairing from a backup (the previous one is kept in ${old})`);
  return true;
}
