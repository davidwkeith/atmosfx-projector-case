// LAN-only web UI: playlist, media upload, play/stop and Matter pairing.
// Plain node:http. Every request passes guard(): private source address, known
// Host header (DNS-rebinding guard), optional basic auth, and a custom header on
// writes so other web sites cannot post to it from a browser (CSRF).

import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { isIP } from "node:net";
import { fileURLToPath } from "node:url";
import { HttpError } from "./media.js";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));

// The only files served from disk. Media files are never served.
const STATIC = {
  "/": [here("../public/index.html"), "text/html; charset=utf-8"],
  "/app.js": [here("../public/app.js"), "text/javascript; charset=utf-8"],
  "/app.css": [here("../public/app.css"), "text/css; charset=utf-8"],
  "/playlist-core.js": [here("./playlist-core.js"), "text/javascript; charset=utf-8"],
};

const JSON_LIMIT = 256 * 1024;
export const WRITE_HEADER = "x-videofx";

/** Private, loopback, link-local and ULA addresses only. */
export function isLanAddress(addr = "") {
  const ip = addr.replace(/^::ffff:(?=\d+\.)/i, "").replace(/%.*$/, "");
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
  }
  if (isIP(ip) === 6) {
    const lower = ip.toLowerCase();
    return lower === "::1" || /^fe[89ab]/.test(lower) || /^f[cd]/.test(lower);
  }
  return false;
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

async function readJson(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > JSON_LIMIT) throw new HttpError(413, "request too large");
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
 * @param {() => object} o.scare                     fire a scare; returns the player's result
 * @param {() => Promise<string|null>} o.irLearn     wait for one remote press
 * @param {(code?: string) => Promise<void>} o.irTest
 * @param {(name: string) => void} [o.mediaDeleted]
 */
export function createWebServer(o) {
  const log = o.log ?? console;

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

    if (method === "GET" && STATIC[path]) {
      const [file, type] = STATIC[path];
      return send(res, 200, await readFile(file), type);
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
        const problem = o.media.problem();
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
