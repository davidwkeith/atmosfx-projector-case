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

/** The pi/ tarball among a GitHub release's assets. */
export function pickAsset(release) {
  for (const a of release?.assets ?? []) {
    const m = ASSET.exec(a.name ?? "");
    if (m) return { name: a.name, version: m[1], url: a.url, tag: release.tag_name, draft: !!release.draft, prerelease: !!release.prerelease };
  }
  return null;
}

/** For the page: current version, and whether the last check found a newer one. */
export function updateStatus(current, checkText) {
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
  };
}
