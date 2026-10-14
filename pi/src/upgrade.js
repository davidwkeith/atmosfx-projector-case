// Client for the root-side upgrade helper (upgrade-helper.js). The web service is
// unprivileged and sandboxed (NoNewPrivileges), so it cannot check the Pi's login
// password or run videofx-update itself. It sends one JSON line to a root-owned
// Unix socket and reads one JSON line back. The password only travels over that
// socket and is never stored or logged.

import { connect } from "node:net";

export const SOCKET_PATH = "/run/videofx-upgrade.sock";

/**
 * @param {{action: "upgrade", password: string} | {action: "check"}} request
 * @returns {Promise<{ok: true} | {error: "wrong-password"|"throttled"|"busy"|"unavailable"|"failed", message?: string}>}
 */
export function askHelper(request, { socketPath = SOCKET_PATH, timeoutMs = 90_000 } = {}) {
  return new Promise((resolve) => {
    let buf = "";
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(value);
    };
    const socket = connect(socketPath);
    socket.setTimeout(timeoutMs, () => finish({ error: "unavailable", message: "the upgrade helper did not answer" }));
    socket.on("error", () => finish({ error: "unavailable", message: "the upgrade helper is not running (older install?)" }));
    socket.on("connect", () => socket.write(`${JSON.stringify(request)}\n`));
    socket.on("data", (chunk) => {
      buf += chunk;
      const nl = buf.indexOf("\n");
      if (nl < 0) return;
      try {
        finish(JSON.parse(buf.slice(0, nl)));
      } catch {
        finish({ error: "failed", message: "unreadable answer from the upgrade helper" });
      }
    });
    socket.on("end", () => finish({ error: "failed", message: "the upgrade helper hung up" }));
  });
}
