import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { request } from "node:http";
import { request as httpsRequest, createServer as createHttpsServer } from "node:https";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createMediaStore } from "../src/media.js";
import { TlsStore, checkPair, selfSignedArgs } from "../src/tls.js";
import { createWebHandler, createWebServer, httpsUrl } from "../src/web.js";

let hasOpenssl = true;
try {
  execFileSync("openssl", ["version"], { stdio: "ignore" });
} catch {
  hasOpenssl = false;
}

describe("selfSignedArgs", () => {
  it("puts DNS names and addresses in the SAN and names the .local one in the CN", () => {
    const args = selfSignedArgs({ names: ["videofx-1a2b", "VideoFX-1A2B.local", "front yard", "front yard.local", "videofx-1a2b"], ips: ["192.168.1.20", "fd00::5%eth0", "nope"], keyFile: "k", certFile: "c" });
    expect(args[args.indexOf("-subj") + 1]).toBe("/CN=videofx-1a2b.local");
    expect(args).toContain("subjectAltName=DNS:videofx-1a2b,DNS:videofx-1a2b.local,IP:192.168.1.20,IP:fd00::5");
    expect(args).toContain("extendedKeyUsage=serverAuth");
    expect(args[args.indexOf("-days") + 1]).toBe("825");
  });
  it("needs a host name", () => {
    expect(() => selfSignedArgs({ names: ["has space"], keyFile: "k", certFile: "c" })).toThrow(/host name/);
  });
});

describe.skipIf(!hasOpenssl)("TlsStore", () => {
  let dir;
  let other; // a second pair, for mismatches
  beforeAll(() => {
    other = mkdtempSync(join(tmpdir(), "videofx-tls-other-"));
    execFileSync("openssl", selfSignedArgs({ names: ["other.local"], keyFile: join(other, "k.pem"), certFile: join(other, "c.pem") }), { stdio: "ignore" });
  });
  afterAll(() => rmSync(other, { recursive: true, force: true }));
  beforeEach(() => (dir = mkdtempSync(join(tmpdir(), "videofx-tls-"))));
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("makes a self-signed certificate, stored 0600", async () => {
    const store = new TlsStore({ dir: join(dir, "tls") });
    expect(store.info()).toBeNull();
    const info = await store.generate({ names: ["videofx-1a2b", "videofx-1a2b.local"], ips: ["192.168.1.20"] });
    expect(info.selfSigned).toBe(true);
    expect(info.names).toEqual(["videofx-1a2b", "videofx-1a2b.local", "192.168.1.20"]);
    expect(info.subject).toBe("CN=videofx-1a2b.local");
    expect(new Date(info.validTo) - Date.now()).toBeGreaterThan(800 * 86_400_000);
    expect(statSync(store.keyFile).mode & 0o777).toBe(0o600);
    expect(store.info()).toEqual(info);
    store.remove();
    expect(store.load()).toBeNull();
    store.remove(); // twice is fine
  });

  it("installs an uploaded pair, trimming text around the PEM blocks", () => {
    const store = new TlsStore({ dir });
    const cert = `Bag Attributes\n${readFileSync(join(other, "c.pem"), "utf8")}`;
    const info = store.install(cert, readFileSync(join(other, "k.pem"), "utf8"));
    expect(info.names).toEqual(["other.local"]);
    expect(store.load().cert.startsWith("-----BEGIN CERTIFICATE-----")).toBe(true);
  });

  it("refuses a key that belongs to another certificate", async () => {
    const store = new TlsStore({ dir });
    await store.generate({ names: ["a.local"] });
    expect(() => checkPair(store.load().cert, readFileSync(join(other, "k.pem"), "utf8"))).toThrow(/does not belong/);
  });

  it("refuses encrypted keys, non-PEM and oversized input", () => {
    const cert = readFileSync(join(other, "c.pem"), "utf8");
    expect(() => checkPair(cert, "-----BEGIN ENCRYPTED PRIVATE KEY-----\nAAAA\n-----END ENCRYPTED PRIVATE KEY-----")).toThrow(/passphrase/);
    expect(() => checkPair("hello", readFileSync(join(other, "k.pem"), "utf8"))).toThrow(/PEM/);
    expect(() => checkPair(cert, "x".repeat(70_000))).toThrow(/too large/);
    expect(() => checkPair(undefined, "")).toThrow(/PEM text/);
  });

  it("reports an openssl failure as a 502", async () => {
    const store = new TlsStore({ dir, run: async () => Promise.reject(Object.assign(new Error("x"), { stderr: "line 1\nbad things" })) });
    await expect(store.generate({ names: ["a.local"] })).rejects.toMatchObject({ status: 502, message: "openssl failed: bad things" });
  });
});

describe("httpsUrl", () => {
  it.each([
    ["videofx-1a2b.local", "/x?y=1", 443, "https://videofx-1a2b.local/x?y=1"],
    ["192.168.1.20:80", "/", 443, "https://192.168.1.20/"],
    ["[fe80::1]:8080", "/", 8443, "https://[fe80::1]:8443/"],
  ])("%s%s -> %s", (host, path, port, url) => expect(httpsUrl(host, path, port)).toBe(url));
});

describe("TLS routes and the HTTPS redirect", () => {
  let server;
  let port;
  let redirect;
  const calls = [];
  const view = { https: { enabled: true, running: true, port: 443 }, cert: null };
  const options = () => ({
    media: createMediaStore({ dir: tmpdir(), playlist: join(tmpdir(), "x.m3u") }),
    auth: { passwordSet: false, verifyPassword: () => true },
    hostNames: () => [],
    status: () => ({ ok: true }),
    httpsRedirect: () => redirect,
    tls: {
      get: () => view,
      upload: async (cert, key) => (calls.push(["upload", cert, key]), view),
      selfSigned: async () => (calls.push(["selfSigned"]), view),
      remove: async () => (calls.push(["remove"]), view),
    },
    log: { error() {} },
  });
  beforeEach(async () => {
    redirect = null;
    calls.length = 0;
    server = createWebServer(options());
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    port = server.address().port;
  });
  afterEach(() => server.close());
  const call = (method, path, body) =>
    new Promise((resolve, reject) => {
      const data = body === undefined ? undefined : JSON.stringify(body);
      const req = request({ host: "127.0.0.1", port, method, path, headers: { "x-videofx": "1", ...(data ? { "content-length": Buffer.byteLength(data) } : {}) } }, (res) => {
        let text = "";
        res.on("data", (c) => (text += c));
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, json: text ? JSON.parse(text) : null }));
      });
      req.on("error", reject);
      req.end(data);
    });

  it("passes uploads, generation and removal through", async () => {
    expect((await call("GET", "/api/tls")).json).toEqual(view);
    expect((await call("PUT", "/api/tls", { cert: "C", key: "K" })).status).toBe(200);
    expect((await call("POST", "/api/tls/self-signed", {})).status).toBe(200);
    expect((await call("DELETE", "/api/tls", {})).status).toBe(200);
    expect(calls).toEqual([["upload", "C", "K"], ["selfSigned"], ["remove"]]);
  });

  it("sends plain HTTP to HTTPS when asked, keeping host and path", async () => {
    redirect = 8443;
    const res = await call("GET", "/api/status?x=1");
    expect(res.status).toBe(308);
    expect(res.headers.location).toBe(`https://127.0.0.1:8443/api/status?x=1`);
    redirect = null;
    expect((await call("GET", "/api/status")).status).toBe(200);
  });

  it.skipIf(!hasOpenssl)("serves the same handler over HTTPS, without redirecting it", async () => {
    const dir = mkdtempSync(join(tmpdir(), "videofx-tls-srv-"));
    try {
      const store = new TlsStore({ dir });
      await store.generate({ names: ["localhost"], ips: ["127.0.0.1"] });
      redirect = 443;
      const secure = createHttpsServer(store.load(), createWebHandler(options()));
      await new Promise((r) => secure.listen(0, "127.0.0.1", r));
      const res = await new Promise((resolve, reject) => {
        const req = httpsRequest({ host: "127.0.0.1", port: secure.address().port, path: "/api/status", ca: store.load().cert }, (r) => {
          let text = "";
          r.on("data", (c) => (text += c));
          r.on("end", () => resolve({ status: r.statusCode, text }));
        });
        req.on("error", reject);
        req.end();
      });
      secure.close();
      expect(res.status).toBe(200);
      expect(JSON.parse(res.text).ok).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
