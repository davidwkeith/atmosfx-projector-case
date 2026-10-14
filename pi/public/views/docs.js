// The user guides (pi/docs/*.md), the same files GitHub shows. Links between them become routes.
import { el } from "../api.js";
import { renderMarkdown } from "../markdown.js";
import { docHref, isDocSlug } from "../nav.js";

export function mount(root, { sub } = {}) {
  const slug = isDocSlug(sub) ? sub : "index";
  const body = el("article", { className: "md docs" }, el("p", { className: "hint" }, "Loading…"));
  root.append(slug === "index" ? null : el("p", {}, el("a", { href: "#/docs" }, "← All guides")), body);
  let alive = true;
  (async () => {
    try {
      const res = await fetch(`/docs/${slug}.md`);
      if (!res.ok) throw new Error(res.statusText);
      const text = await res.text();
      if (alive) body.replaceChildren(renderMarkdown(text, document, { rewriteHref: (h) => docHref(h, "pi/docs") }));
    } catch {
      if (alive) body.replaceChildren(el("p", { className: "hint" }, "That guide is not available."));
    }
  })();
  return {
    update() {},
    unmount() {
      alive = false;
    },
    helpSlug: () => null,
  };
}
