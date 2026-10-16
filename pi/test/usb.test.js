import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMediaStore } from "../src/media.js";
import { createUsbImporter, findMedia } from "../src/usb.js";

describe("USB import", () => {
  let base, run, stick, dir, media;

  beforeEach(async () => {
    base = await mkdtemp(join(tmpdir(), "videofx-usb-"));
    run = join(base, "run");
    stick = join(base, "stick");
    dir = join(base, "media");
    await mkdir(run);
    await mkdir(dir);
    // An AtmosFX pack as unzipped on a Mac: nested folders, the same buffer in two of them, Finder junk.
    await mkdir(join(stick, "Pack - Pumpkin", "Solo"), { recursive: true });
    await mkdir(join(stick, "Pack - Pumpkin", "Media Player Buffer Files"), { recursive: true });
    await mkdir(join(stick, "Pack - Window", "Media Player Buffer Files"), { recursive: true });
    await mkdir(join(stick, ".Trashes"));
    await writeFile(join(stick, "Pack - Pumpkin", "Solo", "JOL2_Raven_Solo_Pumpkin_H.mp4"), "raven");
    await writeFile(join(stick, "Pack - Pumpkin", "Media Player Buffer Files", "JOL2_Buffer_H.mp4"), "buffer");
    await writeFile(join(stick, "Pack - Window", "Media Player Buffer Files", "JOL2_Buffer_H.mp4"), "buffer");
    await writeFile(join(stick, "Pack - Pumpkin", "Solo", "._JOL2_Raven_Solo_Pumpkin_H.mp4"), "junk");
    await writeFile(join(stick, ".DS_Store"), "junk");
    await writeFile(join(stick, "video.html"), "<p>");
    await writeFile(join(stick, ".Trashes", "deleted.mp4"), "gone");
    await writeFile(join(stick, "Song.mp3"), "la");
    media = createMediaStore({ dir, playlist: join(dir, "playlist.m3u"), autoPlaylist: true });
  });
  afterEach(async () => rm(base, { recursive: true, force: true }));

  const ready = (dev, mount = stick) => writeFile(join(run, `${dev}.ready`), mount);

  it("finds media at any depth, skipping hidden files, other files and repeated names", async () => {
    expect((await findMedia(stick)).map((f) => f.name)).toEqual(["JOL2_Buffer_H.mp4", "JOL2_Raven_Solo_Pumpkin_H.mp4", "Song.mp3"]);
  });

  it("copies a stick's media in and makes it the playlist, once per insert", async () => {
    await media.writePlaylist([{ file: "old.mp4", enabled: true }], { auto: false });
    const onImported = vi.fn();
    const usb = createUsbImporter({ dir: run, media, onImported, log: { info: () => {}, warn: () => {} } });
    expect(usb.status).toEqual({ state: "idle" });

    await ready("sda1");
    await usb.scan();
    expect(usb.status).toMatchObject({ state: "done", device: "sda1", present: true, copied: 3, skipped: 0, total: 3 });
    expect((await readdir(dir)).filter((n) => !n.endsWith(".m3u")).sort()).toEqual(["JOL2_Buffer_H.mp4", "JOL2_Raven_Solo_Pumpkin_H.mp4", "Song.mp3"]);
    expect((await media.readPlaylist()).map((e) => e.file)).toEqual(["JOL2_Buffer_H.mp4", "JOL2_Raven_Solo_Pumpkin_H.mp4", "Song.mp3"]);
    expect(onImported).toHaveBeenCalledTimes(1);

    await usb.scan(); // still plugged in: nothing new
    expect(onImported).toHaveBeenCalledTimes(1);

    await rm(join(run, "sda1.ready")); // pulled out
    await usb.scan();
    expect(usb.status).toMatchObject({ state: "done", present: false });

    await ready("sda1"); // plugged in again: files already here are skipped
    await usb.scan();
    expect(usb.status).toMatchObject({ state: "done", present: true, copied: 0, skipped: 3 });
    expect(onImported).toHaveBeenCalledTimes(2);
  });

  it("stops on a full card and leaves the playlist alone", async () => {
    media = createMediaStore({
      dir,
      playlist: join(dir, "playlist.m3u"),
      autoPlaylist: true,
      reserveBytes: 0,
      statfs: vi.fn().mockResolvedValueOnce({ bavail: 7, bsize: 1 }).mockResolvedValue({ bavail: 1, bsize: 1 }),
    });
    await media.writePlaylist([{ file: "old.mp4", enabled: true }], { auto: false });
    const onImported = vi.fn();
    const usb = createUsbImporter({ dir: run, media, onImported, log: { info: () => {}, warn: () => {} } });
    await ready("sdb1");
    await usb.scan();
    expect(usb.status).toMatchObject({ state: "error", device: "sdb1", copied: 1 });
    expect(usb.status.error).toMatch(/JOL2_Raven_Solo_Pumpkin_H\.mp4.*free space/);
    expect((await media.readPlaylist()).map((e) => e.file)).toEqual(["old.mp4"]);
    expect(onImported).not.toHaveBeenCalled();
  });

  it("reports a stick with no videos", async () => {
    const empty = join(base, "empty");
    await mkdir(empty);
    const usb = createUsbImporter({ dir: run, media, onImported: vi.fn(), log: { info: () => {}, warn: () => {} } });
    await ready("sdc1", empty);
    await usb.scan();
    expect(usb.status).toMatchObject({ state: "error", error: "No video or audio files on the USB stick." });
  });

  it("is idle when the mount folder does not exist (not a Pi)", async () => {
    const usb = createUsbImporter({ dir: join(base, "nope"), media, onImported: vi.fn() });
    await usb.scan();
    expect(usb.status).toEqual({ state: "idle" });
  });
});
