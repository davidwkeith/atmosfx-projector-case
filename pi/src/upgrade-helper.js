#!/usr/bin/env node
// Root-side helper for the web page's Upgrade and Check now buttons. Started by
// systemd per connection (videofx-upgrade.socket, Accept=yes) with the socket as
// stdin and stdout. Reads one JSON line, writes one JSON line.
//
//   {"action":"check"}                      runs `videofx-update --check` (no password: it only reads GitHub)
//   {"action":"upgrade","password":"..."}   verifies the login user's password, then starts
//                                           `videofx-update` as a transient unit (it reboots the Pi)
//
// The password is checked with unix_chkpwd (PAM's own helper), never parsed out of
// /etc/shadow here, and is never logged. A wrong guess waits FAIL_DELAY_MS before
// the answer, and the socket accepts only a couple of connections at once.

import { execFile, spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";

export const FAIL_DELAY_MS = 2000;
const MAX_PASSWORD = 256;

/** The service account: the first login user (uid 1000), as in videofx-user. */
function loginUser() {
  return new Promise((resolve) => {
    execFile("getent", ["passwd", "1000"], (err, out) => resolve(err ? null : out.split(":")[0] || null));
  });
}

/** unix_chkpwd <user> nullok reads the password and a NUL on stdin; exit 0 = correct. */
export function verifyPassword(password, user) {
  return new Promise((resolve) => {
    const child = spawn("/usr/sbin/unix_chkpwd", [user, "nullok"], { stdio: ["pipe", "ignore", "ignore"] });
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0));
    child.stdin.on("error", () => {});
    child.stdin.end(`${password}\0`);
  });
}

function runCommand(cmd, args, timeoutMs) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: timeoutMs }, (err, _out, stderr) => resolve(err ? { ok: false, message: String(stderr || err.message).trim().split("\n").pop() } : { ok: true }));
  });
}

export const defaults = {
  user: loginUser,
  verify: verifyPassword,
  check: () => runCommand("/usr/local/sbin/videofx-update", ["--check"], 60_000),
  // Transient unit: survives this helper exiting, and a second click while one runs fails.
  start: () => runCommand("systemd-run", ["--no-block", "--collect", "--unit=videofx-upgrade-run", "/usr/local/sbin/videofx-update"], 15_000),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  log: (msg) => console.error(msg),
};

/** One request line in, one response object out. Pure apart from the injected deps. */
export async function handle(line, deps = defaults) {
  let req;
  try {
    req = JSON.parse(line);
  } catch {
    return { error: "failed", message: "not JSON" };
  }
  if (req?.action === "check") {
    const r = await deps.check();
    return r.ok ? { ok: true } : { error: "failed", message: r.message };
  }
  if (req?.action !== "upgrade") return { error: "failed", message: "unknown action" };

  const pw = req.password;
  const user = await deps.user();
  if (!user) return { error: "failed", message: "no login user (uid 1000)" };
  if (typeof pw !== "string" || pw === "" || pw.length > MAX_PASSWORD || pw.includes("\0") || !(await deps.verify(pw, user))) {
    deps.log("videofx-upgrade: wrong password");
    await deps.sleep(FAIL_DELAY_MS);
    return { error: "wrong-password" };
  }
  deps.log(`videofx-upgrade: password accepted for ${user}, starting videofx-update`);
  const r = await deps.start();
  return r.ok ? { ok: true } : { error: "busy", message: r.message };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  const timer = setTimeout(() => process.exit(1), 30_000); // a client that never sends its line
  rl.once("line", async (line) => {
    clearTimeout(timer);
    const answer = await handle(line.slice(0, 2048));
    process.stdout.write(`${JSON.stringify(answer)}\n`, () => process.exit(0));
  });
}
