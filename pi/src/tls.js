// HTTPS certificate for the web page: one PEM certificate (chain allowed) and its
// unencrypted private key in <state>/tls/, mode 0600. Either uploaded by the owner
// or self-signed here with openssl (node can use certificates but not make them).

import { execFile } from "node:child_process";
import { X509Certificate, createPrivateKey } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync } from "node:fs";
import { isIP } from "node:net";
import { join } from "node:path";
import { createSecureContext } from "node:tls";
import { promisify } from "node:util";
import { writeFileAtomicSync } from "./fsutil.js";
import { HttpError } from "./media.js";

const execFileP = promisify(execFile);

export const PEM_LIMIT = 64 * 1024;
// Apple refuses TLS server certificates valid for longer than 825 days, even user-trusted ones.
export const SELF_SIGNED_DAYS = 825;

const DNS_NAME = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;
const CERT_RE = /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g;
const KEY_RE = /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA |EC )?PRIVATE KEY-----/;

/** What the page shows about a certificate (the first one in a chain). */
export function certInfo(pem) {
  const x = new X509Certificate(pem);
  const names = (x.subjectAltName ?? "")
    .split(/,\s*/)
    .map((n) => n.replace(/^(DNS|IP Address):/, ""))
    .filter(Boolean);
  const validTo = new Date(x.validTo);
  return {
    subject: x.subject.replace(/\n/g, ", "),
    issuer: x.issuer.replace(/\n/g, ", "),
    selfSigned: x.subject === x.issuer && x.verify(x.publicKey),
    validFrom: new Date(x.validFrom).toISOString(),
    validTo: validTo.toISOString(),
    names,
    fingerprint: x.fingerprint256,
  };
}

/**
 * Check an uploaded pair and return it normalised (just the PEM blocks).
 * Throws HttpError 400 with a message the page can show.
 */
export function checkPair(cert, key) {
  if (typeof cert !== "string" || typeof key !== "string") throw new HttpError(400, "send the certificate and the key as PEM text");
  if (cert.length > PEM_LIMIT || key.length > PEM_LIMIT) throw new HttpError(400, "certificate or key too large");
  const certs = cert.match(CERT_RE);
  if (!certs) throw new HttpError(400, "the certificate must be PEM (-----BEGIN CERTIFICATE-----)");
  if (/ENCRYPTED/.test(key)) throw new HttpError(400, "the private key is encrypted: remove its passphrase first (openssl pkey -in key.pem -out plain.pem)");
  const keyPem = KEY_RE.exec(key)?.[0];
  if (!keyPem) throw new HttpError(400, "the key must be a PEM private key (-----BEGIN PRIVATE KEY-----)");
  let x;
  try {
    x = new X509Certificate(certs[0]);
    if (!x.checkPrivateKey(createPrivateKey(keyPem))) throw new Error("the key does not belong to the certificate");
    createSecureContext({ cert: certs.join("\n"), key: keyPem });
  } catch (err) {
    throw new HttpError(400, /does not belong|mismatch/.test(err.message) ? "the key does not belong to the certificate" : `not usable: ${err.message}`);
  }
  return { cert: certs.join("\n") + "\n", key: keyPem + "\n" };
}

/** openssl arguments for a self-signed P-256 certificate covering these names and addresses. */
export function selfSignedArgs({ names, ips = [], keyFile, certFile, days = SELF_SIGNED_DAYS }) {
  // Device names may hold spaces or apostrophes: only real DNS names go in.
  const dns = [...new Set(names.map((n) => n.toLowerCase()).filter((n) => DNS_NAME.test(n) && isIP(n) === 0))];
  const addrs = [...new Set(ips.map((a) => a.replace(/%.*$/, "")).filter((a) => isIP(a) !== 0))];
  if (!dns.length) throw new Error("need at least one host name");
  const san = [...dns.map((n) => `DNS:${n}`), ...addrs.map((a) => `IP:${a}`)].join(",");
  return [
    "req", "-x509", "-newkey", "ec", "-pkeyopt", "ec_paramgen_curve:prime256v1", "-nodes", "-sha256",
    "-days", String(days),
    "-subj", `/CN=${dns.find((n) => n.endsWith(".local")) ?? dns[0]}`,
    "-addext", `subjectAltName=${san}`,
    "-addext", "extendedKeyUsage=serverAuth",
    "-keyout", keyFile, "-out", certFile,
  ];
}

export class TlsStore {
  #dir;
  #run;

  /** @param {{ dir: string, run?: (cmd: string, args: string[], opts?: object) => Promise<unknown> }} o */
  constructor({ dir, run = execFileP }) {
    this.#dir = dir;
    this.#run = run;
  }

  get certFile() {
    return join(this.#dir, "cert.pem");
  }

  get keyFile() {
    return join(this.#dir, "key.pem");
  }

  /** { cert, key } PEM text, or null when there is none (or it is unreadable). */
  load() {
    try {
      return { cert: readFileSync(this.certFile, "utf8"), key: readFileSync(this.keyFile, "utf8") };
    } catch {
      return null;
    }
  }

  /** certInfo() of the stored certificate, or null. */
  info() {
    const pair = this.load();
    if (!pair) return null;
    try {
      return certInfo(pair.cert);
    } catch {
      return null;
    }
  }

  /** Store an uploaded pair after checking it. Returns its info. */
  install(cert, key) {
    const pair = checkPair(cert, key);
    this.#write(pair);
    return certInfo(pair.cert);
  }

  /** Make and store a self-signed certificate for these names and addresses. */
  async generate({ names, ips }) {
    mkdirSync(this.#dir, { recursive: true, mode: 0o700 });
    const tmp = mkdtempSync(join(this.#dir, ".gen-"));
    try {
      const keyFile = join(tmp, "key.pem");
      const certFile = join(tmp, "cert.pem");
      try {
        await this.#run("openssl", selfSignedArgs({ names, ips, keyFile, certFile }), { timeout: 60_000 });
      } catch (err) {
        throw new HttpError(502, `openssl failed: ${(err.stderr || err.message || "").toString().trim().split("\n").pop()}`);
      }
      const pair = checkPair(readFileSync(certFile, "utf8"), readFileSync(keyFile, "utf8"));
      this.#write(pair);
      return certInfo(pair.cert);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }

  remove() {
    for (const f of [this.certFile, this.keyFile]) {
      try {
        unlinkSync(f);
      } catch (err) {
        if (err.code !== "ENOENT") throw err;
      }
    }
  }

  // Key first: a power cut between the two leaves a mismatched pair, which load()
  // callers catch (createSecureContext throws) rather than serving the wrong key.
  #write({ cert, key }) {
    mkdirSync(this.#dir, { recursive: true, mode: 0o700 });
    writeFileAtomicSync(this.keyFile, key, { mode: 0o600 });
    writeFileAtomicSync(this.certFile, cert, { mode: 0o600 });
  }
}
