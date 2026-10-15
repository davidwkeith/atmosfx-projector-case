import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mediaDuration } from "../src/duration.js";
import { fakeMp4 } from "./mp4.js";

describe("clip length from the MP4 header", () => {
  let dir;
  beforeEach(async () => (dir = await mkdtemp(join(tmpdir(), "videofx-dur-"))));
  afterEach(() => rm(dir, { recursive: true, force: true }));

  const at = async (name, data) => {
    await writeFile(join(dir, name), data);
    return mediaDuration(join(dir, name));
  };

  it("reads mvhd v0 and v1, with moov at the start or the end", async () => {
    expect(await at("a.mp4", fakeMp4(95.5))).toBeCloseTo(95.5);
    expect(await at("b.mov", fakeMp4(12, { version: 1 }))).toBeCloseTo(12);
    expect(await at("c.m4v", fakeMp4(3600, { moovLast: true, timescale: 90000 }))).toBeCloseTo(3600);
  });

  it("gives undefined for other formats, junk, truncated or missing files", async () => {
    expect(await at("a.mkv", fakeMp4(10))).toBeUndefined();
    expect(await at("junk.mp4", "not a video at all")).toBeUndefined();
    expect(await at("cut.mp4", fakeMp4(10).subarray(0, 30))).toBeUndefined();
    expect(await mediaDuration(join(dir, "none.mp4"))).toBeUndefined();
  });

  it("reads the bundled clip", async () => {
    expect(await mediaDuration(new URL("../src/default/videofx-default.mp4", import.meta.url).pathname)).toBeCloseTo(30);
  });
});
