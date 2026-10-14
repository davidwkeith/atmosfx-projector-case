import { readFile, readdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { helpSlugs } from "../public/nav.js";
import { parseMarkdown } from "../public/markdown.js";

const dir = new URL("../public/help/", import.meta.url);
const README = "https://github.com/davidwkeith/atmosfx-projector-case/blob/main/pi/README.md";
const githubSlug = (heading) => heading.toLowerCase().replace(/[^a-z0-9 -]/g, "").trim().replace(/ /g, "-");

describe("help pages", () => {
  it("has exactly one page for every screen and settings group", async () => {
    const files = (await readdir(dir)).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3));
    expect(files.sort()).toEqual(helpSlugs().sort());
  });

  it("each starts with a heading and links to a README heading that exists", async () => {
    const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
    const anchors = new Set([...readme.matchAll(/^#{1,6} +(.+?) *$/gm)].map((m) => githubSlug(m[1])));
    for (const slug of helpSlugs()) {
      const text = await readFile(new URL(`${slug}.md`, dir), "utf8");
      expect(parseMarkdown(text)[0], slug).toMatchObject({ type: "heading", level: 1 });
      const links = [...text.matchAll(new RegExp(`\\]\\(${README.replace(/[.]/g, "\\.")}#([a-z0-9-]+)\\)`, "g"))];
      expect(links.length, `${slug} links to the README`).toBeGreaterThan(0);
      for (const [, anchor] of links) expect(anchors.has(anchor), `${slug}: #${anchor} is not a README heading`).toBe(true);
    }
  });
});
