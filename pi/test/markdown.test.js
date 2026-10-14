import { describe, expect, it } from "vitest";
import { parseMarkdown } from "../public/markdown.js";

const text = (t) => ({ type: "text", text: t });

describe("parseMarkdown", () => {
  it("parses headings, paragraphs and joins wrapped lines", () => {
    expect(parseMarkdown("# One\n\nfirst line\nsecond line\n\n## Two")).toEqual([
      { type: "heading", level: 1, children: [text("One")] },
      { type: "p", children: [text("first line second line")] },
      { type: "heading", level: 2, children: [text("Two")] },
    ]);
  });

  it("parses inline code, bold, italic and links", () => {
    const [p] = parseMarkdown("Use `nec:0x40bf`, **never** *guess*, see [docs](https://example.com/a) or [here](#top).");
    expect(p.children).toEqual([
      text("Use "), { type: "code", text: "nec:0x40bf" }, text(", "),
      { type: "strong", children: [text("never")] }, text(" "),
      { type: "em", children: [text("guess")] }, text(", see "),
      { type: "link", href: "https://example.com/a", children: [text("docs")] }, text(" or "),
      { type: "link", href: "#top", children: [text("here")] }, text("."),
    ]);
  });

  it("parses bulleted and numbered lists, with continuation lines", () => {
    expect(parseMarkdown("- a\n- b\n  more\n\n1. x\n2. y")).toEqual([
      { type: "ul", items: [[text("a")], [text("b more")]] },
      { type: "ol", items: [[text("x")], [text("y")]] },
    ]);
  });

  it("keeps fenced code verbatim", () => {
    expect(parseMarkdown("```sh\nsudo videofx-update\n# not a heading\n```")).toEqual([{ type: "code", text: "sudo videofx-update\n# not a heading" }]);
  });

  it("treats raw HTML as text, never as markup", () => {
    const [p] = parseMarkdown('<img src=x onerror="alert(1)"> and <script>x</script>');
    expect(p.children.every((n) => n.type === "text")).toBe(true);
    expect(p.children.map((n) => n.text).join("")).toBe('<img src=x onerror="alert(1)"> and <script>x</script>');
  });

  it.each(["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,x", "vbscript:x", "file:///etc/passwd"])("renders a %s link as its label only", (href) => {
    const [p] = parseMarkdown(`[click](${href})`);
    expect(p.children).toEqual([text("click")]);
  });

  it("allows http(s), relative and anchor links only", () => {
    for (const href of ["http://a.b/c", "https://a.b/c", "/help/media.md", "./x", "../x", "#frag"]) {
      expect(parseMarkdown(`[t](${href})`)[0].children[0]).toMatchObject({ type: "link", href });
    }
  });

  it("survives malformed input without looping", () => {
    expect(parseMarkdown("```js foo\nstill text")).toBeInstanceOf(Array);
    expect(parseMarkdown("```\nnever closed")).toEqual([{ type: "code", text: "never closed" }]);
    expect(parseMarkdown("#### four hashes\n####")).toHaveLength(1);
    expect(parseMarkdown("**unterminated and `half")[0].children.map((n) => n.text).join("")).toBe("**unterminated and `half");
    expect(parseMarkdown("")).toEqual([]);
    const big = Array.from({ length: 10_000 }, (_, i) => `- item ${i}`).join("\n");
    expect(parseMarkdown(big)[0].items).toHaveLength(10_000);
  });

  it("normalises Windows line endings", () => {
    expect(parseMarkdown("# A\r\n\r\ntext\r\n")).toHaveLength(2);
  });
});
