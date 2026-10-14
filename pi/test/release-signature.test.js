// system/videofx-verify-release with real ssh-keygen signatures (throwaway keys).
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const VERIFY = fileURLToPath(new URL("../system/videofx-verify-release", import.meta.url));
const SIGNERS = fileURLToPath(new URL("../system/allowed_signers", import.meta.url));
const hasSshKeygen = spawnSync("ssh-keygen", ["-Y", "help"]).error === undefined;

describe.skipIf(!hasSshKeygen)("release signatures", () => {
  let dir;
  const key = (name) => {
    execFileSync("ssh-keygen", ["-q", "-t", "ed25519", "-N", "", "-C", name, "-f", join(dir, name)]);
    return join(dir, name);
  };
  const sign = (k, file, ns = "videofx-release") => execFileSync("ssh-keygen", ["-q", "-Y", "sign", "-f", k, "-n", ns, file], { stdio: "ignore" });
  const verify = (file, sig, signers) => spawnSync("bash", [VERIFY, file, sig, signers], { encoding: "utf8" });
  let good, other, signers, tarball;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "vfx-sig-"));
    good = key("release");
    other = key("other");
    signers = join(dir, "allowed_signers");
    const pub = (await readFile(`${good}.pub`, "utf8")).trim();
    await writeFile(signers, `# comment\nvideofx-release namespaces="videofx-release" ${pub}\n`);
    tarball = join(dir, "videofx-pi-9.9.9.tar.gz");
    await writeFile(tarball, "pretend tarball");
  });
  afterAll(() => rm(dir, { recursive: true, force: true }));

  it("accepts the release key's signature", () => {
    sign(good, tarball);
    expect(verify(tarball, `${tarball}.sig`, signers).status).toBe(0);
  });

  it("refuses a changed tarball, another key, another namespace or no signature", async () => {
    sign(good, tarball);
    const changed = join(dir, "changed.tar.gz");
    await writeFile(changed, "pretend tarball, with a backdoor");
    expect(verify(changed, `${tarball}.sig`, signers).status).not.toBe(0);

    const byOther = join(dir, "other.tar.gz");
    await writeFile(byOther, "pretend tarball");
    sign(other, byOther);
    expect(verify(byOther, `${byOther}.sig`, signers).status).not.toBe(0);

    const wrongNs = join(dir, "ns.tar.gz");
    await writeFile(wrongNs, "pretend tarball");
    sign(good, wrongNs, "file");
    expect(verify(wrongNs, `${wrongNs}.sig`, signers).status).not.toBe(0);

    expect(verify(tarball, join(dir, "missing.sig"), signers).stderr).toMatch(/no signature/);
  });

  it("refuses everything while allowed_signers has no key (the repo's file until the owner adds one)", async () => {
    sign(good, tarball);
    const empty = join(dir, "empty_signers");
    await writeFile(empty, "# no keys yet\n");
    const r = verify(tarball, `${tarball}.sig`, empty);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/no release signing key/);
  });

  it("the shipped allowed_signers only holds release keys", async () => {
    const lines = (await readFile(SIGNERS, "utf8")).split("\n").filter((l) => l.trim() && !l.startsWith("#"));
    for (const l of lines) expect(l).toMatch(/^videofx-release namespaces="videofx-release" (ssh-ed25519|sk-ssh-ed25519@openssh\.com) /);
  });
});
