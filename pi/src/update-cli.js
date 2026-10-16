#!/usr/bin/env node
// Helper for system/videofx-update (runs as root on the Pi, never from the web page).
//   node update-cli.js latest   --token-file F [--tag vX.Y.Z]   -> JSON on stdout
//   node update-cli.js download --token-file F --url URL --out FILE
//   node update-cli.js check    --token-file F --out FILE --current X.Y.Z
//   node update-cli.js result   --out FILE --state S [--message M] [--current X.Y.Z] [--log LOG]
// The repo is private for now: a GitHub token with read access to its contents
// goes in the token file (root only).

import { randomBytes } from "node:crypto";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { RELEASE_REPO, checkResult, lastUpdateRecord, pickAsset, unattested } from "./update.js";

const { positionals, values: o } = parseArgs({
  allowPositionals: true,
  options: { "token-file": { type: "string" }, tag: { type: "string" }, url: { type: "string" }, out: { type: "string" }, current: { type: "string" }, state: { type: "string" }, message: { type: "string" }, log: { type: "string" }, repo: { type: "string", default: RELEASE_REPO } },
});

function headers(accept) {
  const h = { accept, "user-agent": "videofx-update", "x-github-api-version": "2022-11-28" };
  if (o["token-file"]) {
    try {
      const token = readFileSync(o["token-file"], "utf8").trim();
      if (token) h.authorization = `Bearer ${token}`;
    } catch {
      // no token: public repo
    }
  }
  return h;
}

async function release() {
  const path = o.tag ? `releases/tags/${encodeURIComponent(o.tag)}` : "releases/latest";
  const res = await fetch(`https://api.github.com/repos/${o.repo}/${path}`, { headers: headers("application/vnd.github+json") });
  if (!res.ok) throw new Error(`GitHub ${res.status} ${res.statusText}${res.status === 404 ? " (private repo? check the token file)" : ""}`);
  return pickAsset(await res.json());
}

async function latest() {
  const asset = await release();
  if (!asset) throw new Error("the release has no videofx-pi-<version>.tar.gz asset");
  // Releases without an attestation are not offered: videofx-update would refuse them anyway.
  if (!asset.bundleUrl) throw new Error(unattested(asset));
  return asset;
}

// Root writes into a folder the unprivileged service owns: never follow a
// symlink it planted. Create a fresh file (wx fails on any existing path,
// links included), then rename over the target, which replaces a link.
function writeSafely(out, value) {
  const tmp = `${out}.${randomBytes(6).toString("hex")}.tmp`;
  writeFileSync(tmp, JSON.stringify(value) + "\n", { mode: 0o644, flag: "wx" });
  renameSync(tmp, out);
}

const cmd = positionals[0];
try {
  if (cmd === "latest") {
    console.log(JSON.stringify(await latest()));
  } else if (cmd === "download") {
    // The asset API redirects to storage; fetch drops the Authorization header on
    // the cross-origin hop, as it should.
    const res = await fetch(o.url, { headers: headers("application/octet-stream") });
    if (!res.ok) throw new Error(`download: ${res.status} ${res.statusText}`);
    writeFileSync(o.out, Buffer.from(await res.arrayBuffer()), { mode: 0o600 });
  } else if (cmd === "check") {
    let result;
    try {
      result = checkResult(await release(), o.current);
    } catch (err) {
      result = { latest: null, error: err.message, checkedAt: new Date().toISOString() };
    }
    writeSafely(o.out, result);
    console.log(JSON.stringify(result));
  } else if (cmd === "result") {
    let log = "";
    try {
      log = o.log ? readFileSync(o.log, "utf8") : "";
    } catch {
      // no log yet
    }
    writeSafely(o.out, lastUpdateRecord({ state: o.state, message: o.message, version: o.current ?? null }, log));
  } else {
    console.error("usage: update-cli.js latest|download|check|result ...");
    process.exit(2);
  }
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
