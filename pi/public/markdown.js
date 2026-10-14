// The small Markdown subset the help pages use. Parsing produces plain data and rendering
// builds DOM nodes with textContent, so nothing in a help file can become markup.

const safeHref = (url) => /^https?:\/\//i.test(url) || /^(\/|#|\.\.?\/)/.test(url);

// A link target may hold one level of parentheses, so "javascript:alert(1)" is seen whole and refused.
const INLINE = /`([^`]+)`|\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*|\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))+)\)/g;

function inline(source) {
  const out = [];
  const push = (t) => t && out.push({ type: "text", text: t });
  const re = new RegExp(INLINE.source, "g");
  let last = 0;
  let m;
  while ((m = re.exec(source))) {
    push(source.slice(last, m.index));
    if (m[1] !== undefined) out.push({ type: "code", text: m[1] });
    else if (m[2] !== undefined) out.push({ type: "strong", children: inline(m[2]) });
    else if (m[3] !== undefined) out.push({ type: "em", children: inline(m[3]) });
    else if (safeHref(m[5])) out.push({ type: "link", href: m[5], children: inline(m[4]) });
    else push(m[4]); // unsafe scheme: keep the label, drop the link
    last = re.lastIndex;
  }
  push(source.slice(last));
  return out;
}

const LIST_ITEM = /^ *([-*]|\d+\.) +(.*)$/;

export function parseMarkdown(src) {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*$/.test(line)) {
      i++;
      continue;
    }
    if (/^```\w*\s*$/.test(line)) {
      const body = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) body.push(lines[i++]);
      i++; // the closing fence, or the end of the input
      blocks.push({ type: "code", text: body.join("\n") });
      continue;
    }
    const heading = /^(#{1,3}) +(.+?) *#*$/.exec(line);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1].length, children: inline(heading[2]) });
      i++;
      continue;
    }
    const first = LIST_ITEM.exec(line);
    if (first) {
      const ordered = /\d/.test(first[1]);
      const items = [];
      while (i < lines.length) {
        const m = LIST_ITEM.exec(lines[i]);
        if (!m || /\d/.test(m[1]) !== ordered) break;
        let item = m[2];
        i++;
        while (i < lines.length && /^ {2,}\S/.test(lines[i]) && !LIST_ITEM.test(lines[i])) item += " " + lines[i++].trim();
        items.push(inline(item));
      }
      blocks.push({ type: ordered ? "ol" : "ul", items });
      continue;
    }
    // A paragraph always takes its first line, so odd lines such as "```js foo" cannot stall the loop.
    const para = [lines[i++].trim()];
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^```/.test(lines[i]) && !/^#{1,3} /.test(lines[i]) && !LIST_ITEM.test(lines[i])) {
      para.push(lines[i++].trim());
    }
    blocks.push({ type: "p", children: inline(para.join(" ")) });
  }
  return blocks;
}

export function renderMarkdown(src, doc = document) {
  const frag = doc.createDocumentFragment();
  const make = (tag, ...kids) => {
    const node = doc.createElement(tag);
    node.append(...kids);
    return node;
  };
  const inl = (nodes) =>
    nodes.map((n) => {
      if (n.type === "text") return doc.createTextNode(n.text);
      if (n.type === "code") return make("code", n.text);
      if (n.type === "strong") return make("strong", ...inl(n.children));
      if (n.type === "em") return make("em", ...inl(n.children));
      const a = make("a", ...inl(n.children));
      a.href = n.href;
      if (/^https?:/i.test(n.href)) {
        a.target = "_blank";
        a.rel = "noopener noreferrer";
      }
      return a;
    });
  for (const b of parseMarkdown(src)) {
    if (b.type === "heading") frag.append(make(`h${b.level + 2}`, ...inl(b.children)));
    else if (b.type === "p") frag.append(make("p", ...inl(b.children)));
    else if (b.type === "code") frag.append(make("pre", make("code", b.text)));
    else frag.append(make(b.type, ...b.items.map((item) => make("li", ...inl(item)))));
  }
  return frag;
}
