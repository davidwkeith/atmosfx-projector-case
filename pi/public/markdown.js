// The small Markdown subset the help pages and docs use (headings, paragraphs, nested lists, tables, code). Parsing produces plain data and rendering
// builds DOM nodes with textContent, so nothing in a help file can become markup.

const safeHref = (url) => /^https?:\/\//i.test(url) || /^(\/|#|\.\.?\/)/.test(url) || /^[a-z0-9][a-z0-9._\/-]*\.md(#[\w-]*)?$/i.test(url);

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

const LIST_ITEM = /^( *)([-*]|\d+\.) +(.*)$/;
const isTableRow = (line) => /^\s*\|.*\|\s*$/.test(line);
const TABLE_RULE = /^\s*\|(\s*:?-+:?\s*\|)+\s*$/;
const cells = (line) => line.trim().slice(1, -1).split("|").map((c) => c.trim());

/** One list starting at lines[i], with deeper-indented items nested in the item above them. */
function parseList(lines, i) {
  const base = LIST_ITEM.exec(lines[i])[1].length;
  const ordered = /\d/.test(LIST_ITEM.exec(lines[i])[2]);
  const items = [];
  while (i < lines.length) {
    const m = LIST_ITEM.exec(lines[i]);
    if (!m || m[1].length !== base || /\d/.test(m[2]) !== ordered) break;
    let text = m[3];
    i++;
    while (i < lines.length && /^ {2,}\S/.test(lines[i]) && !LIST_ITEM.test(lines[i])) text += " " + lines[i++].trim();
    const item = inline(text);
    const deeper = i < lines.length ? LIST_ITEM.exec(lines[i]) : null;
    if (deeper && deeper[1].length > base) {
      const nested = parseList(lines, i);
      item.push(nested.block);
      i = nested.next;
    }
    items.push(item);
  }
  return { block: { type: ordered ? "ol" : "ul", items }, next: i };
}

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
    if (LIST_ITEM.test(line)) {
      const list = parseList(lines, i);
      blocks.push(list.block);
      i = list.next;
      continue;
    }
    if (isTableRow(line) && i + 1 < lines.length && TABLE_RULE.test(lines[i + 1])) {
      const head = cells(line);
      const rows = [];
      i += 2;
      while (i < lines.length && isTableRow(lines[i])) rows.push(cells(lines[i++]));
      blocks.push({ type: "table", head: head.map(inline), rows: rows.map((r) => head.map((_, c) => inline(r[c] ?? ""))) });
      continue;
    }
    // A paragraph always takes its first line, so odd lines such as "```js foo" cannot stall the loop.
    const para = [lines[i++].trim()];
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !/^```/.test(lines[i]) && !/^#{1,3} /.test(lines[i]) && !LIST_ITEM.test(lines[i]) && !isTableRow(lines[i])) {
      para.push(lines[i++].trim());
    }
    blocks.push({ type: "p", children: inline(para.join(" ")) });
  }
  return blocks;
}

/**
 * Render to DOM nodes. rewriteHref(href) may map a link target (docs links to routes);
 * it only ever sees hrefs that already passed safeHref.
 */
export function renderMarkdown(src, doc = document, { rewriteHref = (h) => h } = {}) {
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
      if (n.type === "ul" || n.type === "ol") return list(n);
      const a = make("a", ...inl(n.children));
      const href = rewriteHref(n.href);
      a.href = href;
      if (/^https?:/i.test(href)) {
        a.target = "_blank";
        a.rel = "noopener noreferrer";
      }
      return a;
    });
  const list = (b) => make(b.type, ...b.items.map((item) => make("li", ...inl(item))));
  for (const b of parseMarkdown(src)) {
    if (b.type === "heading") frag.append(make(`h${b.level + 2}`, ...inl(b.children)));
    else if (b.type === "p") frag.append(make("p", ...inl(b.children)));
    else if (b.type === "code") frag.append(make("pre", make("code", b.text)));
    else if (b.type === "table") {
      const row = (tag, cs) => make("tr", ...cs.map((c) => make(tag, ...inl(c))));
      frag.append(make("div", make("table", make("thead", row("th", b.head)), make("tbody", ...b.rows.map((r) => row("td", r))))));
      frag.lastChild.className = "table-wrap";
    } else frag.append(list(b));
  }
  return frag;
}
