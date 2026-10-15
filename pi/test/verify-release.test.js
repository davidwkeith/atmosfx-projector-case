// src/verify-release.js: the policy on top of Sigstore's own checks (who signed, and
// that the statement covers this tarball). Sigstore's verify is stubbed: the real one
// needs the network, and it is exercised against a real GitHub attestation by hand
// (see docs/updates.md).
import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ISSUER, checkAttestation, verifyRelease } from "../src/verify-release.js";

const REPO = "davidwkeith/atmosfx-projector-case";
const san = (ref, wf = "build.yml", repo = REPO) => `https://github.com/${repo}/.github/workflows/${wf}@${ref}`;
const signer = (sanValue, issuer = ISSUER) => ({ identity: { subjectAlternativeName: sanValue, extensions: { issuer } } });
const bundleFor = (sha256, { predicateType = "https://slsa.dev/provenance/v1", payloadType = "application/vnd.in-toto+json" } = {}) => ({
  dsseEnvelope: {
    payloadType,
    payload: Buffer.from(JSON.stringify({ _type: "https://in-toto.io/Statement/v1", subject: [{ name: "x.stl", digest: { sha256: "0".repeat(64) } }, { name: "videofx-pi-9.9.9.tar.gz", digest: { sha256 } }], predicateType })).toString("base64"),
  },
});

describe("release attestations", () => {
  const sha = createHash("sha256").update("pretend tarball").digest("hex");

  it("accepts this repo's build.yml on a release tag and returns the tag", () => {
    expect(checkAttestation(signer(san("refs/tags/v9.9.9")), bundleFor(sha), sha)).toBe("v9.9.9");
    expect(checkAttestation(signer(san("refs/tags/v1.0.0-rc.1")), bundleFor(sha), sha)).toBe("v1.0.0-rc.1");
  });

  it("refuses branch and pull request runs, other workflows, other repos and other issuers", () => {
    for (const s of [
      signer(san("refs/heads/main")),
      signer(san("refs/pull/7/merge")),
      signer(san("refs/tags/latest")),
      signer(san("refs/tags/v9.9.9", "evil.yml")),
      signer(san("refs/tags/v9.9.9", "build.yml", "someone/atmosfx-projector-case")),
      signer(san("refs/tags/v9.9.9").replace("github.com", "github.com.evil.example")),
      signer(`${san("refs/tags/v9.9.9")}x`),
      signer(san("refs/tags/v9.9.9"), "https://accounts.google.com"),
      { identity: undefined },
    ]) {
      expect(() => checkAttestation(s, bundleFor(sha), sha)).toThrow();
    }
  });

  it("refuses an attestation that does not cover the tarball or is not build provenance", () => {
    const ok = signer(san("refs/tags/v9.9.9"));
    expect(() => checkAttestation(ok, bundleFor("f".repeat(64)), sha)).toThrow(/does not cover/);
    expect(() => checkAttestation(ok, bundleFor(sha, { predicateType: "https://in-toto.io/attestation/release/v0.2" }), sha)).toThrow(/provenance/);
    expect(() => checkAttestation(ok, bundleFor(sha, { payloadType: "text/plain" }), sha)).toThrow(/in-toto/);
    expect(() => checkAttestation(ok, { messageSignature: {} }, sha)).toThrow(/in-toto/);
  });

  describe("verifyRelease", () => {
    let dir, tarball, bundle;
    beforeAll(async () => {
      dir = await mkdtemp(join(tmpdir(), "vfx-att-"));
      tarball = join(dir, "videofx-pi-9.9.9.tar.gz");
      bundle = `${tarball}.sigstore.json`;
      await writeFile(tarball, "pretend tarball");
      await writeFile(bundle, JSON.stringify(bundleFor(sha)));
    });
    afterAll(() => rm(dir, { recursive: true, force: true }));

    it("hashes the tarball, passes the bundle and cache to Sigstore, then applies the policy", async () => {
      const calls = [];
      const verify = async (b, opts) => (calls.push([b, opts]), signer(san("refs/tags/v9.9.9")));
      await expect(verifyRelease(tarball, bundle, { verify, tufCachePath: "/tmp/tuf" })).resolves.toBe("v9.9.9");
      expect(calls[0][1]).toEqual({ tufCachePath: "/tmp/tuf" });
      await writeFile(join(dir, "changed.tar.gz"), "pretend tarball, with a backdoor");
      await expect(verifyRelease(join(dir, "changed.tar.gz"), bundle, { verify })).rejects.toThrow(/does not cover/);
    });

    it("fails when Sigstore fails or the bundle is missing", async () => {
      const verify = async () => {
        throw new Error("signature verification failed");
      };
      await expect(verifyRelease(tarball, bundle, { verify })).rejects.toThrow(/signature verification failed/);
      await expect(verifyRelease(tarball, join(dir, "missing.json"), { verify })).rejects.toThrow(/no attestation bundle/);
    });
  });
});
