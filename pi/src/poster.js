// Poster frames for the web page's now-playing header: one small JPEG per clip,
// grabbed by a second, short-lived mpv (the image is in the package list; ffmpeg
// is not) and kept on disk while the clip's size and time are unchanged.
// One grab at a time, so a page full of clips never starts a crowd of decoders
// next to the one playing the show.

import { createHash } from "node:crypto";
import { execFile as execFileCb } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rename, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

export const POSTER_WIDTH = 320;

/** mpv arguments that write one scaled frame, a tenth of the way in, as <outdir>/00000001.jpg. */
export const posterArgs = (file, outdir) => [
  "--no-config",
  "--really-quiet",
  "--no-audio",
  "--sid=no",
  "--hwdec=no",
  "--vo=image",
  "--vo-image-format=jpg",
  "--vo-image-jpeg-quality=80",
  `--vo-image-outdir=${outdir}`,
  "--frames=1",
  "--start=10%",
  `--vf=scale=w=${POSTER_WIDTH}:h=-2`,
  "--",
  file,
];

const sha = (s) => createHash("sha1").update(s).digest("hex").slice(0, 16);

/**
 * @param {object} o
 * @param {string} o.dir                  cache folder (created when needed)
 * @param {(name: string) => string} o.resolve  clip name -> absolute path; throws for a bad name (media.resolve)
 * @param {string} [o.mpv]                mpv command
 * @param {Function} [o.execFile]         promisified execFile, for tests
 */
export function createPosterCache({ dir, resolve, mpv = "mpv", execFile = promisify(execFileCb), timeoutMs = 20000, log = console }) {
  const failed = new Set(); // keys that could not be grabbed: not retried until the file changes
  const inflight = new Map(); // key -> promise
  let chain = Promise.resolve();

  async function grab(file, target, key) {
    await mkdir(dir, { recursive: true });
    const tmp = await mkdtemp(join(dir, ".grab-"));
    try {
      // Lowest CPU priority: the show's own mpv must not drop frames for a thumbnail.
      await execFile("nice", ["-n", "19", mpv, ...posterArgs(file, tmp)], { timeout: timeoutMs });
      const [first] = (await readdir(tmp)).filter((n) => n.endsWith(".jpg")).sort();
      if (!first) throw new Error("mpv wrote no frame");
      await rename(join(tmp, first), target);
      return target;
    } catch (err) {
      failed.add(key);
      log.error?.(`Poster for ${file}: ${err.message}`);
      return null;
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  }

  // Drop the posters of older versions of the same clip.
  async function prune(prefix, keep) {
    const names = await readdir(dir).catch(() => []);
    await Promise.all(names.filter((n) => n.startsWith(prefix) && n !== keep).map((n) => rm(join(dir, n), { force: true })));
  }

  /** The JPEG for a clip in the media folder, or null (missing, not a video, mpv failed). */
  async function poster(name) {
    const file = resolve(name);
    let s;
    try {
      s = await stat(file);
    } catch {
      return null;
    }
    if (!s.isFile()) return null;
    const prefix = `${sha(name)}-`;
    const base = `${prefix}${sha(`${s.size}:${s.mtimeMs}`)}.jpg`;
    const target = join(dir, base);
    const read = async (p) => (p ? { body: await readFile(p), type: "image/jpeg" } : null);
    if (await stat(target).then(() => true, () => false)) return read(target);
    if (failed.has(base)) return null;
    if (!inflight.has(base)) {
      const job = chain.then(async () => {
        const p = await grab(file, target, base);
        if (p) await prune(prefix, base);
        return p;
      });
      chain = job.catch(() => {});
      inflight.set(base, job);
      job.finally(() => inflight.delete(base)).catch(() => {});
    }
    return read(await inflight.get(base));
  }

  return { poster };
}
