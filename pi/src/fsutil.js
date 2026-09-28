// Durable writes for a box that gets unplugged: write a temp file in the same
// folder, fsync it, rename it over the target, then fsync the folder so the
// rename itself is on disk. A power cut leaves either the old or the new file,
// never a half-written one.

import * as nodeFs from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";

const tmpName = (path) => join(dirname(path), `.${randomBytes(4).toString("hex")}.tmp`);

/** Synchronous durable replace. `fs` is injectable for tests. */
export function writeFileAtomicSync(path, data, { mode = 0o600, fs = nodeFs } = {}) {
  const tmp = tmpName(path);
  let fd;
  try {
    fd = fs.openSync(tmp, "w", mode);
    fs.writeSync(fd, data);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    fs.renameSync(tmp, path);
  } catch (err) {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd);
      } catch {
        // already failing
      }
    }
    try {
      fs.unlinkSync(tmp);
    } catch {
      // nothing to clean up
    }
    throw err;
  }
  fsyncDirSync(dirname(path), fs);
}

/** fsync a directory so renames/creates in it survive a power cut. */
export function fsyncDirSync(dir, fs = nodeFs) {
  let fd;
  try {
    fd = fs.openSync(dir, "r");
    fs.fsyncSync(fd);
  } catch {
    // Some filesystems (and macOS for dirs) refuse; the data file itself is synced.
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

/** Async durable replace (uploads, playlists). */
export async function writeFileAtomic(path, data, { mode = 0o644, fs = nodeFs.promises } = {}) {
  const tmp = tmpName(path);
  const handle = await fs.open(tmp, "w", mode);
  try {
    await handle.writeFile(data);
    await handle.sync();
  } catch (err) {
    await handle.close().catch(() => {});
    await fs.unlink(tmp).catch(() => {});
    throw err;
  }
  await handle.close();
  try {
    await fs.rename(tmp, path);
  } catch (err) {
    await fs.unlink(tmp).catch(() => {});
    throw err;
  }
  await fsyncDir(dirname(path), fs);
}

/** Make an already-written temp file durable and move it into place. */
export async function commitFile(tmp, path, fs = nodeFs.promises) {
  const handle = await fs.open(tmp, "r+");
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
  await fs.rename(tmp, path);
  await fsyncDir(dirname(path), fs);
}

export async function fsyncDir(dir, fs = nodeFs.promises) {
  let handle;
  try {
    handle = await fs.open(dir, "r");
    await handle.sync();
  } catch {
    // see fsyncDirSync
  } finally {
    await handle?.close().catch(() => {});
  }
}
