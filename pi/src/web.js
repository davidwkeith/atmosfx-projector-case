// LAN-only web UI: playlist, media upload, play/stop and Matter pairing.
// Plain node:http. Every request passes guard(): private source address, known
// Host header (DNS-rebinding guard), optional basic auth, and a custom header on
// writes so other web sites cannot post to it from a browser (CSRF).

import { readFile, realpath } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { createServer } from "node:http";
import { BlockList, isIP } from "node:net";
import { networkInterfaces } from "node:os";
import { fileURLToPath } from "node:url";
import { HttpError } from "./media.js";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));

const PUBLIC = here("../public");
const DOCS = here("../docs");
const TYPES = {
  js: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  html: "text/html; charset=utf-8",
  md: "text/markdown; charset=utf-8",
};

/**
 * The only files served from disk: public/**.{js,css,html}, public/help/<slug>.md, the
 * user guides docs/<slug>.md (served as /docs/<slug>.md) and the shared playlist module from src/. Names are lower-case letters, digits and hyphens
 * with exactly one dot, so "..", dotfiles and %-escapes never match. The real path must
 * also stay under the real public folder (a symlink cannot lead out). Media files are never served.
 * @returns {Promise<[string, string] | null>} [file, content type]
 */
export async function staticFile(path, root = PUBLIC, docsRoot = DOCS) {
  if (path === "/") path = "/index.html";
  if (path === "/playlist-core.js") return [here("./playlist-core.js"), TYPES.js];
  const m = /^\/((?:[a-z][a-z0-9-]*\/)*[a-z][a-z0-9-]*)\.(js|css|html|md)$/.exec(path);
  if (!m) return null;
  const [, name, ext] = m;
  const isHelp = /^help\/[a-z][a-z0-9-]{0,40}$/.test(name);
  const isDoc = /^docs\/[a-z][a-z0-9-]{0,40}$/.test(name);
  if ((ext === "md") !== (isHelp || isDoc)) return null; // .md only under help/ and docs/, and those hold only .md
  let real;
  let base;
  try {
    base = await realpath(isDoc ? docsRoot : root);
    real = await realpath(isDoc ? resolve(docsRoot, `${name.slice(5)}.md`) : resolve(root, `${name}.${ext}`));
  } catch {
    return null;
  }
  return real.startsWith(base + sep) ? [real, TYPES[ext]] : null;
}

const JSON_LIMIT = 256 * 1024;
export const WRITE_HEADER = "x-videofx";

/**
 * Private, loopback, link-local and ULA addresses, plus anything on one of this
 * Pi's own subnets. The last part matters for IPv6: a LAN with a routed prefix
 * gives every device a global address, avahi then publishes the Pi's global AAAA,
 * and Apple devices prefer it for videofx-xxxx.local. A router never forwards
 * traffic from outside with an on-link source address.
 */
export function isLanAddress(addr = "", ifaces = networkInterfaces) {
  const ip = addr.replace(/^::ffff:(?=\d+\.)/i, "").replace(/%.*$/, "");
  const family = isIP(ip);
  if (family === 4) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254)) return true;
  } else if (family === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::1" || /^fe[89ab]/.test(lower) || /^f[cd]/.test(lower)) return true;
  } else {
    return false;
  }
  return onLink(ip, family, typeof ifaces === "function" ? ifaces() : ifaces);
}

// Is ip inside the subnet of one of our own (non-loopback) interface addresses?
function onLink(ip, family, ifaces) {
  const name = family === 4 ? "ipv4" : "ipv6";
  const own = new BlockList();
  for (const a of Object.values(ifaces ?? {}).flat()) {
    const prefix = Number(a?.cidr?.split("/")[1]);
    if (!a || a.internal || isIP(a.address) !== family || !Number.isInteger(prefix)) continue;
    if (prefix < (family === 4 ? 8 : 16)) continue; // a default-route-sized "subnet" is not a LAN
    try {
      own.addSubnet(a.address.replace(/%.*$/, ""), prefix, name);
    } catch {
      // odd address: skip it
    }
  }
  return own.check(ip, name);
}

/** IP literals, localhost and our own names; anything else could be DNS rebinding. */
export function isAllowedHost(hostHeader = "", names = []) {
  const host = hostHeader
    .toLowerCase()
    .replace(/:\d+$/, "")
    .replace(/^\[(.*)\]$/, "$1")
    .replace(/\.$/, "");
  return isIP(host) !== 0 || host === "localhost" || names.map((n) => n.toLowerCase()).includes(host);
}

/** Password from an Authorization: Basic header (any user name), or undefined. */
export function basicPassword(header) {
  const m = /^Basic (.+)$/i.exec(header ?? "");
  if (!m) return undefined;
  const decoded = Buffer.from(m[1], "base64").toString("utf8");
  return decoded.slice(decoded.indexOf(":") + 1);
}

function send(res, status, body, type = "application/json; charset=utf-8") {
  const data = typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  // On errors, close the connection rather than reading the rest of a rejected upload.
  if (status >= 400) res.setHeader("connection", "close");
  res.writeHead(status, {
    "content-type": type,
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "content-security-policy": "default-src 'self'; img-src 'self' data:; style-src 'self'; frame-ancestors 'none'",
  });
  res.end(data);
}

async function readJson(req, limit = JSON_LIMIT) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new HttpError(413, "request too large");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw new HttpError(400, "invalid JSON");
  }
}

/**
 * @param {object} o
 * @param {ReturnType<import("./media.js").createMediaStore>} o.media
 * @param {() => object} o.status          device state for the UI
 * @param {() => string|undefined} [o.problem]  why playback cannot start in the current mode
 * @param {(on: boolean) => Promise<void>} o.setPower  goes through Matter so controllers stay in sync
 * @param {(v: {level?: number, muted?: boolean}) => Promise<object>} o.setVolume
 * @param {() => void} o.playlistChanged   restarts playback if playing
 * @param {() => string|undefined} o.pairingSvg
 * @param {() => Promise<void>} o.resetMatter
 * @param {{ passwordSet: boolean, verifyPassword: (p?: string) => boolean }} o.auth
 * @param {() => string[]} o.hostNames   evaluated per request (settings can change them)
 * @param {import("./settings.js").Settings} o.settings
 * @param {(key: string) => Promise<string|undefined>} [o.afterSettingChange]  applies a change, may return a note
 * @param {() => Promise<void>} o.restart
 * @param {(auth: {trusted: true} | {password: string}) => Promise<{ok: true}|{error: string, message?: string}>} [o.upgrade]  checks the Pi login password in the root helper, then starts videofx-update
 * @param {() => Promise<{ok: true}|{error: string, message?: string}>} [o.checkUpdate]  asks the root helper to look at GitHub now
 * @param {() => object} o.scare                     fire a scare; returns the player's result
 * @param {() => Promise<string|null>} o.irLearn     wait for one remote press
 * @param {(code?: string) => Promise<void>} o.irTest
 * @param {(name: string) => void} [o.mediaDeleted]
 */
export function createWebServer(o) {
  const log = o.log ?? console;

  // Wrong Pi-login guesses per client address: 5 in 5 minutes, then 429. Per address
  // (as Home Assistant's ip_ban does), so one client cannot lock out the others.
  const wrongGuesses = new Map();
  const recent = (ip) => (wrongGuesses.get(ip) ?? []).filter((t) => Date.now() - t < 300_000);
  const throttled = (ip) => recent(ip).length >= 5;
  const noteWrong = (ip) => {
    // Drop addresses whose guesses have all expired, so the table cannot grow without bound.
    for (const [addr, times] of wrongGuesses) if (times.every((t) => Date.now() - t >= 300_000)) wrongGuesses.delete(addr);
    wrongGuesses.set(ip, [...recent(ip), Date.now()]);
  };

  const HELPER_ERRORS = {
    "wrong-password": [403, "That is not the Pi's login password."],
    "no-update": [409, "No newer version is known. Press Check now first."],
    throttled: [429, "Too many wrong passwords. Wait a moment."],
    busy: [409, "An upgrade is already running."],
    unavailable: [503, "The upgrade helper is not running on this Pi."],
  };
  /** Maps the root helper's answer to a response. */
  function helperResult(res, okStatus, r, okBody) {
    if (r?.ok) return send(res, okStatus, okBody);
    const [status, text] = HELPER_ERRORS[r?.error] ?? [502, "The upgrade helper failed."];
    throw new HttpError(status, r?.message && !HELPER_ERRORS[r?.error] ? `${text} ${r.message}` : text);
  }

  function guard(req, res) {
    if (!isLanAddress(req.socket.remoteAddress)) return send(res, 403, { error: "LAN only" }), false;
    if (!isAllowedHost(req.headers.host, o.hostNames())) return send(res, 421, { error: "unknown host name" }), false;
    if (o.auth.passwordSet && !o.auth.verifyPassword(basicPassword(req.headers.authorization))) {
      res.setHeader("www-authenticate", 'Basic realm="VideoFX", charset="UTF-8"');
      return send(res, 401, { error: "password required" }), false;
    }
    if (req.method !== "GET" && req.method !== "HEAD" && req.headers[WRITE_HEADER] !== "1") {
      return send(res, 403, { error: "missing request header" }), false;
    }
    return true;
  }

  async function route(req, res) {
    const url = new URL(req.url, "http://x");
    const path = url.pathname;
    const method = req.method;

    if (method === "GET") {
      const hit = await staticFile(path);
      if (hit) return send(res, 200, await readFile(hit[0]), hit[1]);
    }
    if (method === "GET" && path === "/api/status") return send(res, 200, o.status());
    if (method === "GET" && path === "/api/pairing.svg") {
      const svg = o.pairingSvg();
      return svg ? send(res, 200, svg, "image/svg+xml") : send(res, 404, { error: "already paired" });
    }
    if (method === "POST" && path === "/api/power") {
      const { on } = await readJson(req);
      if (typeof on !== "boolean") throw new HttpError(400, "on must be true or false");
      if (on) {
        // For the current mode (loop: the playlist; scare: the calm and scare clips).
        const problem = o.problem ? o.problem() : o.media.problem();
        if (problem) throw new HttpError(409, problem);
      }
      await o.setPower(on);
      return send(res, 200, o.status());
    }
    if (method === "POST" && path === "/api/volume") {
      const { level, muted } = await readJson(req);
      let state;
      try {
        state = await o.setVolume({ level, muted });
      } catch (err) {
        if (err instanceof HttpError) throw err;
        throw new HttpError(/number|true or false/.test(err.message) ? 400 : 502, err.message);
      }
      return send(res, 200, state);
    }
    if (method === "GET" && path === "/api/media") {
      return send(res, 200, { ...(await o.media.list()), playlist: await o.media.readPlaylist() });
    }
    if (method === "PUT" && path === "/api/playlist") {
      const { entries } = await readJson(req);
      const saved = await o.media.writePlaylist(entries);
      o.playlistChanged();
      return send(res, 200, { playlist: saved });
    }
    const file = /^\/api\/media\/([^/]+)$/.exec(path);
    if (file) {
      let name;
      try {
        name = decodeURIComponent(file[1]);
      } catch {
        throw new HttpError(400, "invalid file name");
      }
      if (method === "PUT") {
        const length = Number(req.headers["content-length"] ?? 0);
        const result = await o.media.save(name, req, length);
        if (result.playlist) o.playlistChanged();
        return send(res, 201, result);
      }
      if (method === "DELETE") {
        await o.media.remove(name);
        o.mediaDeleted?.(name);
        o.playlistChanged();
        return send(res, 200, { deleted: name });
      }
    }
    if (method === "GET" && path === "/api/backup") {
      // Sensitive (Matter keys, password hash): behind the password when one is
      // set, and never cached.
      const backup = await o.backup();
      res.setHeader("content-disposition", `attachment; filename="${backup.device}-backup-${backup.createdAt.slice(0, 10)}.json"`);
      return send(res, 200, backup);
    }
    if (method === "POST" && path === "/api/restore") {
      return send(res, 200, await o.restore(await readJson(req, 24 * 1024 * 1024)));
    }
    if (method === "POST" && path === "/api/scare") {
      await readJson(req);
      return send(res, 200, o.scare());
    }
    if (method === "POST" && path === "/api/ir/learn") {
      await readJson(req);
      let code;
      try {
        code = await o.irLearn();
      } catch (err) {
        throw new HttpError(502, err.message);
      }
      if (!code) throw new HttpError(408, "nothing received: point the remote at the receiver and press power");
      return send(res, 200, { code });
    }
    if (method === "POST" && path === "/api/ir/test") {
      const { code } = await readJson(req);
      try {
        await o.irTest(code || undefined);
      } catch (err) {
        throw new HttpError(/protocol|raw|must be|pulse|scancode|no IR code/.test(err.message) ? 400 : 502, err.message);
      }
      return send(res, 200, { sent: true });
    }
    if (method === "GET" && path === "/api/settings") return send(res, 200, o.settings.describe());
    const setting = /^\/api\/settings\/([A-Za-z]+)$/.exec(path);
    if (setting && (method === "PUT" || method === "DELETE")) {
      const body = await readJson(req);
      const auth = { currentPassword: body.currentPassword, confirm: body.confirm };
      const key = setting[1];
      const result =
        method === "PUT" ? o.settings.set(key, body.value, auth) : o.settings.reset(key, auth);
      const note = await o.afterSettingChange?.(key);
      return send(res, 200, { setting: result, note: note ?? null, restartNeeded: o.settings.restartNeeded });
    }
    if (method === "POST" && path === "/api/update/check") {
      await readJson(req);
      return helperResult(res, 200, o.checkUpdate ? await o.checkUpdate() : { error: "unavailable" }, { checked: true });
    }
    if (method === "POST" && path === "/api/update/upgrade") {
      const { password } = await readJson(req);
      // A page password is set: guard() already checked it on this request, and
      // that login is the authorization (like an admin in Home Assistant). Without
      // one, anyone on the LAN could press the button, so ask for the Pi's login password.
      const trusted = o.auth.passwordSet;
      const ip = req.socket.remoteAddress;
      if (!trusted) {
        if (typeof password !== "string" || password === "") throw new HttpError(400, "enter the Pi's login password");
        if (throttled(ip)) throw new HttpError(429, HELPER_ERRORS.throttled[1]);
      }
      const r = o.upgrade ? await o.upgrade(trusted ? { trusted: true } : { password }) : { error: "unavailable" };
      if (r?.error === "wrong-password") noteWrong(ip);
      return helperResult(res, 202, r, { upgrading: true });
    }
    if (method === "POST" && path === "/api/restart") {
      await o.restart();
      return send(res, 202, { restarting: true });
    }
    if (method === "POST" && path === "/api/matter/reset") {
      const { confirm } = await readJson(req);
      if (confirm !== "reset") throw new HttpError(400, 'send {"confirm":"reset"}');
      await o.resetMatter();
      return send(res, 202, { resetting: true });
    }
    throw new HttpError(404, "not found");
  }

  return createServer(async (req, res) => {
    if (!guard(req, res)) return;
    try {
      await route(req, res);
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500;
      if (status === 500) log.error(err);
      if (res.headersSent) return res.destroy();
      send(res, status, { error: status === 500 ? "internal error" : err.message });
    }
  });
}
