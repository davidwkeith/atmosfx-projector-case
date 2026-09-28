// IR remote codes, sent and learned with ir-ctl (v4l-utils) on the kernel's lirc
// devices: gpio-ir-tx / pwm-ir-tx for the LED, gpio-ir for a TSOP38238-style receiver.
// A code is "protocol:scancode" (sent through the kernel encoder, e.g. nec:0x40bf)
// or "raw:+9000 -4500 +560 ..." (pulse/space microseconds).

import { writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";

// ir-ctl(1), "Supported Protocols".
export const IR_PROTOCOLS = [
  "rc5", "rc5x_20", "rc5_sz", "jvc", "sony12", "sony15", "sony20", "nec", "necx", "nec32", "sanyo",
  "rc6_0", "rc6_6a_20", "rc6_6a_24", "rc6_6a_32", "rc6_mce", "sharp", "imon", "rc_mm_12", "rc_mm_24", "rc_mm_32",
];

/** Validate and normalize a code; "" means none. Throws with a readable message. */
export function parseIrCode(v) {
  if (v === "" || v === null || v === undefined) return "";
  if (typeof v !== "string") throw new Error("must be text");
  const s = v.trim();
  const raw = /^raw:\s*(.*)$/is.exec(s);
  if (raw) {
    const values = raw[1].split(/[\s,]+/).filter(Boolean);
    if (values.length % 2 === 0) throw new Error("raw codes must start and end with a pulse (odd number of values)");
    if (values.length < 3 || values.length > 511) throw new Error("raw codes need 3-511 pulse/space values");
    const out = values.map((t, i) => {
      const m = /^([+-]?)(\d{1,6})$/.exec(t);
      if (!m) throw new Error(`"${t}" is not a pulse/space length`);
      const n = Number(m[2]);
      if (n < 1 || n > 500_000) throw new Error(`"${t}" is out of range (1-500000 µs)`);
      if (m[1] && (m[1] === "+") !== (i % 2 === 0)) throw new Error(`value ${i + 1} should be a ${i % 2 === 0 ? "pulse (+)" : "space (-)"}`);
      return `${i % 2 === 0 ? "+" : "-"}${n}`;
    });
    return `raw:${out.join(" ")}`;
  }
  const m = /^([a-z0-9_]+):(0x[0-9a-f]{1,8}|[0-9]{1,10})$/i.exec(s);
  if (!m) throw new Error('must be protocol:scancode (e.g. nec:0x40bf) or raw:+9000 -4500 ...');
  const protocol = m[1].toLowerCase();
  if (!IR_PROTOCOLS.includes(protocol)) throw new Error(`unknown protocol "${m[1]}" (use one of ${IR_PROTOCOLS.join(", ")})`);
  const code = Number(m[2]);
  if (!Number.isSafeInteger(code) || code > 0xffffffff) throw new Error("scancode is too large");
  return `${protocol}:0x${code.toString(16)}`;
}

/** Pulse/space lengths from ir-ctl --receive output ("+9000 -4500 ... -125000"). */
export function parseCapture(text) {
  const values = [];
  for (const line of (text ?? "").split("\n")) {
    const body = line.split("#")[0];
    for (const tok of body.trim().split(/\s+/)) {
      if (/^[+-]?\d+$/.test(tok)) values.push(Math.abs(Number(tok)));
    }
  }
  if (values.length % 2 === 0) values.pop(); // trailing timeout space
  return values;
}

const near = (value, target, tol = 0.35) => Math.abs(value - target) <= target * tol;

/**
 * Decode NEC (the most common projector remote protocol) the way the kernel
 * encodes it back: nec (16-bit), necx (24-bit) or nec32. Returns "nec:0x.." or null.
 */
export function decodeNec(values) {
  let i = values.findIndex((v, k) => k % 2 === 0 && near(v, 9000, 0.25) && near(values[k + 1] ?? 0, 4500, 0.25));
  if (i < 0) return null;
  i += 2;
  let bits = 0n;
  for (let b = 0; b < 32; b++, i += 2) {
    const pulse = values[i];
    const space = values[i + 1];
    if (pulse === undefined || space === undefined || !near(pulse, 562)) return null;
    let bit;
    if (near(space, 562)) bit = 0n;
    else if (near(space, 1687)) bit = 1n;
    else return null;
    bits |= bit << BigInt(b); // LSB first
  }
  const byte = (n) => Number((bits >> BigInt(8 * n)) & 0xffn);
  const [addr, addrInv, cmd, cmdInv] = [byte(0), byte(1), byte(2), byte(3)];
  let protocol;
  let scancode;
  if ((cmd ^ cmdInv) !== 0xff) {
    protocol = "nec32";
    scancode = ((addr << 24) | (addrInv << 16) | (cmd << 8) | cmdInv) >>> 0;
  } else if ((addr ^ addrInv) !== 0xff) {
    protocol = "necx";
    scancode = (addr << 16) | (addrInv << 8) | cmd;
  } else {
    protocol = "nec";
    scancode = (addr << 8) | cmd;
  }
  return `${protocol}:0x${scancode.toString(16)}`;
}

/** A learned code: decoded NEC when possible, else the raw capture. */
export function codeFromCapture(text) {
  const values = parseCapture(text);
  if (values.length < 3) return null;
  return decodeNec(values) ?? parseIrCode(`raw:${values.join(" ")}`);
}

/** Which /dev/lircN can send / receive, from "ir-ctl -f" output. */
export function lircFeatures(text) {
  return { send: /Device can send raw IR/.test(text ?? ""), receive: /Device can receive raw IR/.test(text ?? "") };
}

export class Ir {
  #run;
  #spawn;
  #txDevice;
  #rxDevice;
  #tmpDir;
  #log;

  /**
   * @param {object} o
   * @param {(cmd, args) => Promise<{stdout}>} o.run
   * @param {Function} o.spawn
   * @param {() => Promise<string|null>} o.txDevice   resolves the lirc TX device
   * @param {() => Promise<string|null>} o.rxDevice
   * @param {string} o.tmpDir                          where raw codes are written for ir-ctl --send
   */
  constructor(o) {
    this.#run = o.run;
    this.#spawn = o.spawn;
    this.#txDevice = o.txDevice;
    this.#rxDevice = o.rxDevice;
    this.#tmpDir = o.tmpDir;
    this.#log = o.log ?? console;
  }

  async send(code) {
    const c = parseIrCode(code);
    if (!c) throw new Error("no IR code is set");
    const dev = await this.#txDevice();
    if (!dev) throw new Error("no IR transmitter found (is the gpio-ir-tx overlay loaded?)");
    if (!c.startsWith("raw:")) {
      await this.#run("ir-ctl", ["-d", dev, `--scancode=${c}`]);
      return;
    }
    const file = join(this.#tmpDir, `ir-${process.pid}-${Date.now()}.txt`);
    await writeFile(file, c.slice(4) + "\n");
    try {
      await this.#run("ir-ctl", ["-d", dev, "--carrier=38000", `--send=${file}`]);
    } finally {
      await unlink(file).catch(() => {});
    }
  }

  /** Wait for one button press on the receiver; resolves to a code, or null on timeout. */
  async learn({ timeoutMs = 15_000 } = {}) {
    const dev = await this.#rxDevice();
    if (!dev) throw new Error("no IR receiver found (is the gpio-ir overlay loaded?)");
    return new Promise((resolve, reject) => {
      const child = this.#spawn("ir-ctl", ["-d", dev, "--receive", "--oneshot"], { stdio: ["ignore", "pipe", "pipe"] });
      let out = "";
      let err = "";
      child.stdout.on("data", (d) => (out += d));
      child.stderr?.on("data", (d) => (err += d));
      const timer = setTimeout(() => child.kill("SIGTERM"), timeoutMs);
      child.once("error", (e) => {
        clearTimeout(timer);
        reject(e);
      });
      child.once("exit", (code, signal) => {
        clearTimeout(timer);
        if (signal) return resolve(null); // timed out: nothing pressed
        if (code) return reject(new Error(err.trim() || `ir-ctl exited (${code})`));
        try {
          resolve(codeFromCapture(out));
        } catch (e) {
          reject(e);
        }
      });
    });
  }
}
