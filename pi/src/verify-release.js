#!/usr/bin/env node
// Check a release tarball against its GitHub build attestation (a Sigstore bundle,
// <tarball>.sigstore.json, made by actions/attest-build-provenance in CI).
//   node verify-release.js TARBALL BUNDLE [--tuf-cache DIR]   -> the release tag on stdout
// Exit 0 only if the bundle is validly signed by Sigstore's public-good instance for
// this repo's build.yml running on a v* tag, logged in Rekor, and its statement names
// the tarball's sha256. videofx-update runs the installed version's copy of this file
// (and of node_modules/sigstore), never the one inside the tarball being checked, and
// then checks that the tag matches the version inside.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { RELEASE_REPO } from "./update.js";

export const ISSUER = "https://token.actions.githubusercontent.com";
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// The certificate's SAN: workflow file at the ref it ran on. Only release tags count:
// a branch or pull request run of the same workflow can't make a release a Pi installs.
export const identityPattern = (repo = RELEASE_REPO) =>
  new RegExp(`^https://github\\.com/${esc(repo)}/\\.github/workflows/build\\.yml@refs/tags/(v\\d+\\.\\d+\\.\\d+(?:-[0-9A-Za-z.-]+)?)$`);

/**
 * The policy on top of Sigstore's own checks: who signed (signer.identity, as
 * sigstore.verify returns it) and what (the in-toto statement in the bundle).
 * Returns the release tag; throws on anything else.
 */
export function checkAttestation(signer, bundle, sha256, repo = RELEASE_REPO) {
  const id = signer?.identity;
  if (id?.extensions?.issuer !== ISSUER) throw new Error(`not signed by GitHub Actions (issuer ${id?.extensions?.issuer ?? "none"})`);
  const m = identityPattern(repo).exec(id.subjectAlternativeName ?? "");
  if (!m) throw new Error(`signed by ${id.subjectAlternativeName ?? "nobody"}, not ${repo}'s build.yml on a release tag`);
  const env = bundle?.dsseEnvelope;
  if (env?.payloadType !== "application/vnd.in-toto+json") throw new Error("the bundle holds no in-toto attestation");
  const st = JSON.parse(Buffer.from(env.payload, "base64").toString("utf8"));
  if (!/^https:\/\/slsa\.dev\/provenance\/v1$/.test(st.predicateType ?? "")) throw new Error(`not a build provenance attestation (${st.predicateType})`);
  if (!(st.subject ?? []).some((s) => s?.digest?.sha256 === sha256)) throw new Error("the attestation does not cover this tarball (sha256 differs)");
  return m[1];
}

export async function verifyRelease(tarballPath, bundlePath, { tufCachePath, verify, repo } = {}) {
  let bundle;
  try {
    bundle = JSON.parse(readFileSync(bundlePath, "utf8"));
  } catch (err) {
    throw new Error(`no attestation bundle at ${bundlePath} (${err.code ?? err.message})`);
  }
  const sha256 = createHash("sha256").update(readFileSync(tarballPath)).digest("hex");
  verify ??= (await import("sigstore")).verify;
  // Signature, certificate chain to Fulcio, Rekor inclusion and timestamp; the trust
  // root comes from Sigstore's TUF repository (network, cached in tufCachePath).
  const signer = await verify(bundle, tufCachePath ? { tufCachePath } : {});
  return checkAttestation(signer, bundle, sha256, repo);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { positionals, values: o } = parseArgs({ allowPositionals: true, options: { "tuf-cache": { type: "string" } } });
  if (positionals.length !== 2) {
    console.error("usage: verify-release.js TARBALL BUNDLE [--tuf-cache DIR]");
    process.exit(2);
  }
  try {
    console.log(await verifyRelease(positionals[0], positionals[1], { tufCachePath: o["tuf-cache"] }));
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
