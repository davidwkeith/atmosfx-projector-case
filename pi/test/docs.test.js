import { access, readFile, readdir } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parseMarkdown } from "../public/markdown.js";

const dir = new URL("../docs/", import.meta.url);
const githubSlug = (heading) => heading.toLowerCase().replace(/[^a-z0-9 -]/g, "").trim().replace(/ /g, "-");
const slugs = (await readdir(dir)).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3)).sort();
const read = (slug) => readFile(new URL(`${slug}.md`, dir), "utf8");

describe("user guides (pi/docs)", () => {
  it("are plain lower-case page names, with the contents page present", () => {
    expect(slugs).toContain("index");
    for (const s of slugs) expect(s).toMatch(/^[a-z][a-z0-9-]{0,40}$/);
  });

  it("each starts with one top-level heading and has no raw tables or fences the page can't show", async () => {
    for (const slug of slugs) {
      const text = await read(slug);
      const blocks = parseMarkdown(text);
      expect(blocks[0], slug).toMatchObject({ type: "heading", level: 1 });
      expect(blocks.filter((b) => b.type === "heading" && b.level === 1), `${slug}: one H1`).toHaveLength(1);
      expect(text, `${slug}: indented code fence`).not.toMatch(/^ +```/m);
      expect(text, `${slug}: HTML`).not.toMatch(/<\/?(div|span|img|br|details|table)\b/i);
      expect(text, `${slug}: in-page anchor link`).not.toMatch(/\]\(#/);
      expect(blocks.some((b) => b.type === "p" && b.children.some((n) => n.type === "text" && n.text.startsWith("|"))), `${slug}: table not parsed`).toBe(false);
    }
  });

  it("every link to another guide or repository file resolves, anchors included", async () => {
    for (const slug of slugs) {
      const text = await read(slug);
      for (const [, href] of text.matchAll(/\]\(([^)\s]+)\)/g)) {
        if (/^https?:/.test(href)) continue;
        const [path, anchor] = href.split("#");
        const target = new URL(path, dir);
        await access(target).catch(() => expect.fail(`${slug}: ${href} does not exist`));
        if (anchor && path.endsWith(".md")) {
          const other = await readFile(target, "utf8");
          const anchors = new Set([...other.matchAll(/^#{1,6} +(.+?) *$/gm)].map((m) => githubSlug(m[1])));
          expect(anchors.has(anchor), `${slug}: ${href}`).toBe(true);
        }
      }
    }
  });

  it("every guide is reachable from the contents page and the README", async () => {
    const index = await read("index");
    const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
    for (const slug of slugs.filter((s) => s !== "index")) {
      expect(index, `index lists ${slug}`).toContain(`(${slug}.md)`);
      expect(readme, `README lists ${slug}`).toContain(`(docs/${slug}.md)`);
    }
  });
});
