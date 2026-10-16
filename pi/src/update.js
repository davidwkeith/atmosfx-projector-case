// Version info and update checks. The web page only reads a file that
// `videofx-update --check` (run on the Pi, by you or a timer) writes; the page
// itself never reaches the network.

import { readFileSync } from "node:fs";

export const RELEASE_REPO = "davidwkeith/atmosfx-projector-case";
export const ASSET = /^videofx-pi-(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\.tar\.gz$/;

/** package.json version plus the git sha baked in at build (version.json). */
export function readVersion(appDir, read = (f) => readFileSync(f, "utf8")) {
  const pkg = JSON.parse(read(`${appDir}/package.json`));
  let sha = null;
  try {
    sha = JSON.parse(read(`${appDir}/version.json`)).sha ?? null;
  } catch {
    // development checkout: no baked sha
  }
  return { version: pkg.version, sha };
}

/** Semver-ish compare: -1, 0, 1. A pre-release sorts before its release. */
export function compareVersions(a, b) {
  const parse = (v) => {
    const [core, pre = ""] = String(v).replace(/^v/, "").split("-", 2);
    return { nums: core.split(".").map((n) => Number(n) || 0), pre };
  };
  const [x, y] = [parse(a), parse(b)];
  for (let i = 0; i < 3; i++) {
    const d = (x.nums[i] ?? 0) - (y.nums[i] ?? 0);
    if (d) return Math.sign(d);
  }
  if (x.pre === y.pre) return 0;
  if (!x.pre) return 1;
  if (!y.pre) return -1;
  return x.pre < y.pre ? -1 : 1;
}

/**
 * The pi/ tarball among a GitHub release's assets, with its GitHub build attestation
 * (<tarball>.sigstore.json, attached by CI) or bundleUrl null if it has none.
 */
export function pickAsset(release) {
  const assets = release?.assets ?? [];
  for (const a of assets) {
    const m = ASSET.exec(a.name ?? "");
    if (!m) continue;
    const bundle = assets.find((s) => s.name === `${a.name}.sigstore.json`);
    return { name: a.name, version: m[1], url: a.url, bundleUrl: bundle?.url ?? null, tag: release.tag_name, draft: !!release.draft, prerelease: !!release.prerelease };
  }
  return null;
}

export const unattested = (asset) => `${asset.tag} has no GitHub attestation (no ${asset.name}.sigstore.json), so it can't be installed`;

/**
 * What `videofx-update --check` records for the latest release's asset. A release
 * with no attestation that is not newer than what is installed is simply "up to date"
 * (an old release from before attestations); only a newer one is an error.
 */
export function checkResult(asset, current, now = new Date()) {
  const checkedAt = now.toISOString();
  if (!asset) return { latest: null, error: "the release has no videofx-pi-<version>.tar.gz asset", checkedAt };
  if (!asset.bundleUrl && compareVersions(asset.version, current) > 0) {
    return { latest: null, error: unattested(asset), checkedAt };
  }
  return { latest: asset.version, tag: asset.tag, checkedAt };
}

/** For the page: current version, and whether the last check found a newer one. */
export function updateStatus(current, checkText, lastText = "") {
  let check = null;
  try {
    check = JSON.parse(checkText);
  } catch {
    // never checked
  }
  const latest = check?.latest ?? null;
  return {
    version: current.version,
    sha: current.sha,
    latest,
    checkedAt: check?.checkedAt ?? null,
    available: Boolean(latest && compareVersions(latest, current.version) > 0),
    error: check?.error ?? null,
    last: lastUpdate(lastText),
  };
}

export const UPDATE_STATES = ["running", "up-to-date", "done", "failed", "stopped"];
export const LOG_TAIL_LINES = 20;

/**
 * What videofx-update writes to update-last.json at each step (the log itself is
 * root-only on the data partition): the state, a one-line reason, the version
 * installed at that moment and the end of the log, so a failed run explains itself
 * after the reboots that wipe the journal.
 */
export function lastUpdateRecord({ state, message = "", version = null }, logText = "", now = new Date()) {
  if (!UPDATE_STATES.includes(state)) throw new Error(`unknown update state ${state}`);
  const lines = logText.split("\n").map((l) => l.trimEnd());
  while (lines.length && !lines.at(-1)) lines.pop();
  return { state, message: message || null, version, at: now.toISOString(), tail: lines.slice(-LOG_TAIL_LINES) };
}

/** update-last.json for the page; null when no update has run or the file is junk. */
export function lastUpdate(text) {
  let r;
  try {
    r = JSON.parse(text);
  } catch {
    return null;
  }
  if (!r || !UPDATE_STATES.includes(r.state)) return null;
  return {
    state: r.state,
    message: typeof r.message === "string" ? r.message : null,
    version: typeof r.version === "string" ? r.version : null,
    at: typeof r.at === "string" ? r.at : null,
    tail: Array.isArray(r.tail) ? r.tail.filter((l) => typeof l === "string").slice(-LOG_TAIL_LINES) : [],
  };
}
