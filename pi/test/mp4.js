// Minimal ISO BMFF files for the clip-length tests: ftyp, then moov/mvhd.
function box(type, body) {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(8 + body.length, 0);
  head.write(type, 4, "latin1");
  return Buffer.concat([head, body]);
}

/** opts: version 0 or 1 mvhd, moovLast puts a big mdat before moov (no faststart). */
export function fakeMp4(seconds, { version = 0, moovLast = false, timescale = 600 } = {}) {
  const mvhd = Buffer.alloc(version ? 112 : 100);
  mvhd[0] = version;
  if (version) {
    mvhd.writeUInt32BE(timescale, 20);
    mvhd.writeBigUInt64BE(BigInt(Math.round(seconds * timescale)), 24);
  } else {
    mvhd.writeUInt32BE(timescale, 12);
    mvhd.writeUInt32BE(Math.round(seconds * timescale), 16);
  }
  const moov = box("moov", Buffer.concat([box("udta", Buffer.alloc(20)), box("mvhd", mvhd)]));
  const mdat = box("mdat", Buffer.alloc(64 * 1024));
  const ftyp = box("ftyp", Buffer.from("isom0000"));
  return Buffer.concat(moovLast ? [ftyp, mdat, moov] : [ftyp, moov, mdat]);
}
