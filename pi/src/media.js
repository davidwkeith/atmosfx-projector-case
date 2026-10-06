// Media folder and playlist file access for the web UI. Every name from a
// request goes through resolve(), which only allows plain files directly inside
// the media folder.

import { createWriteStream, lstatSync, readFileSync } from "node:fs";
import { lstat, mkdir, readFile, readdir, statfs, unlink } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { dirname, join, resolve as resolvePath, sep } from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { commitFile, writeFileAtomic } from "./fsutil.js";
import {
  enabledCount,
  isMediaFile,
  isPlaylistFile,
  isSafeName,
  parsePlaylist,
  serializePlaylist,
  validateEntries,
} from "./playlist-core.js";

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const MAX_PLAYLIST_BYTES = 1024 * 1024;
const TEMP_UPLOAD = /^\.upload-[0-9a-f]{12}$/;

/**
 * maxUploadBytes: a number, or a function so the limit can change at runtime.
 * reserveBytes: free space uploads must leave. Settings, the Matter pairing and
 * the on/off state live on the same partition, and a full disk fails their writes.
 */
export function createMediaStore({ dir, playlist, maxUploadBytes: limit = 4 * 1024 ** 3, reserveBytes = 64 * 1024 ** 2, statfs: statfsFn = statfs }) {
  const maxUpload = typeof limit === "function" ? limit : () => limit;
  const root = resolvePath(dir);
  const playlistPath = resolvePath(playlist);
  // mpv resolves relative entries against the playlist's folder. If that is not
  // the media folder, write absolute paths instead.
  const prefix = dirname(playlistPath) === root ? "" : root + sep;

  function resolve(name) {
    if (!isSafeName(name)) throw new HttpError(400, "invalid file name");
    const path = resolvePath(root, name);
    if (dirname(path) !== root) throw new HttpError(400, "invalid file name");
    return path;
  }

  async function readPlaylist() {
    try {
      return parsePlaylist(await readFile(playlistPath, "utf8"), prefix);
    } catch (err) {
      if (err.code === "ENOENT") return [];
      throw err;
    }
  }

  async function writePlaylist(entries) {
    let valid;
    try {
      valid = validateEntries(entries);
    } catch (err) {
      throw new HttpError(400, err.message);
    }
    await atomicWrite(playlistPath, serializePlaylist(valid, prefix));
    return valid;
  }

  // Durable: temp file, fsync, rename, fsync of the folder (power cuts).
  const atomicWrite = (path, data) => writeFileAtomic(path, data);

  async function freeBytes() {
    try {
      const fs = await statfsFn(root);
      return fs.bavail * fs.bsize;
    } catch {
      return undefined; // not critical
    }
  }

  return {
    root,
    playlistPath,
    resolve,
    readPlaylist,
    writePlaylist,

    /**
     * Why playback cannot start, or undefined. Sync: used as the player's preflight.
     * scare: { mode, buffer, scares } (file names) for scare mode.
     */
    problem(scare) {
      if (scare?.mode === "scare") {
        const here = (name) => {
          try {
            return lstatSync(resolve(name)).isFile();
          } catch {
            return false;
          }
        };
        if (!scare.buffer) return "scare mode has no calm clip chosen";
        if (!here(scare.buffer)) return `the calm clip ${scare.buffer} is missing`;
        if (!(scare.scares ?? []).some(here)) return "scare mode has no scare clips (or they are missing)";
        return undefined;
      }
      let text;
      try {
        text = readFileSync(playlistPath, "utf8");
      } catch {
        return `playlist ${playlistPath} not found`;
      }
      return enabledCount(parsePlaylist(text, prefix)) ? undefined : "the playlist has no enabled entries";
    },

    async list() {
      await mkdir(root, { recursive: true });
      const files = [];
      for (const d of await readdir(root, { withFileTypes: true })) {
        if (!d.isFile() || !isMediaFile(d.name)) continue; // skips symlinks and hidden temp files
        const s = await lstat(join(root, d.name));
        files.push({ name: d.name, size: s.size, modified: s.mtime.toISOString() });
      }
      files.sort((a, b) => a.name.localeCompare(b.name));
      return { files, freeBytes: await freeBytes(), maxUploadBytes: maxUpload() };
    },

    /** Remove uploads a crash or power cut left half-written. Call once at startup. */
    async cleanTemp() {
      let removed = 0;
      for (const d of await readdir(root, { withFileTypes: true }).catch(() => [])) {
        if (!d.isFile() || !TEMP_UPLOAD.test(d.name)) continue;
        await unlink(join(root, d.name)).then(() => removed++, () => {});
      }
      return removed;
    },

    /**
     * Store an upload from a readable stream. Media files are written to a temp
     * file and renamed into place; an .m3u replaces the playlist after validation.
     */
    async save(name, stream, declaredLength) {
      const path = resolve(name);
      if (isPlaylistFile(name)) {
        const text = await readLimited(stream, MAX_PLAYLIST_BYTES);
        return { playlist: await writePlaylist(parsePlaylist(text, prefix)) };
      }
      if (!isMediaFile(name)) throw new HttpError(415, "only video, audio and .m3u files are allowed");
      const maxUploadBytes = maxUpload();
      if (declaredLength > maxUploadBytes) throw new HttpError(413, "file too large");

      await mkdir(root, { recursive: true });
      const free = await freeBytes();
      const room = free === undefined ? Infinity : free - reserveBytes;
      const noRoom = () => new HttpError(507, "not enough free space on the Pi: delete some videos first");
      if (declaredLength > room) throw noRoom();
      const tmp = join(root, `.upload-${randomBytes(6).toString("hex")}`);
      let bytes = 0;
      const limit = new Transform({
        transform(chunk, _enc, done) {
          bytes += chunk.length;
          done(bytes > maxUploadBytes ? new HttpError(413, "file too large") : bytes > room ? noRoom() : null, chunk);
        },
      });
      try {
        await pipeline(stream, limit, createWriteStream(tmp, { flags: "wx" }));
        await commitFile(tmp, path); // fsync, rename, fsync of the folder
      } catch (err) {
        await unlink(tmp).catch(() => {});
        throw err;
      }
      return { name, size: bytes };
    },

    /** Delete a media file and drop it from the playlist. */
    async remove(name) {
      const path = resolve(name);
      if (!isMediaFile(name)) throw new HttpError(400, "not a media file");
      let s;
      try {
        s = await lstat(path);
      } catch {
        throw new HttpError(404, "no such file");
      }
      if (!s.isFile()) throw new HttpError(400, "not a regular file");
      await unlink(path);
      const entries = await readPlaylist();
      const kept = entries.filter((e) => e.file !== name);
      if (kept.length !== entries.length) await writePlaylist(kept);
    },
  };
}

async function readLimited(stream, max) {
  const chunks = [];
  let size = 0;
  for await (const chunk of stream) {
    size += chunk.length;
    if (size > max) throw new HttpError(413, "file too large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}
