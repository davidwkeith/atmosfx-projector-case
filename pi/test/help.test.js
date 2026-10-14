import { readFile, readdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { helpSlugs } from "../public/nav.js";
import { parseMarkdown } from "../public/markdown.js";

const dir = new URL("../public/help/", import.meta.url);
const docsDir = new URL("../docs/", import.meta.url);
const githubSlug = (heading) => heading.toLowerCase().replace(/[^a-z0-9 -]/g, "").trim().replace(/ /g, "-");

describe("help pages", () => {
  it("has exactly one page for every screen and settings group", async () => {
    const files = (await readdir(dir)).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3));
    expect(files.sort()).toEqual(helpSlugs().sort());
  });

  it("each starts with a heading and links to a guide page and heading that exist", async () => {
    for (const slug of helpSlugs()) {
      const text = await readFile(new URL(`${slug}.md`, dir), "utf8");
      expect(parseMarkdown(text)[0], slug).toMatchObject({ type: "heading", level: 1 });
      const links = [...text.matchAll(/\]\(\.\.\/\.\.\/docs\/([a-z0-9-]+)\.md(?:#([a-z0-9-]+))?\)/g)];
      expect(links.length, `${slug} links to a guide`).toBeGreaterThan(0);
      for (const [, page, anchor] of links) {
        const doc = await readFile(new URL(`${page}.md`, docsDir), "utf8");
        if (anchor) {
          const anchors = new Set([...doc.matchAll(/^#{1,6} +(.+?) *$/gm)].map((m) => githubSlug(m[1])));
          expect(anchors.has(anchor), `${slug}: ${page}.md has no heading #${anchor}`).toBe(true);
        }
      }
    }
  });
});
