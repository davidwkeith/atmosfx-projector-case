import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createMediaStore } from "../src/media.js";
import {
  enabledCount,
  isMediaFile,
  isSafeName,
  moveEntry,
  parsePlaylist,
  serializePlaylist,
  validateEntries,
} from "../src/playlist-core.js";

describe("playlist format", () => {
  it("parses entries, skips comments and blank lines, keeps disabled entries", () => {
    const text = "#EXTM3U\n#EXTINF:12,Ghost\nghost.mp4\n\n#VIDEOFX-DISABLED:bats.mp4\r\nskull.mkv\n# a comment\n";
    expect(parsePlaylist(text)).toEqual([
      { file: "ghost.mp4", enabled: true },
      { file: "bats.mp4", enabled: false },
      { file: "skull.mkv", enabled: true },
    ]);
  });

  it("round-trips", () => {
    const entries = [
      { file: "a b.mp4", enabled: true },
      { file: "c.mp4", enabled: false },
    ];
    const text = serializePlaylist(entries);
    expect(text).toBe("#EXTM3U\na b.mp4\n#VIDEOFX-DISABLED:c.mp4\n");
    expect(parsePlaylist(text)).toEqual(entries);
  });

  it("writes and strips an absolute prefix when the playlist lives elsewhere", () => {
    const entries = [{ file: "a.mp4", enabled: false }];
    const text = serializePlaylist(entries, "/home/pi/media/");
    expect(text).toContain("#VIDEOFX-DISABLED:/home/pi/media/a.mp4");
    expect(parsePlaylist(text, "/home/pi/media/")).toEqual(entries);
  });

  it("counts enabled entries", () => {
    expect(enabledCount([{ enabled: true }, { enabled: false }, { enabled: true }])).toBe(2);
  });
});

describe("reorder", () => {
  const list = ["a", "b", "c", "d"].map((file) => ({ file, enabled: true }));
  const names = (l) => l.map((e) => e.file).join("");

  it("moves up, down, to the ends", () => {
    expect(names(moveEntry(list, 2, 1))).toBe("acbd");
    expect(names(moveEntry(list, 0, 1))).toBe("bacd");
    expect(names(moveEntry(list, 3, 0))).toBe("dabc");
    expect(names(moveEntry(list, 0, 3))).toBe("bcda");
  });

  it("clamps out-of-range targets and ignores bad sources", () => {
    expect(names(moveEntry(list, 0, -1))).toBe("abcd");
    expect(names(moveEntry(list, 3, 99))).toBe("abcd");
    expect(names(moveEntry(list, 9, 0))).toBe("abcd");
  });

  it("does not mutate its input", () => {
    moveEntry(list, 0, 3);
    expect(names(list)).toBe("abcd");
  });
});

describe("file names", () => {
  it.each(["ghost.mp4", "Ghost Ship 1080p.MOV", "scream.mp3", "a.b.c.mkv"])("accepts %s", (n) => {
    expect(isMediaFile(n)).toBe(true);
  });

  it.each([
    "../etc/passwd.mp4",
    "..",
    ".hidden.mp4",
    "sub/dir.mp4",
    "sub\\dir.mp4",
    "/etc/x.mp4",
    "nul\0.mp4",
    "line\nbreak.mp4",
    " padded.mp4",
    "",
    "x".repeat(201) + ".mp4",
  ])("rejects unsafe name %j", (n) => {
    expect(isSafeName(n)).toBe(false);
    expect(isMediaFile(n)).toBe(false);
  });

  it.each(["notes.txt", "run.sh", "index.html", "noext"])("rejects non-media %s", (n) => {
    expect(isMediaFile(n)).toBe(false);
  });

  it("validates playlist entries", () => {
    expect(() => validateEntries([{ file: "../x.mp4", enabled: true }])).toThrow(/entry 1/);
    expect(() => validateEntries([{ file: "x.mp4", enabled: "yes" }])).toThrow(/enabled/);
    expect(() => validateEntries("nope")).toThrow(/list/);
    expect(validateEntries([{ file: "x.mp4", enabled: true, extra: 1 }])).toEqual([{ file: "x.mp4", enabled: true }]);
  });
});

describe("media store", () => {
  let dir;
  let outside;
  let store;

  beforeEach(async () => {
    const base = await mkdtemp(join(tmpdir(), "videofx-test-"));
    dir = join(base, "media");
    outside = join(base, "secret.mp4");
    await mkdir(dir);
    await writeFile(outside, "do not touch");
    store = createMediaStore({ dir, playlist: join(dir, "playlist.m3u"), maxUploadBytes: 100 });
  });
  afterEach(async () => rm(join(dir, ".."), { recursive: true, force: true }));

  const upload = (name, data) => store.save(name, Readable.from([Buffer.from(data)]), data.length);

  it("reports a missing playlist, then an empty one, then none", async () => {
    expect(store.problem()).toMatch(/not found/);
    await store.writePlaylist([{ file: "a.mp4", enabled: false }]);
    expect(store.problem()).toMatch(/no enabled entries/);
    await store.writePlaylist([{ file: "a.mp4", enabled: true }]);
    expect(store.problem()).toBeUndefined();
  });

  it("writes and reads back the playlist in order", async () => {
    const entries = [
      { file: "b.mp4", enabled: true },
      { file: "a.mp4", enabled: false },
    ];
    await store.writePlaylist(entries);
    expect(await store.readPlaylist()).toEqual(entries);
    expect(await readFile(join(dir, "playlist.m3u"), "utf8")).toBe("#EXTM3U\nb.mp4\n#VIDEOFX-DISABLED:a.mp4\n");
  });

  it("uploads, lists and deletes media, dropping it from the playlist", async () => {
    await upload("ghost.mp4", "video");
    await upload("bats.mp4", "video");
    await store.writePlaylist([
      { file: "ghost.mp4", enabled: true },
      { file: "bats.mp4", enabled: true },
    ]);
    const { files } = await store.list();
    expect(files.map((f) => f.name)).toEqual(["bats.mp4", "ghost.mp4"]);
    await store.remove("ghost.mp4");
    expect(await store.readPlaylist()).toEqual([{ file: "bats.mp4", enabled: true }]);
    expect((await store.list()).files.map((f) => f.name)).toEqual(["bats.mp4"]);
  });

  it("an uploaded .m3u replaces the playlist after validation", async () => {
    await upload("mine.m3u", "#EXTM3U\nx.mp4\n");
    expect(await store.readPlaylist()).toEqual([{ file: "x.mp4", enabled: true }]);
    await expect(upload("evil.m3u", "../../etc/passwd.mp4\n")).rejects.toMatchObject({ status: 400 });
  });

  it("rejects wrong file types", async () => {
    await expect(upload("x.sh", "#!/bin/sh")).rejects.toMatchObject({ status: 415 });
    await expect(upload("index.html", "<p>")).rejects.toMatchObject({ status: 415 });
  });

  it("caps upload size and leaves no partial file behind", async () => {
    await expect(store.save("big.mp4", Readable.from([Buffer.alloc(60), Buffer.alloc(60)]), 0)).rejects.toMatchObject({
      status: 413,
    });
    await expect(upload("big.mp4", "x".repeat(101))).rejects.toMatchObject({ status: 413 });
    expect(await readdir(dir)).toEqual([]);
  });

  it.each(["../secret.mp4", "..%2Fsecret.mp4", "/etc/passwd.mp4", "sub/../../secret.mp4", ".hidden.mp4"])(
    "never touches paths outside the media folder: %s",
    async (name) => {
      expect(() => store.resolve(name)).toThrow();
      await expect(upload(name, "x")).rejects.toMatchObject({ status: 400 });
      await expect(store.remove(name)).rejects.toMatchObject({ status: 400 });
      expect(await readFile(outside, "utf8")).toBe("do not touch");
    },
  );

  it("does not list or delete through symlinks", async () => {
    await symlink(outside, join(dir, "link.mp4"));
    expect((await store.list()).files).toEqual([]);
    await expect(store.remove("link.mp4")).rejects.toMatchObject({ status: 400 });
    expect(await readFile(outside, "utf8")).toBe("do not touch");
  });
});
