#!/usr/bin/env node
// Helper for system/videofx-update (runs as root on the Pi, never from the web page).
//   node update-cli.js latest   --token-file F [--tag vX.Y.Z]   -> JSON on stdout
//   node update-cli.js download --token-file F --url URL --out FILE
//   node update-cli.js check    --token-file F --out FILE --current X.Y.Z
// The repo is private for now: a GitHub token with read access to its contents
// goes in the token file (root only).

import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { RELEASE_REPO, pickAsset } from "./update.js";

const { positionals, values: o } = parseArgs({
  allowPositionals: true,
  options: { "token-file": { type: "string" }, tag: { type: "string" }, url: { type: "string" }, out: { type: "string" }, current: { type: "string" }, repo: { type: "string", default: RELEASE_REPO } },
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

async function latest() {
  const path = o.tag ? `releases/tags/${encodeURIComponent(o.tag)}` : "releases/latest";
  const res = await fetch(`https://api.github.com/repos/${o.repo}/${path}`, { headers: headers("application/vnd.github+json") });
  if (!res.ok) throw new Error(`GitHub ${res.status} ${res.statusText}${res.status === 404 ? " (private repo? check the token file)" : ""}`);
  const asset = pickAsset(await res.json());
  if (!asset) throw new Error("the release has no videofx-pi-<version>.tar.gz asset");
  return asset;
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
      const a = await latest();
      result = { latest: a.version, tag: a.tag, checkedAt: new Date().toISOString() };
    } catch (err) {
      result = { latest: null, error: err.message, checkedAt: new Date().toISOString() };
    }
    writeFileSync(o.out, JSON.stringify(result) + "\n", { mode: 0o644 });
    console.log(JSON.stringify(result));
  } else {
    console.error("usage: update-cli.js latest|download|check ...");
    process.exit(2);
  }
} catch (err) {
  console.error(err.message);
  process.exit(1);
}
