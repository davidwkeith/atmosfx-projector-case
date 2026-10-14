#!/usr/bin/env node
// Root-side helper for the web page's Upgrade and Check now buttons. Started by
// systemd per connection (videofx-upgrade.socket, Accept=yes) with the socket as
// stdin and stdout. Reads one JSON line, writes one JSON line.
//
//   {"action":"check"}     runs `videofx-update --check` (it only reads GitHub)
//   {"action":"upgrade"}   starts `videofx-update` as a transient unit; the Pi reboots
//
// No password reaches this helper. The socket is private to the service user (see
// videofx-user), so the web service is the only caller, and the web page offers
// Upgrade only behind its own password: it never asks for the Pi's login password,
// which would cross the LAN in plain HTTP.

import { execFile } from "node:child_process";
import { createInterface } from "node:readline";
import { pathToFileURL } from "node:url";

function runCommand(cmd, args, timeoutMs) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: timeoutMs }, (err, _out, stderr) => resolve(err ? { ok: false, message: String(stderr || err.message).trim().split("\n").pop() } : { ok: true }));
  });
}

export const defaults = {
  check: () => runCommand("/usr/local/sbin/videofx-update", ["--check"], 60_000),
  // Transient unit: survives this helper exiting, and a second click while one runs fails.
  start: () => runCommand("systemd-run", ["--no-block", "--collect", "--unit=videofx-upgrade-run", "/usr/local/sbin/videofx-update"], 15_000),
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

  deps.log("videofx-upgrade: starting videofx-update");
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
