// Web-made settings, saved in settings.json in the state folder (/var/lib/videofx).
// Precedence: settings.json, then /etc/default/videofx, then built-in defaults.
// The web password is stored as a scrypt hash, never in plain text, and is never
// returned to the browser.

import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { EventEmitter } from "node:events";
import { copyFileSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SETTING, SETTINGS, checkPins, defaultContext, resolveSettings } from "./config.js";
import { HttpError } from "./media.js";

const sha = (s) => createHash("sha256").update(s).digest();

export function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32);
  return { scrypt: `${salt.toString("base64")}:${hash.toString("base64")}` };
}

function matchesHash(password, stored) {
  const [salt, hash] = stored.scrypt.split(":").map((p) => Buffer.from(p, "base64"));
  const got = scryptSync(password, salt, hash.length);
  return got.length === hash.length && timingSafeEqual(got, hash);
}

const isHash = (v) => typeof v === "object" && v !== null && typeof v.scrypt === "string" && v.scrypt.includes(":");

/** Atomic JSON write: temp file in the same folder, then rename over the target. */
export function writeJsonAtomic(file, value) {
  const tmp = `${file}.tmp-${randomBytes(4).toString("hex")}`;
  try {
    writeFileSync(tmp, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
    renameSync(tmp, file);
  } catch (err) {
    try {
      unlinkSync(tmp);
    } catch {
      // nothing to clean up
    }
    throw err;
  }
}

export class Settings extends EventEmitter {
  #file;
  #env;
  #ctx;
  #log;
  #web = {}; // what settings.json holds (validated)
  #values;
  #sources;
  #atBoot; // values when the service started, to tell when a restart is due
  #verified = null; // sha256 of the last password that matched, and what it matched

  constructor({ dir, env = process.env, ctx = defaultContext(), log = console }) {
    super();
    this.#file = join(dir, "settings.json");
    this.#env = env;
    this.#ctx = ctx;
    this.#log = log;
    this.#load(dir);
    this.#resolve();
    this.#atBoot = { ...this.#values };
  }

  get file() {
    return this.#file;
  }

  get(key) {
    return this.#values[key];
  }

  source(key) {
    return this.#sources[key];
  }

  /** All resolved values, except the password. */
  get values() {
    const { password: _, ...rest } = this.#values;
    return rest;
  }

  get passwordSet() {
    const p = this.#values.password;
    return isHash(p) || (typeof p === "string" && p !== "");
  }

  /** Check a password against the current one. True when no password is set. */
  verifyPassword(password) {
    const current = this.#values.password;
    if (!this.passwordSet) return true;
    if (typeof password !== "string") return false;
    if (typeof current === "string") return timingSafeEqual(sha(password), sha(current));
    // scrypt costs ~100 ms on a Pi 3; the page polls every 3 s, so remember the last match.
    const digest = sha(password);
    if (this.#verified?.hash === current.scrypt && timingSafeEqual(this.#verified.digest, digest)) return true;
    const ok = matchesHash(password, current);
    if (ok) this.#verified = { hash: current.scrypt, digest };
    return ok;
  }

  /** For the web page: values, where they come from, defaults. Never the password. */
  describe() {
    // Defaults can depend on other values (e.g. the playlist path on the media folder).
    const defaults = Object.fromEntries(SETTINGS.map((d) => [d.key, d.default(this.#values, this.#ctx)]));
    return {
      settings: SETTINGS.map((def) => {
        const item = {
          key: def.key,
          env: [def.env ?? []].flat()[0] ?? null,
          group: def.group,
          label: def.label,
          help: def.help ?? null,
          apply: def.apply,
          advanced: !!def.advanced,
          custom: !!def.custom, // edited in its own section of the page (scare clips, schedule, IR code)
          options: def.options ?? null,
          source: this.#sources[def.key],
        };
        if (def.secret) return { ...item, isSet: this.passwordSet };
        return { ...item, value: this.#values[def.key], default: defaults[def.key] };
      }),
      restartNeeded: this.restartNeeded,
      device: { model: this.#ctx.model ?? null, id: this.#ctx.deviceName ?? null },
    };
  }

  /** Keys whose change only takes effect after a restart and differ from boot. */
  get restartNeeded() {
    return SETTINGS.filter((d) => d.apply === "restart" && this.#values[d.key] !== this.#atBoot[d.key]).map((d) => d.key);
  }

  /**
   * Set one setting from the web. Throws HttpError 400 (bad value) or 403 (read-only,
   * wrong current password). auth: { currentPassword, confirm } for the password.
   */
  set(key, value, auth = {}) {
    const def = this.#editable(key);
    let parsed;
    try {
      parsed = def.parse(value);
    } catch (err) {
      throw new HttpError(400, `${def.label} ${err.message}`);
    }
    if (def.secret) {
      this.#checkCurrentPassword(auth);
      if (parsed === "") {
        if (auth.confirm !== true) throw new HttpError(400, "Removing the password needs confirmation");
      } else {
        parsed = hashPassword(parsed);
      }
    }
    this.#checkCombined({ ...this.#web, [key]: parsed });
    this.#save({ ...this.#web, [key]: parsed });
    this.emit("change", [key]);
    return this.describeOne(key);
  }

  /** Several settings at once without announcing it (the volume slider). */
  update(changes) {
    const next = { ...this.#web };
    for (const [key, value] of Object.entries(changes)) {
      const def = this.#editable(key);
      if (def.secret) throw new HttpError(400, "use set() for the password");
      try {
        next[key] = def.parse(value);
      } catch (err) {
        throw new HttpError(400, `${def.label} ${err.message}`);
      }
    }
    this.#save(next);
  }

  /** Drop the web value, so the file value or the default applies again. */
  reset(key, auth = {}) {
    const def = this.#editable(key);
    if (!Object.hasOwn(this.#web, key)) return this.describeOne(key);
    const next = { ...this.#web };
    delete next[key];
    if (def.secret) {
      this.#checkCurrentPassword(auth);
      const after = resolveSettings({ env: this.#env, web: next, ctx: this.#ctx }).values.password;
      if (this.passwordSet && after === "" && auth.confirm !== true) {
        throw new HttpError(400, "This removes the password; it needs confirmation");
      }
    }
    this.#save(next);
    this.emit("change", [key]);
    return this.describeOne(key);
  }

  describeOne(key) {
    return this.describe().settings.find((s) => s.key === key);
  }

  #editable(key) {
    const def = SETTING[key];
    if (!def) throw new HttpError(404, `no setting "${key}"`);
    if (def.apply === "fixed") throw new HttpError(403, `${def.label} can only be changed in /etc/default/videofx`);
    return def;
  }

  // Rules that span settings (GPIO pins).
  #checkCombined(web) {
    const { values } = resolveSettings({ env: this.#env, web, ctx: this.#ctx });
    const problem = checkPins(values);
    if (problem) throw new HttpError(400, problem);
  }

  #checkCurrentPassword({ currentPassword }) {
    if (this.passwordSet && !this.verifyPassword(currentPassword ?? "")) {
      throw new HttpError(403, "The current password is wrong");
    }
  }

  #save(web) {
    writeJsonAtomic(this.#file, web);
    this.#web = web;
    this.#resolve();
  }

  #resolve() {
    const { values, sources } = resolveSettings({
      env: this.#env,
      web: this.#web,
      ctx: this.#ctx,
      warn: (m) => this.#log.warn(m),
    });
    this.#values = values;
    this.#sources = sources;
  }

  #load(dir) {
    let raw;
    try {
      raw = readFileSync(this.#file, "utf8");
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
      this.#migrateVolume(dir);
      return;
    }
    let data;
    try {
      data = JSON.parse(raw);
      if (typeof data !== "object" || data === null || Array.isArray(data)) throw new Error("not an object");
    } catch (err) {
      const backup = `${this.#file}.corrupt`;
      this.#log.warn(`${this.#file} is unreadable (${err.message}); using /etc/default/videofx and defaults. Saved a copy as ${backup}`);
      try {
        copyFileSync(this.#file, backup);
      } catch {
        // best effort
      }
      return;
    }
    for (const [key, value] of Object.entries(data)) {
      const def = SETTING[key];
      if (key === "vlcExtraArgs") {
        this.#log.warn(`settings.json: dropping vlcExtraArgs ("${value}"): the player is mpv now; set "Extra mpv options" instead`);
        continue;
      }
      if (!def || def.apply === "fixed") {
        this.#log.warn(`settings.json: ignoring "${key}"`);
        continue;
      }
      try {
        this.#web[key] = def.secret ? (isHash(value) || value === "" ? value : invalid()) : def.parse(value);
      } catch (err) {
        this.#log.warn(`settings.json: ignoring ${key}: ${err.message}`);
      }
    }
  }

  // Before settings.json, the volume lived in volume.json ({ level, muted }).
  #migrateVolume(dir) {
    const old = join(dir, "volume.json");
    let data;
    try {
      data = JSON.parse(readFileSync(old, "utf8"));
    } catch (err) {
      if (err.code !== "ENOENT") this.#log.warn(`${old} is unreadable (${err.message}); not migrated`);
      return;
    }
    const web = {};
    try {
      web.volume = SETTING.volume.parse(data.level);
    } catch {
      // keep the default
    }
    if (typeof data.muted === "boolean") web.muted = data.muted;
    writeJsonAtomic(this.#file, web);
    this.#web = web;
    unlinkSync(old);
    this.#log.info(`Moved ${old} into ${this.#file}`);
  }
}

function invalid() {
  throw new Error("not a stored password hash");
}
