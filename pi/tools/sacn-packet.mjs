// Builds E1.31 (sACN) data packets. Used by the tests and by sacn-send.mjs.
// Layout as in ETC's reference implementation (see src/dmx.js).

import { randomBytes } from "node:crypto";

export function buildPacket({
  universe = 1,
  levels = [],
  sequence = 0,
  priority = 100,
  name = "videofx-test",
  cid = randomBytes(16),
  preview = false,
  terminated = false,
  startCode = 0,
  slots = 512,
} = {}) {
  const buf = Buffer.alloc(126 + slots);
  buf.writeUInt16BE(0x0010, 0); // preamble size
  buf.writeUInt16BE(0x0000, 2); // post-amble size
  buf.write("ASC-E1.17\0\0\0", 4, "latin1");
  buf.writeUInt16BE(0x7000 | (buf.length - 16), 16);
  buf.writeUInt32BE(0x00000004, 18); // VECTOR_ROOT_E131_DATA
  Buffer.from(cid).copy(buf, 22, 0, 16);
  buf.writeUInt16BE(0x7000 | (buf.length - 38), 38);
  buf.writeUInt32BE(0x00000002, 40); // VECTOR_E131_DATA_PACKET
  buf.write(name.slice(0, 63), 44, "utf8");
  buf[108] = priority;
  buf.writeUInt16BE(0, 109); // sync universe
  buf[111] = sequence & 0xff;
  buf[112] = (preview ? 0x80 : 0) | (terminated ? 0x40 : 0);
  buf.writeUInt16BE(universe, 113);
  buf.writeUInt16BE(0x7000 | (buf.length - 115), 115);
  buf[117] = 0x02; // VECTOR_DMP_SET_PROPERTY
  buf[118] = 0xa1;
  buf.writeUInt16BE(0x0000, 119);
  buf.writeUInt16BE(0x0001, 121);
  buf.writeUInt16BE(slots + 1, 123);
  buf[125] = startCode;
  Buffer.from(levels.slice(0, slots)).copy(buf, 126);
  return buf;
}

export const multicastGroup = (universe) => `239.255.${(universe >> 8) & 0xff}.${universe & 0xff}`;
