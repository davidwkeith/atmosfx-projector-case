// Clip length without ffprobe (not on the image): read the movie header (mvhd)
// of MP4/M4V/MOV files. It only seeks from box header to box header, so a moov
// at the end of a large file costs a handful of small reads. Other formats
// give undefined.

import { open } from "node:fs/promises";
import { extOf } from "./playlist-core.js";

const ISO_BMFF = [".mp4", ".m4v", ".mov", ".m4a"];
const CONTAINERS = new Set(["moov"]);

/** Duration in seconds, or undefined if unknown. Never throws. */
export async function mediaDuration(path) {
  if (!ISO_BMFF.includes(extOf(path))) return undefined;
  let fh;
  try {
    fh = await open(path, "r");
    const { size } = await fh.stat();
    return await findMvhd(fh, 0, size, 0);
  } catch {
    return undefined;
  } finally {
    await fh?.close();
  }
}

async function read(fh, pos, length) {
  const buf = Buffer.alloc(length);
  const { bytesRead } = await fh.read(buf, 0, length, pos);
  return bytesRead === length ? buf : undefined;
}

async function findMvhd(fh, start, end, depth) {
  let pos = start;
  for (let n = 0; pos + 8 <= end && n < 1000; n++) {
    const head = await read(fh, pos, 16);
    if (!head) return undefined;
    let size = head.readUInt32BE(0);
    const type = head.toString("latin1", 4, 8);
    let header = 8;
    if (size === 1) {
      size = Number(head.readBigUInt64BE(8));
      header = 16;
    } else if (size === 0) {
      size = end - pos;
    }
    if (size < header || pos + size > end) return undefined;
    if (type === "mvhd") return parseMvhd(await read(fh, pos + header, Math.min(size - header, 32)));
    if (CONTAINERS.has(type) && depth < 2) {
      const found = await findMvhd(fh, pos + header, pos + size, depth + 1);
      if (found !== undefined) return found;
    }
    pos += size;
  }
  return undefined;
}

function parseMvhd(b) {
  if (!b || b.length < 20) return undefined;
  const v1 = b[0] === 1;
  if (v1 && b.length < 32) return undefined;
  const timescale = v1 ? b.readUInt32BE(20) : b.readUInt32BE(12);
  const duration = v1 ? Number(b.readBigUInt64BE(24)) : b.readUInt32BE(16);
  if (!timescale || duration === 0xffffffff || !Number.isFinite(duration / timescale)) return undefined;
  return duration / timescale;
}
