# VideoFX Web UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single scrolling VideoFX page with six grouped views, a schema-driven Settings area, (i) detail disclosures, a sticky Apply bar and a per-screen help sheet.

**Architecture:** Plain ES modules in `pi/public/` behind a hash router. Pure logic (navigation data, status notes, Markdown parsing, the pending-changes store, settings filtering) lives in DOM-free modules that vitest imports directly. Views are lazy-loaded modules that export `mount(root, params)` and return `{ update(state), unmount?(), helpSlug() }`. `web.js` serves `public/**` and `public/help/*.md` through a strict allow-list.

**Tech Stack:** Node 20 `node:http`, vitest 5, vanilla browser JS (no build step), CSP `default-src 'self'; img-src 'self' data:; style-src 'self'`.

**Spec:** `docs/superpowers/specs/2026-10-13-web-ui-redesign-design.md`

## Deviations from the spec (made while planning, Task 1 and Task 3 update the spec to match)

- **Help files live in `pi/public/help/`, not `pi/docs/help/`.** `pi/system/setup.sh` and `pi/image/build.sh` copy only `src/`, `public/`, `system/` and the package files. A `pi/docs/` folder would never reach the Pi.
- **A `state.js` module holds the shared store.** If the store lived in `app.js`, every view would import `app.js` while `app.js` imports every view.
- **Two more pure modules, `nav.js` and `notes.js`,** so group-to-view mapping and alert logic are testable in node.
- **(i) details are an inline disclosure under the label,** not a floating popover. It needs no positioning code and works on touch.
- **Search covers every non-custom schema row,** including the Scare, Motion sensor and Schedule groups that have moved to their own views, so no setting becomes unfindable.

## Global Constraints

- CSP stays `default-src 'self'; img-src 'self' data:; style-src 'self'; frame-ancestors 'none'`: no inline `<script>`, no `style=` attributes, no `setAttribute("style")`.
- No build step, no CDN, no framework, no new npm dependency.
- No change to any `/api/*` route or payload.
- Relative imports (`./api.js`, `../api.js`) in every module except views that need `/playlist-core.js`, which stays absolute because it lives in `src/`.
- Light and dark themes via `prefers-color-scheme`, as today.
- Touch targets at least 44 px. Layout works from 320 px wide.
- Tests bind sockets: run vitest with the sandbox disabled (`dangerouslyDisableSandbox: true`).
- Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Version bumps to 0.9.0 in `pi/package.json` and `pi/package-lock.json`. The `v0.9.0` git tag is the owner's release step, not part of this plan.

## Review Focus

1. **Odd static paths.** Encoded slashes, uppercase, doubled dots, `.md` outside `/help/`, a symlink out of `public/`, a 60-character slug: all 404, never a file read. (Task 1 tests.)
2. **A settings group added to `config.js` later with no nav entry or help file.** The suite fails instead of the UI silently dropping the group. (Tasks 3 and 12 tests.)
3. **Apply stops midway.** Earlier keys are saved and cleared, the failing key and the rest stay pending, and the toast names the failing setting. (Task 5 tests.)
4. **Hostile or malformed help Markdown.** An unterminated fence, ```` ```js foo ````, `<img onerror>`, `javascript:` links and a 10 000-line file neither loop forever nor reach the DOM as HTML. (Task 4 tests.)
5. **Edits survive the 3 s poll, navigation and the Simple/Advanced toggle.** A view never rebuilds rows under a focused input, and rebuilt rows show pending values. (Task 5 store tests; Tasks 7, 9, 10 manual checks.)

## File Structure

| Path | Action | Responsibility |
|---|---|---|
| `pi/src/web.js` | modify | Static allow-list (`staticFile`), help route |
| `pi/src/config.js` | modify | `advanced` flags, group `Fixed` renamed `Hardware` |
| `pi/public/nav.js` | create | Views, group-to-view map, hash parsing, help slugs (pure) |
| `pi/public/notes.js` | create | Alarms, system notes, nav badges from `/api/status` (pure) |
| `pi/public/markdown.js` | create | Markdown subset parser and DOM renderer |
| `pi/public/api.js` | create | `api`, `json`, `toast`, `run`, `el`, `bytes`, `icon`, `restartService` |
| `pi/public/state.js` | create | Shared store, refreshers, subscriptions, dirty registry |
| `pi/public/settings-form.js` | create | Pending-changes store (pure) and the row/Apply-bar renderers |
| `pi/public/app.js` | rewrite | Router, poll, chrome, help sheet |
| `pi/public/index.html`, `app.css` | rewrite/modify | Shell and styles |
| `pi/public/views/{dashboard,media,scares,schedule,settings,system}.js` | create | One module per view |
| `pi/public/help/*.md` | create | 15 help pages |
| `pi/tools/dev-web.mjs` | create | Fake-device dev server for manual checks |
| `pi/test/{nav,notes,markdown,settings-form,help}.test.js` | create | Unit tests |
| `pi/test/{web,config}.test.js` | modify | Static route and schema tests |
| `pi/README.md`, `CLAUDE.md`, `pi/package.json`, `pi/package-lock.json` | modify | Docs and version |

---

### Task 1: Static allow-list in web.js

**Files:**
- Modify: `pi/src/web.js` (imports, `STATIC` block lines 14-20, route lines 138-141)
- Modify: `docs/superpowers/specs/2026-10-13-web-ui-redesign-design.md`
- Test: `pi/test/web.test.js`

**Interfaces:**
- Produces: `export async function staticFile(path, root = PUBLIC)` returning `[absoluteFile, contentType]` or `null`. Later tasks add files under `pi/public/` and `pi/public/help/` and need no server edit.

- [ ] **Step 1: Write the failing tests**

In `pi/test/web.test.js`, change the import to `import { createWebServer, isAllowedHost, isLanAddress, staticFile } from "../src/web.js";`. Add `import { mkdir, symlink, writeFile } from "node:fs/promises";` next to the existing `node:fs/promises` import (merge into one import). Add inside `describe("web server", ...)`, after the `does not serve arbitrary files` test:

```js
  it("serves the allow-listed static files with the right types", async () => {
    for (const path of ["/", "/index.html", "/app.js", "/app.css", "/playlist-core.js"]) {
      expect((await call("GET", path)).status, path).toBe(200);
    }
    expect((await call("GET", "/app.css")).headers["content-type"]).toMatch(/^text\/css/);
    expect((await call("GET", "/app.js")).headers["content-type"]).toMatch(/^text\/javascript/);
  });

  it("refuses everything else under public/ and outside it", async () => {
    const paths = [
      "/.env", "/app.js.map", "/app.md", "/index.html.bak", "/package.json", "/src/web.js",
      "/help/Dashboard.md", "/HELP/dashboard.md", "/help/dashboard.js", "/help/nope.md", "/help/a.b.md",
      "/help/..%2fapp.md", "/views/..%2fapp.js", "/%2e%2e/package.json", `/help/${"a".repeat(60)}.md`,
    ];
    for (const path of paths) expect((await call("GET", path)).status, path).toBe(404);
  });

  it("asks for the password before serving static files", async () => {
    password = "boo";
    expect((await call("GET", "/app.js")).status).toBe(401);
  });
```

Add a new top-level `describe` after the `QR code` describe:

```js
describe("staticFile", () => {
  let root;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "videofx-static-"));
    await mkdir(join(root, "public", "help"), { recursive: true });
    await mkdir(join(root, "public", "views"), { recursive: true });
    await writeFile(join(root, "public", "index.html"), "<html>");
    await writeFile(join(root, "public", "views", "a-view.js"), "export {}");
    await writeFile(join(root, "public", "help", "dashboard.md"), "# Hi");
    await writeFile(join(root, "outside.js"), "secret");
    await symlink(join(root, "outside.js"), join(root, "public", "link.js"));
  });
  afterEach(() => rm(root, { recursive: true, force: true }));

  it("maps paths inside the root, including nested modules and help pages", async () => {
    const pub = join(root, "public");
    expect((await staticFile("/", pub))[1]).toMatch(/text\/html/);
    expect((await staticFile("/views/a-view.js", pub))[1]).toMatch(/text\/javascript/);
    expect((await staticFile("/help/dashboard.md", pub))[1]).toMatch(/text\/markdown/);
  });

  it("does not follow a symlink out of the root", async () => {
    expect(await staticFile("/link.js", join(root, "public"))).toBeNull();
  });

  it("returns null for a missing file", async () => {
    expect(await staticFile("/views/missing.js", join(root, "public"))).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run (sandbox disabled): `cd pi && npx vitest run test/web.test.js`
Expected: FAIL, `staticFile` is not exported (import yields undefined, so `staticFile is not a function`), and the new `/index.html` request returns 404.

- [ ] **Step 3: Implement**

In `pi/src/web.js` change the fs and path imports:

```js
import { readFile, realpath } from "node:fs/promises";
import { resolve, sep } from "node:path";
```

Replace the whole `STATIC` constant (and its comment) with:

```js
const PUBLIC = here("../public");
const TYPES = {
  js: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  html: "text/html; charset=utf-8",
  md: "text/markdown; charset=utf-8",
};

/**
 * The only files served from disk: public/**.{js,css,html}, public/help/<slug>.md and
 * the shared playlist module from src/. Names are lower-case letters, digits and hyphens
 * with exactly one dot, so "..", dotfiles and %-escapes never match. The real path must
 * also stay under the real public folder (a symlink cannot lead out). Media files are never served.
 * @returns {Promise<[string, string] | null>} [file, content type]
 */
export async function staticFile(path, root = PUBLIC) {
  if (path === "/") path = "/index.html";
  if (path === "/playlist-core.js") return [here("./playlist-core.js"), TYPES.js];
  const m = /^\/((?:[a-z][a-z0-9-]*\/)*[a-z][a-z0-9-]*)\.(js|css|html|md)$/.exec(path);
  if (!m) return null;
  const [, name, ext] = m;
  const isHelp = /^help\/[a-z][a-z0-9-]{0,40}$/.test(name);
  if ((ext === "md") !== isHelp) return null; // .md only under help/, and help/ only holds .md
  let real;
  let base;
  try {
    base = await realpath(root);
    real = await realpath(resolve(root, `${name}.${ext}`));
  } catch {
    return null;
  }
  return real.startsWith(base + sep) ? [real, TYPES[ext]] : null;
}
```

In `route()`, replace the `STATIC` block:

```js
    if (method === "GET" && STATIC[path]) {
      const [file, type] = STATIC[path];
      return send(res, 200, await readFile(file), type);
    }
```

with:

```js
    if (method === "GET") {
      const hit = await staticFile(path);
      if (hit) return send(res, 200, await readFile(hit[0]), hit[1]);
    }
```

Update the spec: in `docs/superpowers/specs/2026-10-13-web-ui-redesign-design.md` replace every `pi/docs/help/` with `pi/public/help/` and add after the "Source files" paragraph of section 3: `The folder is under public/ because setup.sh and the image build copy only src/, public/ and system/.`

- [ ] **Step 4: Run to verify pass**

Run (sandbox disabled): `cd pi && npx vitest run test/web.test.js`
Expected: PASS, including the older `does not serve arbitrary files` and `serves the page and the shared module` tests.

- [ ] **Step 5: Commit**

```bash
git add pi/src/web.js pi/test/web.test.js docs/superpowers/specs/2026-10-13-web-ui-redesign-design.md
git commit -m "Pi web: serve public/** and help pages through a strict allow-list

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Schema flags and the Hardware group

**Files:**
- Modify: `pi/src/config.js` (the `SETTINGS` array; `group: "Fixed"` lines 588-599)
- Test: `pi/test/config.test.js`

**Interfaces:**
- Produces: `advanced: true` on `mpvExtraArgs`, `cecDevice`, `relaySettleSec`, `audioCard`, `mixerControl`, `console`, `pirDebounceMs`, `tempHysteresisC`, `dmxMulticast`, `dmxHoldSec`, `webHosts`. Every former `Fixed` row now has `group: "Hardware"`. `describe()` already passes both through.

- [ ] **Step 1: Write the failing test**

In `pi/test/config.test.js` change line 2 to `import { SETTINGS, checkPins, deviceIds, deviceName, loadConfig, resolveSettings } from "../src/config.js";`, then append:

```js
describe("settings schema for the web page", () => {
  it("flags exactly the rows hidden in Simple mode", () => {
    const advanced = SETTINGS.filter((s) => s.advanced).map((s) => s.key).sort();
    expect(advanced).toEqual(
      ["audioCard", "cecDevice", "console", "dmxHoldSec", "dmxMulticast", "mixerControl", "mpvExtraArgs", "pirDebounceMs", "relaySettleSec", "tempHysteresisC", "webHosts"].sort(),
    );
  });

  it("calls the read-only group Hardware, never Fixed", () => {
    expect(SETTINGS.some((s) => s.group === "Fixed")).toBe(false);
    expect(SETTINGS.filter((s) => s.group === "Hardware").every((s) => s.apply === "fixed")).toBe(true);
    expect(SETTINGS.filter((s) => s.apply === "fixed").every((s) => s.group === "Hardware")).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run (sandbox disabled): `cd pi && npx vitest run test/config.test.js`
Expected: FAIL on both new tests.

- [ ] **Step 3: Implement**

Run from the repo root:

```bash
cd pi && sed -i '' 's/group: "Fixed"/group: "Hardware"/g' src/config.js && node -e '
const fs = require("fs");
let t = fs.readFileSync("src/config.js", "utf8");
for (const k of ["cecDevice","relaySettleSec","audioCard","mixerControl","console","pirDebounceMs","tempHysteresisC","dmxMulticast","dmxHoldSec","webHosts"]) {
  const re = new RegExp(`(\\n    key: "${k}",\\n)`);
  if (!re.test(t)) throw new Error("no entry for " + k);
  t = t.replace(re, `$1    advanced: true,\n`);
}
fs.writeFileSync("src/config.js", t);
' && git diff --stat src/config.js
```

Also edit the comment at the `// Fixed: ports need root...` line to read `// Hardware (file only): ports need root...`.

- [ ] **Step 4: Run to verify pass**

Run (sandbox disabled): `cd pi && npx vitest run`
Expected: all suites PASS. (`public/app.js` still says `Fixed`; it is deleted in Task 6.)

- [ ] **Step 5: Commit**

```bash
git add pi/src/config.js pi/test/config.test.js
git commit -m "Pi settings: mark advanced rows, rename Fixed group to Hardware

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Navigation data and status notes (pure modules)

**Files:**
- Create: `pi/public/nav.js`, `pi/public/notes.js`
- Test: `pi/test/nav.test.js`, `pi/test/notes.test.js`

**Interfaces:**
- Produces from `nav.js`: `VIEWS: {id,title,icon}[]`, `GROUP_VIEW: Record<string,string>`, `SETTINGS_GROUPS: string[]`, `groupSlug(group): string`, `groupsOf(view): string[]`, `helpSlugs(): string[]`, `parseHash(hash): {view, sub}`.
- Produces from `notes.js`: `alarmsOf(st): {level,text}[]`, `systemNotesOf(st): {id,text}[]` with ids `maintenance|data|power|password|clock`, `badgesOf(st): {dashboard:boolean, system:boolean}`.

- [ ] **Step 1: Write the failing tests**

`pi/test/nav.test.js`:

```js
import { describe, expect, it } from "vitest";
import { SETTINGS } from "../src/config.js";
import { GROUP_VIEW, SETTINGS_GROUPS, VIEWS, groupSlug, groupsOf, helpSlugs, parseHash } from "../public/nav.js";

describe("navigation data", () => {
  it("places every schema group on a view", () => {
    const missing = [...new Set(SETTINGS.map((s) => s.group))].filter((g) => !GROUP_VIEW[g]);
    expect(missing).toEqual([]);
  });

  it("only maps groups to views that exist", () => {
    const ids = VIEWS.map((v) => v.id);
    for (const view of Object.values(GROUP_VIEW)) expect(ids).toContain(view);
  });

  it("orders the Settings groups as designed", () => {
    expect(SETTINGS_GROUPS).toEqual(["Device", "Playback", "Projector", "Audio", "Display", "DMX", "Cooling", "Web page", "Advanced", "Hardware"]);
    expect(groupsOf("scares")).toEqual(["Scare", "Motion sensor"]);
    expect(groupsOf("schedule")).toEqual(["Schedule"]);
  });

  it("makes URL-safe, unique help slugs", () => {
    const slugs = helpSlugs();
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z][a-z0-9-]{0,40}$/);
    expect(groupSlug("Web page")).toBe("web-page");
    expect(slugs).toContain("web-page");
    expect(slugs).not.toContain("settings");
    expect(slugs).toHaveLength(15);
  });

  it.each([
    ["", { view: "dashboard", sub: "" }],
    ["#/media", { view: "media", sub: "" }],
    ["#/settings/web-page", { view: "settings", sub: "web-page" }],
    ["#/nonsense", { view: "dashboard", sub: "" }],
    ["#settings", { view: "settings", sub: "" }],
  ])("parses %j", (hash, expected) => expect(parseHash(hash)).toEqual(expected));
});
```

`pi/test/notes.test.js`:

```js
import { describe, expect, it } from "vitest";
import { alarmsOf, badgesOf, systemNotesOf } from "../public/notes.js";

const calm = { thermal: { enabled: true, alarms: [] }, storage: { dataMounted: true, state: "ok" }, web: { passwordSet: true }, clock: { synced: true }, version: { available: false } };

describe("alarmsOf", () => {
  it("lists thermal alarms only while protection is on, then the projector notice", () => {
    const st = { thermal: { enabled: true, alarms: [{ level: "critical", text: "hot" }] }, projector: { notice: "no CEC" } };
    expect(alarmsOf(st)).toEqual([{ level: "critical", text: "hot" }, { level: "warn", text: "no CEC" }]);
    expect(alarmsOf({ thermal: { enabled: false, alarms: [{ level: "warn", text: "x" }] } })).toEqual([]);
    expect(alarmsOf({})).toEqual([]);
  });
});

describe("systemNotesOf", () => {
  it("is empty for a healthy system", () => expect(systemNotesOf(calm)).toEqual([]));
  it("reports maintenance mode, an unmounted data partition, power-cut state, no password and an unsynced clock", () => {
    const ids = (st) => systemNotesOf({ ...calm, ...st }).map((n) => n.id);
    expect(ids({ storage: { maintenance: true, dataMounted: true, state: "ok" } })).toEqual(["maintenance"]);
    expect(ids({ storage: { dataMounted: false, state: "ok" } })).toEqual(["data"]);
    expect(ids({ storage: { dataMounted: true, state: "degraded" } })).toEqual(["power"]);
    expect(ids({ web: { passwordSet: false } })).toEqual(["password"]);
    expect(ids({ clock: { synced: false } })).toEqual(["clock"]);
  });
});

describe("badgesOf", () => {
  it("is quiet before the first status and for a healthy system", () => {
    expect(badgesOf(null)).toEqual({ dashboard: false, system: false });
    expect(badgesOf(calm)).toEqual({ dashboard: false, system: false });
  });
  it("marks Dashboard for alarms and notes, System for an update or a missing password", () => {
    expect(badgesOf({ ...calm, thermal: { enabled: true, alarms: [{ level: "warn", text: "x" }] } }).dashboard).toBe(true);
    expect(badgesOf({ ...calm, clock: { synced: false } }).dashboard).toBe(true);
    expect(badgesOf({ ...calm, version: { available: true } }).system).toBe(true);
    const noPw = badgesOf({ ...calm, web: { passwordSet: false } });
    expect(noPw).toEqual({ dashboard: false, system: true });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run (sandbox disabled): `cd pi && npx vitest run test/nav.test.js test/notes.test.js`
Expected: FAIL, cannot resolve `../public/nav.js` and `../public/notes.js`.

- [ ] **Step 3: Implement**

`pi/public/nav.js`:

```js
// Structure of the page, as data. No DOM here, so the tests can import it.

export const VIEWS = [
  { id: "dashboard", title: "Dashboard", icon: "dashboard" },
  { id: "media", title: "Media", icon: "media" },
  { id: "scares", title: "Scares", icon: "scares" },
  { id: "schedule", title: "Schedule", icon: "schedule" },
  { id: "settings", title: "Settings", icon: "settings" },
  { id: "system", title: "System", icon: "system" },
];

// Which view shows each schema group. Key order is the order of the Settings sub-navigation.
export const GROUP_VIEW = {
  Device: "settings",
  Playback: "settings",
  Projector: "settings",
  Audio: "settings",
  Display: "settings",
  DMX: "settings",
  Cooling: "settings",
  "Web page": "settings",
  Advanced: "settings",
  Hardware: "settings",
  Scare: "scares",
  "Motion sensor": "scares",
  Schedule: "schedule",
};

export const groupsOf = (view) => Object.keys(GROUP_VIEW).filter((g) => GROUP_VIEW[g] === view);
export const SETTINGS_GROUPS = groupsOf("settings");
export const groupSlug = (group) => group.toLowerCase().replace(/[^a-z0-9]+/g, "-");

/** One help page per view, except Settings, which has one per group. */
export const helpSlugs = () => [...VIEWS.filter((v) => v.id !== "settings").map((v) => v.id), ...SETTINGS_GROUPS.map(groupSlug)];

/** "#/settings/web-page" -> { view: "settings", sub: "web-page" }. Unknown views fall back to the dashboard. */
export function parseHash(hash = "") {
  const [name = "", sub = ""] = hash.replace(/^#\/?/, "").split("/");
  return { view: VIEWS.some((v) => v.id === name) ? name : "dashboard", sub };
}
```

`pi/public/notes.js`:

```js
// What the status endpoint says is wrong or noteworthy. Pure functions of /api/status.

export function alarmsOf(st) {
  return [
    ...(st.thermal?.enabled ? (st.thermal.alarms ?? []) : []),
    ...(st.projector?.notice ? [{ level: "warn", text: st.projector.notice }] : []),
  ];
}

export function systemNotesOf(st) {
  const notes = [];
  const sto = st.storage;
  if (sto && (sto.maintenance || !sto.dataMounted)) {
    notes.push(
      sto.maintenance
        ? {
            id: "maintenance",
            text: `Maintenance mode: the system is writable${sto.rebootPending ? " (protection returns after a reboot)" : ""}. A power cut now can damage the SD card. Run "sudo videofx-maint off" when done.`,
          }
        : { id: "data", text: "The data partition is not mounted: settings and videos may not survive a restart." },
    );
  }
  if (sto?.state && sto.state !== "ok") notes.push({ id: "power", text: `Power-cut protection: ${sto.state}.` });
  if (st.web && !st.web.passwordSet) {
    notes.push({ id: "password", text: "No password: anyone on this network can control VideoFX and download its pairing keys. Set one in Settings > Web page." });
  }
  if (st.clock && !st.clock.synced) {
    notes.push({ id: "clock", text: "Time not synced yet: the schedule and sunset wait until the Pi has the correct time from the network." });
  }
  return notes;
}

/** Red dots on the navigation. A missing password belongs to System, not the Dashboard. */
export function badgesOf(st) {
  if (!st) return { dashboard: false, system: false };
  return {
    dashboard: alarmsOf(st).length > 0 || systemNotesOf(st).some((n) => n.id !== "password"),
    system: !!st.version?.available || (!!st.web && !st.web.passwordSet),
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run (sandbox disabled): `cd pi && npx vitest run test/nav.test.js test/notes.test.js`
Expected: PASS. (The `toHaveLength(15)` check needs the 5 view slugs plus the 10 settings groups.)

- [ ] **Step 5: Commit**

```bash
git add pi/public/nav.js pi/public/notes.js pi/test/nav.test.js pi/test/notes.test.js
git commit -m "Pi UI: navigation data and status notes as pure modules

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Markdown subset

**Files:**
- Create: `pi/public/markdown.js`
- Test: `pi/test/markdown.test.js`

**Interfaces:**
- Produces: `parseMarkdown(src: string): Block[]` where `Block` is `{type:"heading",level,children}`, `{type:"p",children}`, `{type:"ul"|"ol",items:Inline[][]}` or `{type:"code",text}`; `Inline` is `{type:"text",text}`, `{type:"code",text}`, `{type:"strong"|"em",children}` or `{type:"link",href,children}`. `renderMarkdown(src, doc = document): DocumentFragment`.

- [ ] **Step 1: Write the failing tests**

```js
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
```

- [ ] **Step 2: Run to verify failure**

Run (sandbox disabled): `cd pi && npx vitest run test/markdown.test.js`
Expected: FAIL, cannot resolve `../public/markdown.js`.

- [ ] **Step 3: Implement**

`pi/public/markdown.js`:

```js
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
```

- [ ] **Step 4: Run to verify pass**

Run (sandbox disabled): `cd pi && npx vitest run test/markdown.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add pi/public/markdown.js pi/test/markdown.test.js
git commit -m "Pi UI: Markdown subset for the help pages

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Pending-changes store and settings filtering (pure part of settings-form.js)

**Files:**
- Create: `pi/public/settings-form.js` (store and `visibleItems` only; Task 7 adds the DOM parts below it)
- Test: `pi/test/settings-form.test.js`

**Interfaces:**
- Produces: `canon(value): string` (key-order-insensitive stringify); `createPending()` returning `{ set(key, value, current), reset(key), undo(key), has(key), get(key), count, keys(), clear(), restartNeeded(items), subscribe(fn): unsubscribe, apply(send) }` where `send(method: "PUT"|"DELETE", key, value)` is async; `apply` resolves to the list of applied keys and rejects with the first error having `err.key` set; `visibleItems(items, { advanced, query })`.
- Consumes: nothing.

- [ ] **Step 1: Write the failing tests**

```js
import { describe, expect, it, vi } from "vitest";
import { canon, createPending, visibleItems } from "../public/settings-form.js";

describe("canon", () => {
  it("ignores object key order but not array order", () => {
    expect(canon({ a: 1, b: { c: 2, d: 3 } })).toBe(canon({ b: { d: 3, c: 2 }, a: 1 }));
    expect(canon([1, 2])).not.toBe(canon([2, 1]));
    expect(canon("1")).not.toBe(canon(1));
  });
});

describe("createPending", () => {
  it("records an edit, and drops it again when the value goes back to the current one", () => {
    const p = createPending();
    p.set("volume", 40, 30);
    expect(p.has("volume")).toBe(true);
    expect(p.get("volume")).toEqual({ value: 40 });
    p.set("volume", 30, 30);
    expect(p.count).toBe(0);
  });

  it("compares objects regardless of key order", () => {
    const p = createPending();
    p.set("schedule", { enabled: true, days: { mon: { on: "20:00", off: "23:00" } } }, { days: { mon: { off: "23:00", on: "20:00" } }, enabled: true });
    expect(p.count).toBe(0);
  });

  it("overwrites an edit and keeps insertion order", () => {
    const p = createPending();
    p.set("a", 1, 0);
    p.set("b", 1, 0);
    p.set("a", 2, 0);
    expect(p.keys()).toEqual(["a", "b"]);
    expect(p.get("a").value).toBe(2);
  });

  it("marks a reset, and undo removes any edit", () => {
    const p = createPending();
    p.reset("name");
    expect(p.get("name")).toEqual({ reset: true });
    p.undo("name");
    expect(p.count).toBe(0);
  });

  it("tells when a pending key needs a restart", () => {
    const p = createPending();
    const items = [{ key: "httpPort", apply: "restart" }, { key: "volume", apply: "live" }];
    p.set("volume", 1, 0);
    expect(p.restartNeeded(items)).toBe(false);
    p.set("httpPort", 8080, 80);
    expect(p.restartNeeded(items)).toBe(true);
  });

  it("notifies subscribers on every change and stops after unsubscribe", () => {
    const p = createPending();
    const fn = vi.fn();
    const off = p.subscribe(fn);
    p.set("a", 1, 0);
    p.reset("b");
    p.undo("b");
    p.clear();
    expect(fn).toHaveBeenCalledTimes(4);
    off();
    p.set("a", 1, 0);
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it("applies in order, using DELETE for resets", async () => {
    const p = createPending();
    p.set("a", 1, 0);
    p.reset("b");
    p.set("c", "x", "");
    const sent = [];
    const done = await p.apply(async (method, key, value) => void sent.push([method, key, value]));
    expect(sent).toEqual([["PUT", "a", 1], ["DELETE", "b", undefined], ["PUT", "c", "x"]]);
    expect(done).toEqual(["a", "b", "c"]);
    expect(p.count).toBe(0);
  });

  it("stops at the first error: earlier edits are cleared, the failing one and the rest stay pending", async () => {
    const p = createPending();
    p.set("a", 1, 0);
    p.set("b", 2, 0);
    p.set("c", 3, 0);
    const send = vi.fn(async (_m, key) => {
      if (key === "b") throw new Error("must be a whole number");
    });
    await expect(p.apply(send)).rejects.toMatchObject({ message: "must be a whole number", key: "b" });
    expect(send).toHaveBeenCalledTimes(2);
    expect(p.keys()).toEqual(["b", "c"]);
  });
});

describe("visibleItems", () => {
  const items = [
    { key: "name", label: "Device name", help: "Shown in Matter controllers", group: "Device" },
    { key: "mpvExtraArgs", label: "Extra mpv options", help: "decoding flags", group: "Advanced", advanced: true },
    { key: "irPowerCode", label: "IR power code", group: "Projector", custom: true },
    { key: "pirPin", label: "PIR GPIO", help: "pin 11", group: "Motion sensor" },
  ];
  it("hides advanced rows in Simple mode and never lists custom rows", () => {
    expect(visibleItems(items, { advanced: false, query: "" }).map((s) => s.key)).toEqual(["name", "pirPin"]);
    expect(visibleItems(items, { advanced: true, query: "" }).map((s) => s.key)).toEqual(["name", "mpvExtraArgs", "pirPin"]);
  });
  it("searches label and help, ignoring case and the Simple filter", () => {
    expect(visibleItems(items, { advanced: false, query: "MPV" }).map((s) => s.key)).toEqual(["mpvExtraArgs"]);
    expect(visibleItems(items, { advanced: false, query: "matter" }).map((s) => s.key)).toEqual(["name"]);
    expect(visibleItems(items, { advanced: false, query: "  " }).map((s) => s.key)).toEqual(["name", "pirPin"]);
    expect(visibleItems(items, { advanced: false, query: "ir power" })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run (sandbox disabled): `cd pi && npx vitest run test/settings-form.test.js`
Expected: FAIL, cannot resolve `../public/settings-form.js`.

- [ ] **Step 3: Implement**

`pi/public/settings-form.js`:

```js
// Edits waiting for "Apply", shared by every view that shows settings.
// This top part has no DOM access so the tests can import it.

/** JSON with sorted object keys, so equal values compare equal whatever order the server used. */
export function canon(value) {
  if (Array.isArray(value)) return `[${value.map(canon).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canon(value[k])}`)
      .join(",")}}`;
  }
  return String(JSON.stringify(value));
}

export function createPending() {
  const edits = new Map(); // key -> { value } | { reset: true }
  const subs = new Set();
  const emit = () => subs.forEach((fn) => fn());
  return {
    set(key, value, current) {
      if (canon(value) === canon(current)) edits.delete(key);
      else edits.set(key, { value });
      emit();
    },
    reset(key) {
      edits.set(key, { reset: true });
      emit();
    },
    undo(key) {
      edits.delete(key);
      emit();
    },
    has: (key) => edits.has(key),
    get: (key) => edits.get(key),
    get count() {
      return edits.size;
    },
    keys: () => [...edits.keys()],
    clear() {
      edits.clear();
      emit();
    },
    restartNeeded: (items) => [...edits.keys()].some((k) => items.find((i) => i.key === k)?.apply === "restart"),
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    /** Send edits one by one. The first failure stops it; that edit and the rest stay pending. */
    async apply(send) {
      const done = [];
      for (const [key, edit] of [...edits]) {
        try {
          await send(edit.reset ? "DELETE" : "PUT", key, edit.value);
        } catch (err) {
          err.key = key;
          emit();
          throw err;
        }
        edits.delete(key);
        done.push(key);
      }
      emit();
      return done;
    },
  };
}

/** Rows to list. Custom rows have their own editors. A search ignores the Simple/Advanced choice. */
export function visibleItems(items, { advanced, query }) {
  const q = query.trim().toLowerCase();
  return items.filter((s) => {
    if (s.custom) return false;
    if (q) return `${s.label} ${s.help ?? ""}`.toLowerCase().includes(q);
    return advanced || !s.advanced;
  });
}
```

- [ ] **Step 4: Run to verify pass**

Run (sandbox disabled): `cd pi && npx vitest run test/settings-form.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add pi/public/settings-form.js pi/test/settings-form.test.js
git commit -m "Pi UI: pending-changes store and settings filtering

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: App shell, helpers, help sheet and the Dashboard

This is the first runnable slice. It deletes the old `app.js`. Until Task 11 the other five screens show "Could not load this screen"; that is expected on this branch. All unit suites stay green.

**Files:**
- Create: `pi/public/api.js`, `pi/public/state.js`, `pi/public/views/dashboard.js`, `pi/tools/dev-web.mjs`
- Rewrite: `pi/public/index.html`, `pi/public/app.js`
- Modify: `pi/public/app.css`

**Interfaces:**
- Produces from `api.js`: `WRITE`, `api(path, options?)`, `json(method, body)`, `toast(message)`, `run(fn)`, `el(tag, props?, ...children)` (`props.attrs` sets attributes; `null`, `undefined` and `false` children are skipped), `bytes(n)`, `editing(root)`, `icon(name)` for `dashboard|media|scares|schedule|settings|system|help|info|close`, `restartService()`.
- Produces from `state.js`: `state {status, media, settings}`, `subscribe(fn): unsubscribe`, `refreshStatus()`, `refreshMedia()`, `refreshSettings()`, `setting(key)`, `onDirtyCheck(fn)`, `isDirty()`, `remount()`.
- View contract (every view module): `export function mount(root: HTMLElement, params: {sub: string}): { update(state), unmount?(), helpSlug(): string }`. `update` is called after every store change and may run before data has loaded, so each slice (`state.status`, `state.media`, `state.settings`) must be null-checked.

- [ ] **Step 1: Create `pi/public/api.js`**

```js
// Small helpers shared by every module. Nothing here touches the DOM at import time.

export const WRITE = { "x-videofx": "1" }; // required on every write (CSRF guard)

export async function api(path, options = {}) {
  const res = await fetch(path, { ...options, headers: { ...WRITE, ...options.headers } });
  const body = res.headers.get("content-type")?.includes("json") ? await res.json() : null;
  if (!res.ok) throw new Error(body?.error ?? `${res.status} ${res.statusText}`);
  return body;
}

export const json = (method, body) => ({ method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

let toastTimer;
export function toast(message) {
  const node = document.getElementById("toast");
  node.textContent = message;
  node.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (node.hidden = true), 4000);
}

export async function run(fn) {
  try {
    await fn();
  } catch (err) {
    toast(err.message);
  }
}

/** el("div", { className: "x", attrs: { "aria-label": "y" } }, child, "text"). Empty children are skipped. */
export function el(tag, props = {}, ...children) {
  const { attrs, ...rest } = props;
  const node = Object.assign(document.createElement(tag), rest);
  for (const [name, value] of Object.entries(attrs ?? {})) node.setAttribute(name, value);
  node.append(...children.filter((c) => c !== null && c !== undefined && c !== false));
  return node;
}

/** True while a form control inside root has focus. Views skip rebuilding then (the router focuses <main> itself, which does not count). */
export function editing(root) {
  const a = document.activeElement;
  return !!a && a !== root && root.contains(a) && a.matches("input, select, textarea");
}

export function bytes(n) {
  if (n == null) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  while (n >= 1024 && i < units.length - 1) (n /= 1024), i++;
  return `${n.toFixed(i ? 1 : 0)} ${units[i]}`;
}

const ICONS = {
  dashboard: ["M3 3h7v9H3z", "M14 3h7v5h-7z", "M14 12h7v9h-7z", "M3 16h7v5H3z"],
  media: ["M4 4h16v16H4z", "M4 9h16", "M4 15h16", "M9 4v16", "M15 4v16"],
  scares: ["M13 2 3 14h9l-1 8 10-12h-9z"],
  schedule: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M12 7v5l3 2"],
  settings: ["M4 21v-7", "M4 10V3", "M12 21v-9", "M12 8V3", "M20 21v-5", "M20 12V3", "M1 14h6", "M9 8h6", "M17 16h6"],
  system: ["M5 5h14v14H5z", "M9 9h6v6H9z", "M9 2v3", "M15 2v3", "M9 19v3", "M15 19v3", "M2 9h3", "M2 15h3", "M19 9h3", "M19 15h3"],
  help: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7", "M12 17h.01"],
  info: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M12 11v5", "M12 8h.01"],
  close: ["M6 6l12 12", "M18 6 6 18"],
};

export function icon(name) {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  for (const [k, v] of Object.entries({ viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", class: "icon-svg" })) {
    svg.setAttribute(k, v);
  }
  for (const d of ICONS[name] ?? []) {
    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", d);
    svg.append(path);
  }
  return svg;
}

export async function restartService() {
  if (!confirm("Restart the service? Playback stops for a few seconds.")) return;
  await api("/api/restart", { method: "POST" });
  toast("Restarting… this page reconnects by itself.");
}
```

- [ ] **Step 2: Create `pi/public/state.js`**

```js
import { api } from "./api.js";

// One object for what the Pi last told us. Views read it in update() and never keep their own copy of it.
export const state = { status: null, media: null, settings: null };

const subs = new Set();
export const subscribe = (fn) => (subs.add(fn), () => subs.delete(fn));
function emit() {
  for (const fn of subs) {
    try {
      fn(state);
    } catch (err) {
      console.error(err); // one broken view must not stop the others updating
    }
  }
}

export async function refreshStatus() {
  state.status = await api("/api/status");
  emit();
}
export async function refreshMedia() {
  state.media = await api("/api/media");
  emit();
}
export async function refreshSettings() {
  state.settings = await api("/api/settings");
  emit();
}

export const setting = (key) => state.settings?.settings.find((s) => s.key === key)?.value;

// Anything holding unsaved edits registers here; the page warns before it is closed.
const dirtyChecks = new Set();
export const onDirtyCheck = (fn) => dirtyChecks.add(fn);
export const isDirty = () => [...dirtyChecks].some((fn) => fn());

/** Ask the router to rebuild the current view (the Simple/Advanced switch, Discard). */
export const remount = () => window.dispatchEvent(new Event("videofx:remount"));
```

- [ ] **Step 3: Replace `pi/public/index.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="dark light">
  <title>VideoFX</title>
  <link rel="stylesheet" href="/app.css">
  <script type="module" src="/app.js"></script>
</head>
<body>
  <nav id="nav" aria-label="Sections"></nav>

  <div id="content"><div class="wrap">
    <header class="top">
      <h1 id="name">VideoFX</h1>
      <span id="state" class="pill">…</span>
    </header>

    <div id="dmx-strip" class="banner dmx" role="status" hidden>
      <p><b>DMX in control.</b> Power and volume are locked until the signal stops.</p>
    </div>
    <div id="restart-strip" class="banner" role="status" hidden>
      <p>Some changes need a service restart.</p>
      <button id="restart-now" type="button" class="primary">Restart service</button>
    </div>

    <div class="titlebar">
      <h2 id="view-title"></h2>
      <button id="help-btn" type="button" class="icon" aria-label="Help for this screen" title="Help"></button>
    </div>

    <main id="view" tabindex="-1"></main>
  </div></div>

  <div id="apply-bar" class="apply" role="region" aria-label="Unsaved changes" hidden></div>

  <dialog id="help" aria-label="Help">
    <div class="sheet">
      <div class="sheet-head">
        <h2>Help</h2>
        <button id="help-close" type="button" class="icon" aria-label="Close help"></button>
      </div>
      <div id="help-body" class="md"></div>
    </div>
  </dialog>

  <p id="toast" role="status" aria-live="polite" hidden></p>
</body>
</html>
```

- [ ] **Step 4: Edit `pi/public/app.css`**

Keep every existing rule except these four, which you replace or delete:

1. In the `body { ... }` rule delete the line `padding: 0 16px 48px;`.
2. Delete the rules `header, main { max-width: 640px; margin: 0 auto; }` and the `header { display: flex; ... }` rule.
3. Delete the `footer#version { ... }` line (keep the `a.button` line above it).
4. Delete the `h2 { font-size: 1.1rem; margin: 0 0 8px; }` rule.

Then append:

```css
/* --- shell */
:root { --nav-w: 220px; --nav-h: 60px; }
.warn, .banner p, .hint { overflow-wrap: anywhere; }

#nav {
  position: fixed; z-index: 20; left: 0; right: 0; bottom: 0;
  display: flex; background: var(--card); border-top: 1px solid var(--line);
  padding-bottom: env(safe-area-inset-bottom);
}
#nav a {
  flex: 1; min-height: var(--nav-h); position: relative;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
  color: var(--muted); text-decoration: none; font-size: 0.72rem;
}
#nav a[aria-current] { color: var(--accent); }
.icon-svg { width: 22px; height: 22px; flex: none; }
.dot { position: absolute; top: 8px; left: calc(50% + 8px); width: 9px; height: 9px; border-radius: 50%; background: var(--danger); }

.wrap { max-width: 760px; margin: 0 auto; }
#content { padding: 0 16px calc(var(--nav-h) + 96px + env(safe-area-inset-bottom)); }

header.top { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 20px 0 4px; }
h1 { font-size: 1.5rem; margin: 0; }
.titlebar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 12px 0 0; }
.titlebar h2 { font-size: 1.25rem; margin: 0; }
h3 { font-size: 1.05rem; margin: 0 0 8px; }
main:focus { outline: none; }

@media (min-width: 900px) {
  #nav { top: 0; bottom: 0; right: auto; width: var(--nav-w); flex-direction: column; border-top: 0; border-right: 1px solid var(--line); padding-top: 72px; }
  #nav a { flex: none; min-height: 0; flex-direction: row; justify-content: flex-start; gap: 12px; padding: 12px 20px; font-size: 1rem; }
  .dot { top: 50%; left: auto; right: 16px; transform: translateY(-50%); }
  #content { margin-left: var(--nav-w); padding: 0 32px 96px; }
}

/* --- apply bar */
.apply {
  position: fixed; z-index: 15; left: 8px; right: 8px; bottom: calc(var(--nav-h) + 8px + env(safe-area-inset-bottom));
  display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
  background: var(--card); border: 1px solid var(--accent); border-radius: var(--radius); padding: 8px 12px;
  box-shadow: 0 4px 16px rgb(0 0 0 / 0.35);
}
.apply .apply-text { flex: 1; min-width: 8em; }
@media (min-width: 900px) { .apply { left: calc(var(--nav-w) + 32px); right: 32px; bottom: 16px; max-width: 760px; margin: 0 auto; } }

/* --- dashboard */
.tiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin: 16px 0; }
.tile { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius); padding: 12px; min-width: 0; }
.tile h3 { font-size: 0.85rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; margin: 0 0 4px; }
.tile-value { font-size: 1.15rem; font-weight: 600; margin: 0; overflow-wrap: anywhere; }
.tile-sub { margin: 4px 0 0; }

/* --- settings */
.toolbar { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; margin: 12px 0; }
.toolbar input[type="search"] { flex: 1 1 12em; font: inherit; min-height: 44px; padding: 0 10px; border-radius: 10px; border: 1px solid var(--line); background: var(--bg); color: var(--text); }
.subnav { display: flex; gap: 4px; overflow-x: auto; scrollbar-width: none; margin: 0 0 12px; padding-bottom: 4px; }
.subnav a { white-space: nowrap; padding: 8px 12px; border-radius: 999px; border: 1px solid var(--line); color: var(--muted); text-decoration: none; }
.subnav a[aria-current] { color: var(--accent-text); background: var(--accent); border-color: var(--accent); }
.setting-head { display: flex; align-items: center; gap: 8px; }
.setting-head .title { margin: 0; }
.setting .hint { margin: 2px 0 6px; }
.setting.pending { border-left: 3px solid var(--accent); padding-left: 10px; }
.setting.bool .control { display: flex; }
.control input[type="text"], .control input[type="number"], .control select {
  font: inherit; min-height: 44px; padding: 0 10px; border-radius: 10px; border: 1px solid var(--line);
  background: var(--bg); color: var(--text); width: 100%; max-width: 28em;
}
.control input[type="checkbox"] { width: 22px; height: 22px; accent-color: var(--accent); }
button.info { min-width: 44px; min-height: 44px; padding: 0; border: 0; color: var(--muted); display: inline-flex; align-items: center; justify-content: center; }
button.info[aria-expanded="true"] { color: var(--accent); }
.pop { background: var(--bg); border: 1px solid var(--line); border-radius: 10px; padding: 8px 12px; margin-top: 6px; font-size: 0.9rem; }
.pop dl { display: grid; grid-template-columns: max-content 1fr; gap: 2px 12px; margin: 0 0 8px; }
.pop dt { color: var(--muted); }
.pop dd { margin: 0; overflow-wrap: anywhere; }
.reset-note { color: var(--accent); font-size: 0.9rem; margin: 4px 0 0; }
input[type="search"] { -webkit-appearance: none; appearance: none; }

/* --- help sheet */
dialog#help { border: 0; padding: 0; margin: 0 0 0 auto; width: min(100vw, 440px); height: 100dvh; max-height: 100dvh; background: var(--card); color: var(--text); border-left: 1px solid var(--line); }
dialog#help::backdrop { background: rgb(0 0 0 / 0.5); }
.sheet { padding: 0 16px 32px; }
.sheet-head { display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; background: var(--card); padding: 12px 0; }
.sheet-head h2 { margin: 0; font-size: 1.2rem; }
.md h3 { font-size: 1.1rem; margin: 16px 0 4px; }
.md h4, .md h5 { font-size: 1rem; margin: 12px 0 4px; }
.md p, .md li { margin: 4px 0 8px; }
.md pre { background: var(--bg); border: 1px solid var(--line); border-radius: 8px; padding: 8px 12px; overflow-x: auto; }
.md code { font-size: 0.95rem; letter-spacing: 0; }
.md a { color: var(--accent); }
```

- [ ] **Step 5: Create `pi/public/views/dashboard.js`**

```js
import { api, el, json, run, toast } from "../api.js";
import { alarmsOf, systemNotesOf } from "../notes.js";
import { refreshStatus, state } from "../state.js";

function tile(title) {
  const value = el("p", { className: "tile-value" }, "–");
  const sub = el("p", { className: "hint tile-sub" });
  return { box: el("div", { className: "tile" }, el("h3", {}, title), value, sub), value, sub };
}

const when = (ms) => new Date(ms).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" });

export function mount(root) {
  const dmx = el("div", { className: "banner dmx", role: "status", hidden: true }, el("p", {}, el("b", {}, "DMX in control."), " Power, mode, clip, volume and dimmer follow the lighting desk. Matter, this page and the schedule take over again a few seconds after the DMX signal stops."));
  const alarms = el("div", { className: "banner alarm", role: "alert", hidden: true });
  const notes = el("div", { className: "banner alarm", role: "status", hidden: true });

  const problem = el("p", { className: "warn", hidden: true });
  const power = el("button", { type: "button", className: "big", disabled: true }, "…");
  const scareNow = el("button", { type: "button", className: "big scare", hidden: true }, "Scare now");
  const scareState = el("p", { className: "hint", hidden: true });

  const slider = el("input", { type: "range", min: 0, max: 100, step: 1, value: 30, disabled: true, attrs: { "aria-label": "Speaker volume" } });
  const out = el("output", {}, "…");
  const mute = el("button", { type: "button", disabled: true }, "Mute");
  const volume = el("div", { className: "volume" }, slider, out, mute);

  const projector = tile("Projector");
  const schedule = tile("Schedule");
  const network = tile("Network");
  const heat = tile("Pi temperature");

  root.append(
    dmx, alarms, notes,
    el("section", {}, el("h3", {}, "Playback"), problem, power, scareNow, scareState),
    el("section", {}, el("h3", {}, "Speaker volume"), volume),
    el("div", { className: "tiles" }, projector.box, schedule.box, network.box, heat.box),
  );

  async function setVolume(change) {
    await api("/api/volume", json("POST", change));
    await refreshStatus();
  }
  power.addEventListener("click", () =>
    run(async () => {
      power.disabled = true;
      try {
        await api("/api/power", json("POST", { on: !state.status.on }));
        await refreshStatus();
      } finally {
        power.disabled = !!state.status?.dmx?.inControl;
      }
    }),
  );
  slider.addEventListener("input", () => (out.textContent = `${slider.value}%`));
  slider.addEventListener("change", () => run(() => setVolume({ level: Number(slider.value) })));
  mute.addEventListener("click", () => run(() => setVolume({ muted: !state.status.volume.muted })));
  scareNow.addEventListener("click", () =>
    run(async () => {
      const r = await api("/api/scare", json("POST", {}));
      toast(r.result === "fired" ? "Scare!" : r.result === "queued" ? "Queued after the current scare." : `Not now: ${r.reason}.`);
      await refreshStatus();
    }),
  );

  return {
    helpSlug: () => "dashboard",
    update({ status: st }) {
      if (!st) return;
      const locked = !!st.dmx?.inControl;
      dmx.hidden = !locked;

      const al = alarmsOf(st);
      alarms.hidden = al.length === 0;
      alarms.replaceChildren(...al.map((a) => el("p", {}, `${a.level === "critical" ? "⚠ " : ""}${a.text}`)));
      const ns = systemNotesOf(st);
      notes.hidden = ns.length === 0;
      notes.replaceChildren(...ns.map((n) => el("p", {}, n.text)));

      power.disabled = locked;
      power.textContent = st.on ? "Stop" : "Play";
      power.classList.toggle("stop", st.on);
      problem.hidden = !st.problem || st.on;
      problem.textContent = st.problem ? `Can't play: ${st.problem}.` : "";

      const p = st.player ?? {};
      scareNow.hidden = !(st.on && p.mode === "scare");
      scareNow.disabled = locked;
      const seams = p.lastSeamMs?.toScareMs != null ? ` · last seams ${p.lastSeamMs.toScareMs} / ${p.lastSeamMs.toBufferMs ?? "–"} ms` : "";
      scareState.hidden = p.mode !== "scare";
      scareState.textContent =
        (p.scareActive ? "Scare playing…" : p.cooldownLeftMs > 0 ? `Cooling down: ${Math.ceil(p.cooldownLeftMs / 1000)} s${seams}` : `Ready${seams}`) +
        (st.quiet?.active ? ` · quiet hours (volume ≤ ${st.quiet.cap}%${st.quiet.noScares ? ", no scares" : ""})` : "");

      const v = st.volume;
      if (v) {
        if (document.activeElement !== slider) slider.value = v.level;
        slider.disabled = locked;
        out.textContent = `${v.level}%`;
        mute.disabled = locked;
        mute.textContent = v.muted ? "Unmute" : "Mute";
        mute.setAttribute("aria-pressed", String(v.muted));
        volume.classList.toggle("muted", v.muted);
      }

      const pr = st.projector ?? {};
      projector.value.textContent = pr.power ?? "unknown";
      projector.sub.textContent = `Mode: ${pr.mode ?? "?"}${pr.mode === "cec" ? ` · CEC ${pr.cec === "supported" ? "supported" : pr.cec === "no-response" ? "no response (using hdmi-off)" : "not checked yet"}` : ""}`;

      const next = st.schedule?.next;
      if (st.schedule?.waitingForClock) {
        schedule.value.textContent = "Waiting for time";
        schedule.sub.textContent = "The schedule starts once the Pi has the network time.";
      } else if (!st.schedule?.enabled) {
        schedule.value.textContent = "Off";
        schedule.sub.textContent = "Not using the schedule.";
      } else {
        schedule.value.textContent = next ? `${next.on ? "On" : "Off"} ${when(next.at)}` : "Nothing this week";
        schedule.sub.textContent = next ? `${next.label}${locked ? " · paused while DMX is in control" : ""}` : "Schedule on, but nothing is scheduled in the next week.";
      }

      const n = st.network ?? {};
      const w = n.wifi ?? {};
      network.value.textContent = n.ethernet ? "Ethernet" : w.connected ? `Wi-Fi ${w.quality}%` : "Offline";
      network.sub.textContent = w.connected ? `"${w.ssid}" ${w.band}, ${w.signalDbm} dBm, ${w.verdict}` : "Wi-Fi not connected";

      const t = st.thermal;
      if (!t?.enabled) {
        heat.value.textContent = "Not watched";
        heat.sub.textContent = "Turn on over-temperature protection in Settings > Cooling.";
      } else {
        heat.value.textContent = t.temp == null ? "–" : `${t.temp.toFixed(1)} °C`;
        heat.sub.textContent = t.tripped ? `Stopped: ${t.tripped}` : "OK";
      }
    },
  };
}
```

- [ ] **Step 6: Rewrite `pi/public/app.js`**

```js
import { el, icon, restartService, run } from "./api.js";
import { renderMarkdown } from "./markdown.js";
import { VIEWS, parseHash } from "./nav.js";
import { badgesOf } from "./notes.js";
import { isDirty, refreshMedia, refreshSettings, refreshStatus, state, subscribe } from "./state.js";

const $ = (id) => document.getElementById(id);

const LOADERS = {
  dashboard: () => import("./views/dashboard.js"),
  media: () => import("./views/media.js"),
  scares: () => import("./views/scares.js"),
  schedule: () => import("./views/schedule.js"),
  settings: () => import("./views/settings.js"),
  system: () => import("./views/system.js"),
};

// --- navigation

$("nav").replaceChildren(
  ...VIEWS.map((v) => el("a", { href: `#/${v.id}`, id: `nav-${v.id}` }, icon(v.icon), el("span", {}, v.title), el("i", { className: "dot", hidden: true }))),
);
$("help-btn").append(icon("help"));
$("help-close").append(icon("close"));

let current = null;
let token = 0; // a slow import must not replace a view the user has already left

async function show() {
  const mine = ++token;
  const { view, sub } = parseHash(location.hash);
  let mod;
  try {
    mod = await LOADERS[view]();
  } catch (err) {
    if (mine === token) $("view").replaceChildren(el("p", { className: "warn" }, `Could not load this screen: ${err.message}`));
    return;
  }
  if (mine !== token) return;
  current?.unmount?.();
  $("view").replaceChildren();
  current = mod.mount($("view"), { sub });
  $("view-title").textContent = VIEWS.find((v) => v.id === view).title;
  for (const a of $("nav").children) {
    if (a.id === `nav-${view}`) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
  $("help").close();
  renderChrome(state);
  current.update(state);
  window.scrollTo(0, 0);
  $("view").focus({ preventScroll: true });
}

// --- header, banners, badges

function renderChrome({ status: st }) {
  if (!st) return;
  document.title = st.name;
  $("name").textContent = st.name;
  const pill = $("state");
  pill.textContent = st.playing ? "Playing" : st.on ? "Starting…" : "Off";
  pill.classList.toggle("on", st.on);
  const badges = badgesOf(st);
  for (const id of Object.keys(badges)) $(`nav-${id}`).querySelector(".dot").hidden = !badges[id];
  $("dmx-strip").hidden = !(st.dmx?.inControl && parseHash(location.hash).view !== "dashboard");
  $("restart-strip").hidden = !st.restartNeeded?.length;
}

// --- help sheet

async function openHelp() {
  const slug = current?.helpSlug() ?? "dashboard";
  const body = $("help-body");
  body.replaceChildren(el("p", { className: "hint" }, "Loading…"));
  $("help").showModal();
  try {
    const res = await fetch(`/help/${slug}.md`);
    if (!res.ok) throw new Error(res.statusText);
    body.replaceChildren(renderMarkdown(await res.text()));
  } catch {
    body.replaceChildren(el("p", { className: "hint" }, "Help not available."));
  }
}
$("help-btn").addEventListener("click", openHelp);
$("help-close").addEventListener("click", () => $("help").close());
$("help").addEventListener("click", (e) => e.target === $("help") && $("help").close()); // the backdrop is the dialog itself
$("restart-now").addEventListener("click", () => run(restartService));

// --- wire up

subscribe((s) => {
  renderChrome(s);
  current?.update(s);
});
window.addEventListener("hashchange", show);
window.addEventListener("videofx:remount", show);
window.addEventListener("beforeunload", (e) => isDirty() && e.preventDefault());

// Poll status while the page is visible; it changes from Apple Home too.
async function poll() {
  await run(refreshStatus);
  setTimeout(() => {
    if (document.visibilityState === "visible") poll();
    else document.addEventListener("visibilitychange", poll, { once: true });
  }, 3000);
}
run(refreshMedia);
run(refreshSettings);
show();
poll();
```


- [ ] **Step 7: Create `pi/tools/dev-web.mjs`**

```js
// A fake device for looking at the web page: `node tools/dev-web.mjs`, then open http://localhost:8080/.
// Real settings and media code on a temp folder; status, power and the rest are stubs.
// DEV_DMX=1 shows DMX in control, DEV_ALARM=1 shows a thermal alarm, DEV_PASSWORD=1 sets a password (user: any, password: "pumpkin").
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMediaStore } from "../src/media.js";
import { Settings, hashPassword } from "../src/settings.js";
import { createWebServer } from "../src/web.js";

const dir = mkdtempSync(join(tmpdir(), "videofx-dev-"));
for (const n of ["ghost-buffer.mp4", "ghost-scare-1.mp4", "ghost-scare-2.mp4", "zombie.mp4"]) writeFileSync(join(dir, n), "x".repeat(2048));
writeFileSync(join(dir, "playlist.m3u"), "zombie.mp4\nghost-buffer.mp4\n");
const media = createMediaStore({ dir, playlist: join(dir, "playlist.m3u"), maxUploadBytes: 500 * 1024 * 1024 });
if (process.env.DEV_PASSWORD) writeFileSync(join(dir, "settings.json"), JSON.stringify({ password: hashPassword("pumpkin") }));
const settings = new Settings({ dir, env: {}, log: console });

let on = false;
let volume = { level: 30, muted: false };
const status = () => ({
  name: "VideoFX-DEV",
  on,
  playing: on,
  problem: media.problem?.() ?? undefined,
  volume,
  restartNeeded: settings.restartNeeded,
  matter: { commissioned: false, manualPairingCode: "34970112332", fabrics: 0 },
  thermal: { enabled: true, temp: 48.2, tripped: null, alarms: process.env.DEV_ALARM ? [{ level: "warn", text: "Pi: 71.0 °C (warning at 70 °C)" }] : [] },
  projector: { mode: "cec", power: on ? "on" : "standby", cec: "supported", notice: null },
  dmx: { enabled: !!process.env.DEV_DMX, inControl: !!process.env.DEV_DMX, live: !!process.env.DEV_DMX, values: [255, 0, 1, 0, 200, 0, 255, 0], sources: [{ name: "Desk", ip: "192.168.1.9", priority: 100, packetsPerSecond: 44 }], rejected: 0 },
  player: { mode: "scare", scareActive: false, cooldownLeftMs: 0, lastSeamMs: { toScareMs: 38, toBufferMs: 41 } },
  schedule: { enabled: true, next: { on: !on, at: Date.now() + 3_600_000, label: "Mon sunset" } },
  network: { ethernet: false, wifi: { connected: true, ssid: "Home", band: "5 GHz", signalDbm: -52, quality: 80, verdict: "good" } },
  storage: { maintenance: false, dataMounted: true, state: "ok" },
  web: { passwordSet: settings.passwordSet },
  clock: { synced: true },
  quiet: { active: false },
  version: { version: "0.9.0", sha: "dev", available: false, latest: null, checkedAt: Date.now() },
});

const server = createWebServer({
  media,
  settings,
  auth: settings,
  hostNames: () => ["localhost"],
  status,
  setPower: async (v) => void (on = v),
  setVolume: async (v) => (volume = { level: v.level ?? volume.level, muted: v.muted ?? volume.muted }),
  playlistChanged: () => {},
  pairingSvg: () => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#fff"/><rect x="1" y="1" width="3" height="3"/><rect x="6" y="1" width="3" height="3"/><rect x="1" y="6" width="3" height="3"/></svg>',
  resetMatter: async () => {},
  restart: async () => {},
  scare: () => ({ result: "fired" }),
  irLearn: async () => "nec:0x40bf",
  irTest: async () => {},
  backup: async () => ({ format: "videofx-backup", device: "videofx-dev", createdAt: new Date().toISOString(), settings: {}, matter: {} }),
  restore: async () => ({ restored: true }),
  log: console,
});
server.listen(8080, "127.0.0.1", () => console.log("http://localhost:8080/  (files in " + dir + ")"));
```

If `Settings` does not export `hashPassword` from `settings.js` in your checkout, it does: `pi/src/settings.js` line 14 `export function hashPassword`. If `media.problem` is not a function the `?.()` yields `undefined`, which is fine.

- [ ] **Step 8: Delete the old script and run the suites**

The old 698-line `app.js` was overwritten in Step 6, so there is nothing else to delete. Run (sandbox disabled): `cd pi && npx vitest run`
Expected: all suites PASS (the web test checks `<title>VideoFX</title>`).

- [ ] **Step 9: Check it in the browser**

Run (sandbox disabled, background): `cd pi && node tools/dev-web.mjs`. Open `http://localhost:8080/` in the built-in browser. After any later file change, reload the page itself: navigating to a different `#/...` address does not reload the scripts. Check each of these and fix anything that is off:

1. Dashboard shows the Playback card, volume, and four tiles. Play toggles to Stop and the pill turns green. The mute button flips.
2. At 375 px wide the nav is a bottom bar with six labelled icons and no horizontal scroll; at 1000 px it is a left sidebar.
3. The `?` button opens the help sheet. It shows "Help not available." for now (help pages come in Task 12). Esc and a click on the backdrop close it.
4. Navigating to `#/media` shows "Could not load this screen" (expected until Task 8). With no password set, the System tab shows a dot and the Dashboard shows the "No password" banner.
5. Restart with `DEV_DMX=1`: the DMX banner shows and Play, volume and mute are disabled. Restart with `DEV_ALARM=1`: the alarm banner and Dashboard dot show.
6. Light and dark both readable (`resize_window` with `colorScheme`).
7. No errors in the console (`read_console_messages`, errors only).

Stop the server afterwards.

- [ ] **Step 10: Commit**

```bash
git add pi/public pi/tools/dev-web.mjs
git commit -m "Pi UI: router shell, help sheet and Dashboard; dev server with a fake device

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Settings rows, Apply bar and the Settings view

**Files:**
- Modify: `pi/public/settings-form.js` (add imports at the top, append the DOM half below `visibleItems`)
- Modify: `pi/public/app.js` (mount the Apply bar)
- Create: `pi/public/views/settings.js`

**Interfaces:**
- Consumes: `createPending`, `visibleItems` (Task 5); `el`, `icon`, `api`, `json`, `run`, `toast` (Task 6); `state`, `setting`, `refreshSettings`, `refreshStatus`, `remount`, `onDirtyCheck` (Task 6); `SETTINGS_GROUPS`, `groupSlug` (Task 3).
- Produces from `settings-form.js`: `pending` (the shared store), `effective(key)` (pending edit else saved value), `advancedShown()`, `advancedToggle(): HTMLLabelElement`, `settingRow(s)`, `fixedRow(s)`, `passwordRow(s)`, `pinTable(items)`, `rowOf(s)` (picks the right row type), `mountApplyBar(bar: HTMLElement)`.
- Produces: `views/settings.js` `mount(root, {sub})`.

- [ ] **Step 1: Add the DOM half of `settings-form.js`**

At the very top of the file add:

```js
import { api, el, icon, json, run, toast } from "./api.js";
import { onDirtyCheck, refreshSettings, refreshStatus, remount, setting, state } from "./state.js";
```

Append at the bottom:

```js
// --- DOM half

export const pending = createPending();
onDirtyCheck(() => pending.count > 0);

/** What the person would see right now: their pending edit, else the saved value. */
export const effective = (key) => pending.get(key)?.value ?? setting(key);

const ADV_KEY = "videofx.advanced";
export function advancedShown() {
  try {
    return localStorage.getItem(ADV_KEY) === "1";
  } catch {
    return false; // private window or blocked storage: Simple mode
  }
}
export function advancedToggle() {
  const box = el("input", { type: "checkbox", checked: advancedShown() });
  box.addEventListener("change", () => {
    try {
      localStorage.setItem(ADV_KEY, box.checked ? "1" : "0");
    } catch {
      // not remembered, still applied below
    }
    remount();
  });
  return el("label", { className: "check" }, box, "Show advanced settings");
}

const APPLY = { live: "At once", play: "On the next play", restart: "After a service restart", fixed: "Edit /etc/default/videofx over SSH, then restart" };
const SOURCE = { web: "Set here", file: "From /etc/default/videofx", default: "Built-in default" };
const display = (v) => (v === null || v === undefined ? "" : Array.isArray(v) ? v.join(" ") : v);
const shown = (v) => (display(v) === "" ? "(empty)" : String(display(v)));

function details(s, extra = []) {
  const dl = el(
    "dl",
    {},
    el("dt", {}, "Source"), el("dd", {}, SOURCE[s.source] ?? s.source),
    ...(s.default !== undefined && !s.secret ? [el("dt", {}, "Default"), el("dd", {}, shown(s.default))] : []),
    el("dt", {}, "Applies"), el("dd", {}, APPLY[s.apply] ?? ""),
    ...(s.env ? [el("dt", {}, "Variable"), el("dd", {}, s.env)] : []),
  );
  return el("div", { className: "pop", id: `pop-${s.key}`, hidden: true }, dl, ...extra);
}

function infoButton(s, pop) {
  const button = el(
    "button",
    { type: "button", className: "info", title: "Details", attrs: { "aria-expanded": "false", "aria-controls": pop.id, "aria-label": `Details for ${s.label}` } },
    icon("info"),
  );
  button.addEventListener("click", () => {
    pop.hidden = !pop.hidden;
    button.setAttribute("aria-expanded", String(!pop.hidden));
  });
  return button;
}

/** One editable setting. Edits go to the pending store; nothing is sent until Apply. */
export function settingRow(s) {
  const id = `set-${s.key}`;
  const current = display(s.value);
  const edit = pending.get(s.key);
  const start = edit && !edit.reset ? edit.value : current;
  let input;
  if (s.options) {
    input = el("select", { id }, ...s.options.map((o) => el("option", { value: o, selected: o === start }, o)));
  } else if (typeof s.value === "boolean") {
    input = el("input", { id, type: "checkbox", checked: !!start });
  } else if (typeof s.value === "number") {
    input = el("input", { id, type: "number", step: "any", inputMode: "numeric", value: String(start) });
  } else {
    input = el("input", { id, type: "text", value: String(start), autocomplete: "off", spellcheck: false });
  }
  const read = () => (input.type === "checkbox" ? input.checked : input.type === "number" ? (input.value === "" ? "" : Number(input.value)) : input.value);

  const undo = el("button", { type: "button" }, "Undo");
  const note = el("p", { className: "reset-note", hidden: true }, "Goes back to the file value or the default when you apply. ", undo);
  const resetButton = el("button", { type: "button" }, "Reset to file value or default");
  const pop = details(s, s.source === "web" ? [resetButton] : []);
  const row = el("div", { className: `setting${typeof s.value === "boolean" ? " bool" : ""}`, id: `row-${s.key}` });

  const sync = () => {
    const e = pending.get(s.key);
    row.classList.toggle("pending", !!e);
    input.disabled = !!e?.reset;
    note.hidden = !e?.reset;
    resetButton.disabled = !!e?.reset;
  };
  const edited = () => {
    pending.set(s.key, read(), current);
    sync();
  };
  input.addEventListener("input", edited);
  input.addEventListener("change", edited);
  resetButton.addEventListener("click", () => (pending.reset(s.key), sync()));
  undo.addEventListener("click", () => (pending.undo(s.key), sync()));

  row.append(
    el("div", { className: "setting-head" }, el("label", { className: "title", htmlFor: id }, s.label), infoButton(s, pop)),
    s.help ? el("p", { className: "hint" }, s.help) : null,
    el("div", { className: "control" }, input),
    note,
    pop,
  );
  sync();
  return row;
}

export function fixedRow(s) {
  return el(
    "div",
    { className: "setting" },
    el("div", { className: "setting-head" }, el("span", { className: "title" }, s.label)),
    el("div", { className: "fixed-value" }, shown(s.value)),
    s.apply === "detected"
      ? el("div", { className: "meta" }, "Detected from /proc/device-tree/model")
      : el("div", { className: "meta" }, el("span", { className: `tag ${s.source}` }, SOURCE[s.source] ?? s.source), s.env ? `${s.env} in /etc/default/videofx` : null),
  );
}

// The password has its own rules (current password, confirmation), so it acts at once instead of waiting for Apply.
async function changeNow(method, s, body) {
  const res = await api(`/api/settings/${s.key}`, json(method, body));
  toast(res.note ?? (method === "DELETE" ? `${s.label} reset.` : `${s.label} saved.`));
  await Promise.all([refreshSettings(), refreshStatus()]);
}

export function passwordRow(s) {
  const current = el("input", { type: "password", autocomplete: "current-password", placeholder: "Current password" });
  const next = el("input", { type: "password", autocomplete: "new-password", placeholder: s.isSet ? "New password" : "Password (6+ characters)" });
  const save = el("button", { type: "button", className: "primary" }, s.isSet ? "Change" : "Set password");
  save.addEventListener("click", () =>
    run(async () => {
      await changeNow("PUT", s, { value: next.value, currentPassword: current.value || undefined });
      toast("Password saved. Your browser will ask for it.");
    }),
  );
  const remove = el("button", { type: "button", className: "danger", disabled: !s.isSet }, "Remove password");
  remove.addEventListener("click", () =>
    run(async () => {
      if (!confirm("Remove the password? Anyone on your network can then use this page.")) return;
      await changeNow("PUT", s, { value: "", currentPassword: current.value, confirm: true });
    }),
  );
  const reset = el("button", { type: "button", disabled: s.source !== "web" }, "Reset");
  reset.addEventListener("click", () =>
    run(async () => {
      if (!confirm("Go back to the password in /etc/default/videofx? If there is none, the page will have no password.")) return;
      await changeNow("DELETE", s, { currentPassword: current.value || undefined, confirm: true });
    }),
  );
  const pop = details(s);
  return el(
    "div",
    { className: "setting" },
    el("div", { className: "setting-head" }, el("span", { className: "title" }, `${s.label}: ${s.isSet ? "set" : "not set"}`), infoButton(s, pop)),
    s.help ? el("p", { className: "hint" }, s.help) : null,
    el("div", { className: "row" }, ...(s.isSet ? [current] : []), next),
    el("div", { className: "actions" }, save, remove, reset),
    pop,
  );
}

export function pinTable(items) {
  const v = Object.fromEntries(items.map((s) => [s.key, s.value]));
  const rows = [
    ["DigiAMP+ (Raspberry Pi)", "GPIO 2, 3 (I2C), 4, 18-21 (I2S), 22 (mute) · reserved"],
    ["PIR sensor in", `GPIO${v.pirPin}`],
    ["Projector relay out", `GPIO${v.relayPin}${v.relayActiveLow ? " (active-low)" : ""}`],
    ["IR LED out", `GPIO${v.irTxPin} (${v.irTxDriver})`],
    ["IR receiver in", `GPIO${v.irRxPin}`],
  ];
  return el("div", { className: "setting" }, el("span", { className: "title" }, "GPIO pins"), el("table", { className: "kv" }, ...rows.map(([k, x]) => el("tr", {}, el("th", {}, k), el("td", {}, x)))));
}

export const rowOf = (s) => (s.key === "password" ? passwordRow(s) : s.apply === "fixed" ? fixedRow(s) : settingRow(s));

async function applyAll() {
  const items = state.settings?.settings ?? [];
  const label = (key) => items.find((s) => s.key === key)?.label ?? key;
  const notes = [];
  try {
    const done = await pending.apply(async (method, key, value) => {
      const res = await api(`/api/settings/${key}`, json(method, method === "PUT" ? { value } : {}));
      if (res.note) notes.push(res.note);
    });
    toast(notes.length ? notes.join(" ") : done.length === 1 ? `${label(done[0])} saved.` : `${done.length} changes applied.`);
  } catch (err) {
    // The server's message already starts with the setting's label; add it only when it does not.
    toast(err.message.startsWith(label(err.key)) ? err.message : `${label(err.key)}: ${err.message}`);
    // the failing edit and everything after it stay pending
  } finally {
    await Promise.all([refreshSettings(), refreshStatus()]);
  }
}

/** The sticky "N changes · Discard · Apply" bar. Shown whenever the store has edits. */
export function mountApplyBar(bar) {
  const text = el("span", { className: "apply-text" });
  const discard = el("button", { type: "button" }, "Discard");
  const go = el("button", { type: "button", className: "primary" }, "Apply");
  bar.replaceChildren(text, discard, go);
  const render = () => {
    bar.hidden = pending.count === 0;
    const restart = pending.restartNeeded(state.settings?.settings ?? []);
    text.textContent = `${pending.count} change${pending.count === 1 ? "" : "s"}${restart ? " · needs a service restart" : ""}`;
  };
  pending.subscribe(render);
  render();
  discard.addEventListener("click", () => {
    pending.clear();
    remount();
  });
  go.addEventListener("click", async () => {
    go.disabled = discard.disabled = true;
    await run(applyAll);
    go.disabled = discard.disabled = false;
  });
}
```

- [ ] **Step 2: Mount the bar in `app.js`**

Add `import { mountApplyBar } from "./settings-form.js";` to the imports and, directly after the line `$("help-close").append(icon("close"));`, add `mountApplyBar($("apply-bar"));`.

- [ ] **Step 3: Create `pi/public/views/settings.js`**

```js
import { api, editing, el, json, run, toast } from "../api.js";
import { SETTINGS_GROUPS, groupSlug } from "../nav.js";
import { advancedShown, advancedToggle, effective, fixedRow, pending, pinTable, rowOf, visibleItems } from "../settings-form.js";
import { setting, state } from "../state.js";

function renderDmx(box, dmx) {
  if (!dmx.enabled) return box.replaceChildren(el("p", { className: "hint" }, "DMX is off."));
  const names = ["Power", "Mode", "Clip", "Trigger", "Volume", "Mute", "Dimmer", "Reserved"];
  const values = dmx.values ? names.map((n, i) => `${n} ${dmx.values[i]}`).join(" · ") : "no data yet";
  box.replaceChildren(
    el("p", { className: "hint" }, dmx.inControl ? "In control." : dmx.live ? "Signal present." : "No signal."),
    el("table", { className: "kv" }, ...(dmx.sources ?? []).map((s) => el("tr", {}, el("th", {}, s.name || "(unnamed)"), el("td", {}, `${s.ip} · priority ${s.priority} · ${s.packetsPerSecond} packets/s`)))),
    el("p", { className: "mono" }, values),
    el("p", { className: "hint" }, `${dmx.rejected ?? 0} packets rejected (malformed / out of sequence).`),
  );
}

// The IR code is edited here, next to the "relay-ir" choice it belongs to. It goes through Apply like any other setting.
function irCard() {
  const code = el("input", { type: "text", value: String(effective("irPowerCode") ?? ""), placeholder: "nec:0x40bf or raw:+9000 -4500 ...", autocomplete: "off", spellcheck: false, attrs: { "aria-label": "IR power code" } });
  const edited = () => pending.set("irPowerCode", code.value.trim(), setting("irPowerCode") ?? "");
  code.addEventListener("input", edited);
  const learn = el("button", { type: "button" }, "Learn power button");
  learn.addEventListener("click", () =>
    run(async () => {
      learn.disabled = true;
      toast("Press the remote's power button at the receiver (15 s)…");
      try {
        const { code: learned } = await api("/api/ir/learn", json("POST", {}));
        code.value = learned;
        edited();
        toast(`Learned ${learned}. Send a test, then Apply.`);
      } finally {
        learn.disabled = false;
      }
    }),
  );
  const test = el("button", { type: "button" }, "Send test");
  test.addEventListener("click", () =>
    run(async () => {
      await api("/api/ir/test", json("POST", { code: code.value.trim() }));
      toast("Sent.");
    }),
  );
  return el(
    "div",
    { className: "setting" },
    el("span", { className: "title" }, "IR power code"),
    el("p", { className: "hint" }, 'For projector power "relay-ir". Point the remote at the IR receiver and press its power button after choosing Learn.'),
    el("div", { className: "control" }, code),
    el("div", { className: "actions" }, learn, test),
  );
}

export function mount(root, { sub }) {
  let group = null;
  let lastSettings = null;
  let ir = null;

  const search = el("input", { type: "search", placeholder: "Search settings", attrs: { "aria-label": "Search settings" } });
  const subnav = el("nav", { className: "subnav", attrs: { "aria-label": "Settings groups" } });
  const body = el("div", {});
  const dmxBox = el("div", {});
  root.append(el("div", { className: "toolbar" }, search, advancedToggle()), subnav, body);

  const syncIr = () => {
    if (ir) ir.hidden = effective("projectorPower") !== "relay-ir";
  };
  const offPending = pending.subscribe(syncIr);

  function draw() {
    ir = null;
    const data = state.settings;
    if (!data) return body.replaceChildren(el("p", { className: "hint" }, "Loading…"));
    const advanced = advancedShown();

    if (search.value.trim()) {
      subnav.hidden = true;
      const found = visibleItems(data.settings, { advanced, query: search.value });
      body.replaceChildren(
        ...(found.length
          ? found.map((s) => {
              const row = rowOf(s);
              row.querySelector(".setting-head")?.append(el("span", { className: "tag" }, s.group));
              return row;
            })
          : [el("p", { className: "hint" }, "No settings match.")]),
      );
      return;
    }

    subnav.hidden = false;
    const inGroup = (g) => visibleItems(data.settings.filter((s) => s.group === g), { advanced, query: "" });
    const groups = SETTINGS_GROUPS.filter((g) => inGroup(g).length > 0); // an empty group (Advanced, in Simple mode) drops out
    group = groups.find((g) => groupSlug(g) === sub) ?? groups[0];
    subnav.replaceChildren(...groups.map((g) => el("a", { href: `#/settings/${groupSlug(g)}`, attrs: g === group ? { "aria-current": "page" } : {} }, g)));

    const before = [];
    const after = [];
    if (group === "Hardware") {
      before.push(el("p", { className: "hint" }, "Change these in /etc/default/videofx over SSH, then restart. Ports need root (port 80 and the Bonjour entry); paths would let this page point the service anywhere."));
      before.push(fixedRow({ label: "Raspberry Pi model", value: data.device?.model ?? "unknown (not a Pi?)", key: "model", apply: "detected" }));
      after.push(pinTable(data.settings));
    }
    if (group === "Advanced") before.push(el("p", { className: "warn-box" }, "Wrong mpv options can stop playback. IPC, scripting, config, file and network options are refused."));
    if (group === "Projector") {
      ir = irCard();
      after.push(ir);
      syncIr();
    }
    if (group === "DMX") {
      after.push(dmxBox);
      if (state.status) renderDmx(dmxBox, state.status.dmx ?? {});
    }
    body.replaceChildren(el("section", {}, el("h3", {}, group ?? "Settings"), ...before, ...inGroup(group).map(rowOf), ...after));
  }

  search.addEventListener("input", draw);

  return {
    helpSlug: () => (group ? groupSlug(group) : "device"),
    unmount: offPending,
    update(s) {
      if (s.status) renderDmx(dmxBox, s.status.dmx ?? {});
      // Never rebuild rows under someone who is typing; the next update tries again.
      if (s.settings !== lastSettings && !editing(root)) {
        lastSettings = s.settings;
        draw();
      }
    },
  };
}
```

- [ ] **Step 4: Run the suites**

Run (sandbox disabled): `cd pi && npx vitest run`
Expected: PASS (`settings-form.test.js` now imports the file with its new `./api.js` and `./state.js` imports; both are safe to import in node because neither touches `document` at import time).

- [ ] **Step 5: Check it in the browser**

Run (sandbox disabled, background): `cd pi && node tools/dev-web.mjs`. Open `http://localhost:8080/#/settings`, then check:

1. The sub-navigation lists Device, Playback, Projector, Audio, Display, DMX, Cooling, Web page, Hardware. **Advanced is absent** in Simple mode, and turning on "Show advanced settings" adds Advanced and extra rows such as "Relay settle time" under Projector.
2. Each row shows label, one-line help and a control. The (i) button opens a detail panel with Source, Default, Applies and Variable; its `aria-expanded` flips.
3. Change "Device name": the row gets an orange left border and the Apply bar appears with "1 change". Change it back: the bar disappears.
4. Change two settings in different groups, apply. Toast reads "2 changes applied." and the bar goes away. Reload: values persisted; the (i) panel now offers "Reset to file value or default".
5. Failure path: under Motion sensor on the Scares screen is not built yet, so use **Cooling**: set "Pi warning temperature" above "Pi critical temperature" and Apply. A toast names the failing setting with the server's message, and the edit stays pending with the bar still showing.
6. Click Reset in an (i) panel: the control disables, "Goes back to the file value…" with Undo appears, the bar counts it. Undo clears it.
7. Typing "mpv" in the search box lists "Extra mpv options" even in Simple mode, with an "Advanced" tag. Typing "pir" lists the Motion sensor rows with their group tag. Clearing the box restores the group view.
8. Projector group: choose `relay-ir` in "Projector power" and the IR code card appears immediately; choose another mode and it hides. Learn fills the field and the bar counts it.
9. Web page group shows the password row; set a password, confirm the browser asks for it, then remove it.
10. Hardware group shows the Pi model, the fixed rows and the GPIO table; DMX group shows "DMX is off." (restart with `DEV_DMX=1` for the live block).
11. Switch to Dashboard and back with an edit pending: the edit and the bar are still there (the poll runs every 3 s throughout and must not clear it or steal focus while typing).
12. 375 px wide: sub-navigation scrolls sideways inside its own strip, the page itself does not.

Stop the server afterwards.

- [ ] **Step 6: Commit**

```bash
git add pi/public
git commit -m "Pi UI: schema-driven Settings with detail panels, search, Simple/Advanced and an Apply bar

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Media view

**Files:**
- Create: `pi/public/views/media.js`

**Interfaces:**
- Consumes: `enabledCount`, `isMediaFile`, `moveEntry` from `/playlist-core.js`; `api`, `bytes`, `el`, `json`, `run`, `toast` (Task 6); `onDirtyCheck`, `refreshMedia`, `refreshStatus`, `state` (Task 6).
- Produces: `mount(root)` for the `#/media` route.

- [ ] **Step 1: Create `pi/public/views/media.js`**

```js
import { enabledCount, isMediaFile, moveEntry } from "/playlist-core.js";
import { api, bytes, el, json, run, toast } from "../api.js";
import { onDirtyCheck, refreshMedia, refreshStatus } from "../state.js";

// Module-level on purpose: unsaved playlist edits survive leaving this screen and coming back.
let files = []; // [{ name, size }]
let saved = []; // playlist as on disk
let entries = []; // playlist being edited
let maxUploadBytes = Infinity;
let freeText = "";
let seen = null; // the state.media object last copied in
const dirty = () => JSON.stringify(entries) !== JSON.stringify(saved);
onDirtyCheck(dirty);

// XMLHttpRequest because fetch() cannot report upload progress.
function uploadOne(file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", `/api/media/${encodeURIComponent(file.name)}`);
    xhr.setRequestHeader("x-videofx", "1");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      if (xhr.status < 300) return resolve();
      let message = `${xhr.status}`;
      try {
        message = JSON.parse(xhr.responseText).error;
      } catch {}
      reject(new Error(`${file.name}: ${message}`));
    };
    xhr.onerror = () => reject(new Error(`${file.name}: upload failed`));
    xhr.send(file);
  });
}

export function mount(root) {
  const playlist = el("ol", { className: "rows" });
  const playlistEmpty = el("p", { className: "hint", hidden: true }, "Empty. Add videos below.");
  const save = el("button", { type: "button", className: "primary", disabled: true }, "Save playlist");
  const revert = el("button", { type: "button", disabled: true }, "Undo changes");
  const unsaved = el("span", { className: "hint", hidden: true }, "Unsaved changes");
  const list = el("ul", { className: "rows" });
  const empty = el("p", { className: "hint", hidden: true }, "No videos yet.");
  const input = el("input", { type: "file", multiple: true, accept: "video/*,audio/*,.m3u,.m3u8" });
  const progress = el("progress", { max: 1, value: 0, hidden: true });
  const space = el("p", { className: "hint" });

  root.append(
    el(
      "section",
      {},
      el("h3", {}, "Playlist"),
      el("p", { className: "hint" }, "Plays top to bottom and loops. Unchecked items are skipped. Saving restarts playback if it is running."),
      playlist,
      playlistEmpty,
      el("div", { className: "actions" }, save, revert, unsaved),
    ),
    el("section", {}, el("h3", {}, "Videos"), list, empty, el("label", { className: "upload" }, el("span", {}, "Upload videos"), input), progress, space),
  );

  function render() {
    const names = new Set(files.map((f) => f.name));
    playlist.replaceChildren(
      ...entries.map((entry, i) => {
        const check = el("input", { type: "checkbox", checked: entry.enabled, title: "Play this item" });
        check.addEventListener("change", () => ((entries[i].enabled = check.checked), render()));
        const up = el("button", { type: "button", className: "icon", disabled: i === 0, title: "Move up" }, "↑");
        up.addEventListener("click", () => ((entries = moveEntry(entries, i, i - 1)), render()));
        const down = el("button", { type: "button", className: "icon", disabled: i === entries.length - 1, title: "Move down" }, "↓");
        down.addEventListener("click", () => ((entries = moveEntry(entries, i, i + 1)), render()));
        const remove = el("button", { type: "button", className: "icon", title: "Remove from playlist" }, "✕");
        remove.addEventListener("click", () => (entries.splice(i, 1), render()));
        const missing = !names.has(entry.file);
        return el(
          "li",
          { className: [entry.enabled ? "" : "off", missing ? "missing" : ""].join(" ").trim() },
          check,
          el("span", { className: "name" }, entry.file + (missing ? " (missing)" : "")),
          up,
          down,
          remove,
        );
      }),
    );
    playlistEmpty.hidden = entries.length > 0;

    const inList = new Set(entries.map((e) => e.file));
    list.replaceChildren(
      ...files.map((f) => {
        const add = el("button", { type: "button", title: "Add to playlist" }, inList.has(f.name) ? "Add again" : "Add");
        add.addEventListener("click", () => (entries.push({ file: f.name, enabled: true }), render()));
        const del = el("button", { type: "button", className: "icon danger", title: `Delete ${f.name}` }, "🗑");
        del.addEventListener("click", () => run(() => deleteFile(f.name)));
        return el("li", {}, el("span", { className: "name" }, f.name), el("span", { className: "size" }, bytes(f.size)), add, del);
      }),
    );
    empty.hidden = files.length > 0;
    space.textContent = freeText;
    save.disabled = revert.disabled = !dirty();
    unsaved.hidden = !dirty();
  }

  async function savePlaylist() {
    const data = await api("/api/playlist", json("PUT", { entries }));
    saved = data.playlist;
    entries = structuredClone(saved);
    render();
    toast(enabledCount(saved) ? "Playlist saved." : "Saved, but nothing is checked, so nothing will play.");
    await refreshStatus();
  }

  async function deleteFile(name) {
    if (!confirm(`Delete ${name} from the Pi? It is also removed from the playlist.`)) return;
    await api(`/api/media/${encodeURIComponent(name)}`, { method: "DELETE" });
    entries = entries.filter((e) => e.file !== name);
    toast(`Deleted ${name}.`);
    await refreshMedia();
  }

  async function upload(fileList) {
    const picked = [...fileList];
    const bad = picked.filter((f) => (!isMediaFile(f.name) && !/\.m3u8?$/i.test(f.name)) || f.size > maxUploadBytes);
    if (bad.length) toast(`Skipped (not a video, audio or .m3u file, or too big): ${bad.map((f) => f.name).join(", ")}`);
    const good = picked.filter((f) => !bad.includes(f));
    const total = good.reduce((n, f) => n + f.size, 0) || 1;
    let done = 0;
    progress.hidden = false;
    try {
      for (const file of good) {
        await uploadOne(file, (p) => (progress.value = (done + p * file.size) / total));
        done += file.size;
      }
      if (good.length) toast(`Uploaded ${good.length} file${good.length === 1 ? "" : "s"}. Add them to the playlist and save.`);
    } catch (err) {
      toast(err.message);
    } finally {
      progress.hidden = true;
      progress.value = 0;
      input.value = "";
      await refreshMedia();
    }
  }

  save.addEventListener("click", () => run(savePlaylist));
  revert.addEventListener("click", () => ((entries = structuredClone(saved)), render()));
  input.addEventListener("change", () => run(() => upload(input.files)));

  render(); // module state from an earlier visit, if any

  return {
    helpSlug: () => "media",
    update({ media }) {
      if (!media || media === seen) return; // the status poll must not rebuild the lists
      const edited = dirty(); // keep unsaved edits across refreshes
      seen = media;
      files = media.files;
      saved = media.playlist;
      maxUploadBytes = media.maxUploadBytes ?? Infinity;
      freeText = `${bytes(media.freeBytes)} free` + (media.maxUploadBytes ? ` · max ${bytes(media.maxUploadBytes)} per file` : "");
      if (!edited) entries = structuredClone(saved);
      render();
    },
  };
}
```

- [ ] **Step 2: Run the suites**

Run (sandbox disabled): `cd pi && npx vitest run`
Expected: PASS (no test imports this view).

- [ ] **Step 3: Check it in the browser**

Run (sandbox disabled, background): `cd pi && node tools/dev-web.mjs`, open `http://localhost:8080/#/media`, and check:

1. The four sample videos are listed with sizes; "Add" appends to the playlist and the Save and Undo buttons enable and "Unsaved changes" shows.
2. Move up/down, uncheck (name struck through), remove, Undo changes restores. Save toasts "Playlist saved."
3. Leave an unsaved edit, go to Dashboard, return: the edit is still there. The 3 s poll does not reset it.
4. Upload a small `.mp4` from disk: progress bar shows, the file appears, free space updates. Upload a `.txt`: toast says it was skipped.
5. Delete a video: confirm dialog, then it is gone from both lists.
6. Closing the tab with an unsaved edit raises the browser's leave-page warning.

Stop the server.

- [ ] **Step 4: Commit**

```bash
git add pi/public/views/media.js
git commit -m "Pi UI: Media view (videos and playlist)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Scares view

**Files:**
- Create: `pi/public/views/scares.js`

**Interfaces:**
- Consumes: `suggestScarePairs` from `/playlist-core.js`; `pending`, `effective`, `rowOf`, `visibleItems`, `advancedShown`, `advancedToggle` (Task 7); `setting`, `state` (Task 6); `el`, `toast` (Task 6).
- Produces: `mount(root)` for `#/scares`. Calm clip and scare clips are edited through the pending store under the keys `scareBuffer` and `scareClips`, so they are saved by the Apply bar.

- [ ] **Step 1: Create `pi/public/views/scares.js`**

```js
import { suggestScarePairs } from "/playlist-core.js";
import { editing, el, toast } from "../api.js";
import { advancedShown, advancedToggle, effective, pending, rowOf, visibleItems } from "../settings-form.js";
import { setting, state } from "../state.js";

const names = () => (state.media?.files ?? []).map((f) => f.name);
const bufferNow = () => effective("scareBuffer") ?? "";
const clipsNow = () => [...(effective("scareClips") ?? [])];

function setClips(list) {
  pending.set("scareClips", list, setting("scareClips") ?? []);
}
function setBuffer(name) {
  pending.set("scareBuffer", name, setting("scareBuffer") ?? "");
  setClips(clipsNow().filter((c) => c !== name)); // the calm clip cannot also be a scare clip
}

export function mount(root) {
  let lastSettings = null;
  let lastMedia = null;

  const select = el("select", { id: "scare-buffer" });
  const clips = el("ul", { className: "rows" });
  const suggest = el("button", { type: "button" }, "Suggest from file names");
  const behaviour = el("div", {});
  const motion = el("div", {});

  root.append(
    el(
      "section",
      {},
      el("h3", {}, "Scare mode"),
      el(
        "p",
        { className: "hint" },
        'A calm clip loops without a gap; on a trigger (the "Scare" switch in your Home app, the motion sensor, DMX, or the Scare now button on the Dashboard) one scare clip plays, then it goes back to the calm clip. Turn it on under ',
        el("a", { href: "#/settings/playback" }, "Settings > Playback > Mode"),
        ".",
      ),
    ),
    el(
      "section",
      {},
      el("h3", {}, "Clips"),
      el("label", { className: "title", htmlFor: "scare-buffer" }, "Calm clip"),
      select,
      el("p", { className: "title" }, "Scare clips"),
      clips,
      el("div", { className: "actions" }, suggest),
    ),
    el("section", {}, el("h3", {}, "Scare behaviour"), behaviour),
    el("section", {}, el("h3", {}, "Motion sensor"), motion, advancedToggle()),
  );

  function drawClips() {
    const all = names();
    const buffer = bufferNow();
    const chosen = clipsNow();
    select.replaceChildren(el("option", { value: "" }, "(choose)"), ...all.map((n) => el("option", { value: n, selected: n === buffer }, n)));
    clips.replaceChildren(
      ...all
        .filter((n) => n !== buffer)
        .map((n) => {
          const box = el("input", { type: "checkbox", checked: chosen.includes(n) });
          box.addEventListener("change", () => setClips(box.checked ? [...clipsNow(), n] : clipsNow().filter((c) => c !== n)));
          return el("li", {}, box, el("span", { className: "name" }, n));
        }),
    );
  }

  function drawRows() {
    const data = state.settings;
    if (!data) return;
    const advanced = advancedShown();
    const rows = (group) => visibleItems(data.settings.filter((s) => s.group === group), { advanced, query: "" }).map(rowOf);
    behaviour.replaceChildren(...rows("Scare"));
    motion.replaceChildren(...rows("Motion sensor"));
  }

  select.addEventListener("change", () => {
    setBuffer(select.value);
    drawClips();
  });
  suggest.addEventListener("click", () => {
    const [best] = suggestScarePairs(names());
    if (!best) return toast('No file with "buffer" in its name. Pick the clips by hand.');
    setBuffer(best.buffer);
    setClips(best.scares);
    drawClips();
    toast(`Suggested ${best.buffer} with ${best.scares.length} scare clip${best.scares.length === 1 ? "" : "s"}. Apply to use them.`);
  });

  return {
    helpSlug: () => "scares",
    update(s) {
      // Not while someone is typing or choosing; the next update tries again.
      if (editing(root)) return;
      if (s.settings !== lastSettings) {
        lastSettings = s.settings;
        drawRows();
        drawClips();
      } else if (s.media !== lastMedia) {
        drawClips();
      }
      lastMedia = s.media;
    },
  };
}
```

- [ ] **Step 2: Run the suites**

Run (sandbox disabled): `cd pi && npx vitest run`
Expected: PASS.

- [ ] **Step 3: Check it in the browser**

Run (sandbox disabled, background): `cd pi && node tools/dev-web.mjs`, open `http://localhost:8080/#/scares`, and check:

1. The calm clip select lists the four videos. "Suggest from file names" picks `ghost-buffer.mp4` with the two `ghost-scare-*` clips and the Apply bar shows "2 changes".
2. Choosing a different calm clip removes it from the scare-clip list and from the chosen set.
3. Apply saves both; reload keeps them. Changing them back to the saved values makes the Apply bar disappear.
4. "Scare behaviour" lists cooldown, order and trigger-during-scare rows; "Motion sensor" lists PIR enabled and PIR GPIO. "Show advanced settings" adds "PIR debounce (ms)" and the view rebuilds with pending edits still in place.
5. Edit a scare clip, go to Media and back: the ticked state is still there.

Stop the server.

- [ ] **Step 4: Commit**

```bash
git add pi/public/views/scares.js
git commit -m "Pi UI: Scares view (clips, behaviour, motion sensor)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Schedule view

**Files:**
- Create: `pi/public/views/schedule.js`

**Interfaces:**
- Consumes: `pending`, `effective`, `rowOf`, `visibleItems`, `advancedShown` (Task 7); `setting`, `state` (Task 6); `el` (Task 6).
- Produces: `mount(root)` for `#/schedule`. The weekly schedule and quiet hours are edited through the pending store under the keys `schedule` and `quietHours` (whole-object values), so the Apply bar saves them.

- [ ] **Step 1: Create `pi/public/views/schedule.js`**

```js
import { editing, el } from "../api.js";
import { advancedShown, effective, pending, rowOf, visibleItems } from "../settings-form.js";
import { setting, state } from "../state.js";

const DAY_NAMES = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };
const has = (v) => v !== null && v !== undefined && v !== "";

export function mount(root) {
  let lastSettings = null;

  // weekly schedule
  const schedEnabled = el("input", { type: "checkbox" });
  const sunOffset = el("input", { type: "number", min: -180, max: 240, step: 5, inputMode: "numeric", id: "sched-offset" });
  const schedDays = el("tbody");
  const geo = el("p", { className: "hint" });
  const place = el("div", {}); // latitude and longitude rows

  // quiet hours
  const quietEnabled = el("input", { type: "checkbox" });
  const quietCap = el("input", { type: "number", min: 0, max: 100, step: 1, inputMode: "numeric", id: "quiet-cap" });
  const quietNoScares = el("input", { type: "checkbox" });
  const quietDmx = el("input", { type: "checkbox" });
  const quietDays = el("tbody");

  root.append(
    el(
      "section",
      {},
      el("h3", {}, "Weekly schedule"),
      el("p", { className: "hint" }, "Times are local to the Pi. An off time earlier than the on time means after midnight. The schedule only acts at these times: switching on or off by hand holds until the next one."),
      el("label", { className: "check" }, schedEnabled, "Use the schedule"),
      el("table", { className: "sched" }, el("thead", {}, el("tr", {}, el("th", {}, "Day"), el("th", {}, "On"), el("th", {}, "At sunset"), el("th", {}, "Off"))), schedDays),
      el("label", { className: "title", htmlFor: "sched-offset" }, "Sunset offset (minutes, - is before)"),
      sunOffset,
      geo,
      place,
    ),
    el(
      "section",
      {},
      el("h3", {}, "Quiet hours"),
      el("p", { className: "hint" }, "While quiet, the volume is capped (0 mutes) and scares can be off, whoever asks: this page, Home, the schedule, the motion sensor. An end earlier than the start runs past midnight."),
      el("label", { className: "check" }, quietEnabled, "Use quiet hours"),
      el("table", { className: "sched" }, el("thead", {}, el("tr", {}, el("th", {}, "Day"), el("th", {}, "From"), el("th", {}, "Until"))), quietDays),
      el("label", { className: "title", htmlFor: "quiet-cap" }, "Volume cap (%)"),
      quietCap,
      el("label", { className: "check" }, quietNoScares, "No scares during quiet hours"),
      el("label", { className: "check" }, quietDmx, "DMX ignores quiet hours"),
    ),
  );

  function collectSchedule() {
    const days = {};
    for (const row of schedDays.children) {
      const [on, sun, off] = row.querySelectorAll("input");
      days[row.dataset.day] = { on: sun.checked ? "sunset" : on.value, off: off.value };
    }
    return { enabled: schedEnabled.checked, sunsetOffsetMin: Number(sunOffset.value || 0), days };
  }
  function collectQuiet() {
    const days = {};
    for (const row of quietDays.children) {
      const [start, end] = row.querySelectorAll("input");
      days[row.dataset.day] = { start: start.value, end: end.value };
    }
    return { enabled: quietEnabled.checked, volumeCap: Number(quietCap.value || 0), disableScares: quietNoScares.checked, dmxBypass: quietDmx.checked, days };
  }
  const scheduleEdited = () => pending.set("schedule", collectSchedule(), setting("schedule"));
  const quietEdited = () => pending.set("quietHours", collectQuiet(), setting("quietHours"));

  for (const control of [schedEnabled, sunOffset]) {
    control.addEventListener("input", scheduleEdited);
    control.addEventListener("change", scheduleEdited);
  }
  for (const control of [quietEnabled, quietCap, quietNoScares, quietDmx]) {
    control.addEventListener("input", quietEdited);
    control.addEventListener("change", quietEdited);
  }

  function drawSchedule() {
    const sched = effective("schedule");
    if (!sched) return;
    schedEnabled.checked = sched.enabled;
    sunOffset.value = sched.sunsetOffsetMin;
    schedDays.replaceChildren(
      ...Object.keys(DAY_NAMES).map((d) => {
        const day = sched.days[d];
        const on = el("input", { type: "time", value: day.on === "sunset" ? "" : day.on, disabled: day.on === "sunset", attrs: { "aria-label": `${DAY_NAMES[d]} on` } });
        const sun = el("input", { type: "checkbox", checked: day.on === "sunset", title: "On at sunset", attrs: { "aria-label": `${DAY_NAMES[d]} on at sunset` } });
        sun.addEventListener("change", () => (on.disabled = sun.checked));
        const off = el("input", { type: "time", value: day.off, attrs: { "aria-label": `${DAY_NAMES[d]} off` } });
        const row = el("tr", {}, el("td", {}, DAY_NAMES[d]), el("td", {}, on), el("td", {}, sun), el("td", {}, off));
        row.dataset.day = d;
        row.addEventListener("input", scheduleEdited);
        row.addEventListener("change", scheduleEdited);
        return row;
      }),
    );
  }

  function drawQuiet() {
    const qh = effective("quietHours");
    if (!qh) return;
    quietEnabled.checked = qh.enabled;
    quietCap.value = qh.volumeCap;
    quietNoScares.checked = qh.disableScares;
    quietDmx.checked = qh.dmxBypass;
    quietDays.replaceChildren(
      ...Object.keys(DAY_NAMES).map((d) => {
        const start = el("input", { type: "time", value: qh.days[d].start, attrs: { "aria-label": `${DAY_NAMES[d]} from` } });
        const end = el("input", { type: "time", value: qh.days[d].end, attrs: { "aria-label": `${DAY_NAMES[d]} until` } });
        const row = el("tr", {}, el("td", {}, DAY_NAMES[d]), el("td", {}, start), el("td", {}, end));
        row.dataset.day = d;
        row.addEventListener("input", quietEdited);
        row.addEventListener("change", quietEdited);
        return row;
      }),
    );
  }

  function drawPlace() {
    const data = state.settings;
    if (!data) return;
    place.replaceChildren(...visibleItems(data.settings.filter((s) => s.group === "Schedule"), { advanced: advancedShown(), query: "" }).map(rowOf));
  }

  function updateGeo() {
    const lat = effective("latitude");
    const lon = effective("longitude");
    geo.textContent = has(lat) && has(lon) ? `Sunset for ${lat}, ${lon}. Days with no sunset (polar summer or winter) have no on time.` : "For sunset, set Latitude and Longitude below.";
  }
  const offPending = pending.subscribe(updateGeo);

  return {
    helpSlug: () => "schedule",
    unmount: offPending,
    update(s) {
      if (s.settings === lastSettings || editing(root)) return; // not under someone who is typing
      lastSettings = s.settings;
      drawSchedule();
      drawQuiet();
      drawPlace();
      updateGeo();
    },
  };
}
```

- [ ] **Step 2: Run the suites**

Run (sandbox disabled): `cd pi && npx vitest run`
Expected: PASS.

- [ ] **Step 3: Check it in the browser**

Run (sandbox disabled, background): `cd pi && node tools/dev-web.mjs`, open `http://localhost:8080/#/schedule`, and check:

1. Seven weekday rows for the schedule and seven for quiet hours, with times filled in from the server.
2. Tick "At sunset" on Monday: the On time disables and clears; the Apply bar shows "1 change"; the sentence under the table asks for latitude and longitude.
3. Type a latitude and longitude in the two rows below it: the sentence changes to "Sunset for …" and the bar counts three changes.
4. Change a quiet-hours cap and untick "DMX ignores quiet hours": one more change. Apply: toast says "4 changes applied." and the bar clears. Reload: values persisted, Monday still "At sunset".
5. Edit a time, go to another screen and back: the edit is still shown (rebuilt from the pending store) and the bar is still there. Discard clears it.

Stop the server.

- [ ] **Step 4: Commit**

```bash
git add pi/public/views/schedule.js
git commit -m "Pi UI: Schedule view (weekly schedule, sunset location, quiet hours)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 11: System view

**Files:**
- Create: `pi/public/views/system.js`

**Interfaces:**
- Consumes: `api`, `el`, `json`, `run`, `toast`, `restartService` (Task 6); `systemNotesOf` (Task 3); `state` (Task 6).
- Produces: `mount(root)` for `#/system`: Matter pairing and reset, backup download and restore, restart, software version and system notes.

- [ ] **Step 1: Create `pi/public/views/system.js`**

```js
import { api, el, json, restartService, run, toast } from "../api.js";
import { systemNotesOf } from "../notes.js";

export function mount(root) {
  // --- Matter
  const qr = el("img", { id: "qr", alt: "Matter pairing QR code", width: 220, height: 220 });
  const manual = el("code", {});
  const unpaired = el(
    "div",
    { hidden: true },
    el("p", {}, "Not paired. In Apple Home: ", el("b", {}, "+"), " > ", el("b", {}, "Add Accessory"), ", then scan this code."),
    qr,
    el("p", {}, "Or choose ", el("b", {}, "More options"), " and enter ", manual),
  );
  const fabrics = el("p", {});
  const reset = el("button", { type: "button", className: "danger" }, "Reset pairing");
  const paired = el(
    "div",
    { hidden: true },
    fabrics,
    el(
      "details",
      {},
      el("summary", {}, "Reset Matter pairing"),
      el("p", {}, "Removes this device from every Matter controller (Apple Home, Google Home, …). You will have to pair it again. Videos and the playlist are kept."),
      reset,
    ),
  );

  // --- backup and restore
  const restoreFile = el("input", { type: "file", accept: ".json,application/json" });
  const restoreInfo = el("p", { className: "hint" });
  const restoreMatter = el("input", { type: "checkbox" });
  const restoreGo = el("button", { type: "button", className: "primary" }, "Restore");
  const restorePanel = el(
    "div",
    { hidden: true },
    restoreInfo,
    el("label", { className: "check" }, restoreMatter, "Also restore the Matter pairing"),
    el("p", { className: "warn-box" }, "Only restore the pairing onto the same Pi, or when the old Pi is gone for good. Two devices with one Matter identity confuse Apple Home and both misbehave. Without it, this Pi keeps its own pairing (pair it again if it's new)."),
    restoreGo,
  );
  let restoreData = null;

  async function pickRestore(file) {
    restoreData = null;
    restorePanel.hidden = true;
    if (!file) return;
    const data = JSON.parse(await file.text());
    if (data.format !== "videofx-backup") throw new Error("That is not a VideoFX backup file.");
    restoreData = data;
    const matterFiles = Object.keys(data.matter ?? {}).length;
    restoreInfo.textContent = `Backup of ${data.device ?? "a VideoFX"} from ${data.createdAt ? new Date(data.createdAt).toLocaleString() : "?"}${matterFiles ? "" : " (no Matter pairing in it)"}.`;
    restoreMatter.checked = false;
    restoreMatter.disabled = matterFiles === 0;
    restorePanel.hidden = false;
  }

  async function doRestore() {
    const includeMatter = restoreMatter.checked;
    const msg = includeMatter
      ? "Restore settings, playlist AND the Matter pairing? Only do this on the same Pi, or if the old one is gone for good. The service restarts."
      : "Restore settings and playlist? This Pi keeps its own Matter pairing. The service restarts.";
    if (!confirm(msg)) return;
    await api("/api/restore", json("POST", { backup: restoreData, includeMatter, confirmMatter: includeMatter }));
    toast("Restored. Restarting… this page reloads by itself.");
    setTimeout(() => location.reload(), 10_000);
  }

  // --- software
  const version = el("p", {});
  const notes = el("div", {});
  const restart = el("button", { type: "button" }, "Restart now");

  root.append(
    el("section", {}, el("h3", {}, "Matter"), unpaired, paired),
    el(
      "section",
      {},
      el("h3", {}, "Backup"),
      el("p", { className: "hint" }, "One file with the settings, schedule, quiet hours, playlist and Matter pairing (not the videos). It contains the pairing keys and the password hash: keep it private."),
      el("div", { className: "actions" }, el("a", { className: "button", href: "/api/backup", download: "" }, "Download backup")),
      el("label", { className: "upload" }, el("span", {}, "Restore from a backup file"), restoreFile),
      restorePanel,
    ),
    el(
      "section",
      {},
      el("h3", {}, "Software"),
      version,
      notes,
      el("details", { className: "restart" }, el("summary", {}, "Restart service"), el("p", {}, "Stops playback for a few seconds; the service comes back by itself and restores the last state."), restart),
    ),
  );

  reset.addEventListener("click", () =>
    run(async () => {
      if (prompt('This unpairs the device from all controllers. Type "reset" to confirm.') !== "reset") return;
      await api("/api/matter/reset", json("POST", { confirm: "reset" }));
      toast("Resetting. The pairing code appears here in a few seconds.");
    }),
  );
  restoreFile.addEventListener("change", () => run(() => pickRestore(restoreFile.files[0])));
  restoreGo.addEventListener("click", () => run(doRestore));
  restart.addEventListener("click", () => run(restartService));

  return {
    helpSlug: () => "system",
    update({ status: st }) {
      if (!st) return;
      const m = st.matter;
      unpaired.hidden = m.commissioned;
      paired.hidden = !m.commissioned;
      if (!m.commissioned) {
        // Shown as 1234-567-8901, the way controllers print it.
        manual.textContent = m.manualPairingCode?.replace(/^(\d{4})(\d{3})(\d{4})$/, "$1-$2-$3") ?? "";
        if (!qr.getAttribute("src")) qr.src = `/api/pairing.svg?${Date.now()}`;
      } else {
        qr.removeAttribute("src");
        fabrics.textContent = `Paired with ${m.fabrics} Matter controller${m.fabrics === 1 ? "" : "s"}.`;
      }

      const v = st.version;
      version.textContent = v
        ? v.available
          ? `VideoFX ${v.version}${v.sha ? ` (${v.sha})` : ""} · update available: ${v.latest}. Run "sudo videofx-update" on the Pi.`
          : `VideoFX ${v.version}${v.sha ? ` (${v.sha})` : ""}${v.checkedAt ? ` · up to date as of ${new Date(v.checkedAt).toLocaleDateString()}` : ""}`
        : "";
      const list = systemNotesOf(st);
      notes.replaceChildren(...(list.length ? list.map((n) => el("p", { className: "warn" }, n.text)) : [el("p", { className: "hint" }, "No storage, clock or password problems.")]));
    },
  };
}
```

- [ ] **Step 2: Run the suites**

Run (sandbox disabled): `cd pi && npx vitest run`
Expected: PASS.

- [ ] **Step 3: Check it in the browser**

Run (sandbox disabled, background): `cd pi && node tools/dev-web.mjs`, open `http://localhost:8080/#/system`, and check:

1. The Matter section shows the QR image and the code `3497-011-2332` (unpaired in the dev server).
2. "Download backup" downloads `videofx-dev-backup-<date>.json`. Pick that same file under Restore: the panel appears saying "(no Matter pairing in it)" and the Matter checkbox is disabled. Picking a non-backup JSON toasts "That is not a VideoFX backup file."
3. The Software card shows the version line and the "No password" note (the dev server has none). The red dot on the System tab matches.
4. Restart opens a confirm dialog.

Stop the server.

- [ ] **Step 4: Commit**

```bash
git add pi/public/views/system.js
git commit -m "Pi UI: System view (Matter, backup and restore, restart, version)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Help pages

**Files:**
- Create: `pi/public/help/{dashboard,media,scares,schedule,system,device,playback,projector,audio,display,dmx,cooling,web-page,advanced,hardware}.md`
- Create: `pi/test/help.test.js`
- Modify: `pi/test/web.test.js`

**Interfaces:**
- Consumes: `helpSlugs()` (Task 3), `parseMarkdown` (Task 4), the static route (Task 1).
- Produces: one page per slug. Every page starts with a level-1 heading and ends with a link to a `pi/README.md` heading, written as `https://github.com/davidwkeith/atmosfx-projector-case/blob/main/pi/README.md#<anchor>`. The test below checks that each anchor matches a real README heading.

- [ ] **Step 1: Write the failing tests**

`pi/test/help.test.js`:

```js
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
```

In `pi/test/web.test.js` add `import { helpSlugs } from "../public/nav.js";` and, inside `describe("web server", ...)` after the static-file tests from Task 1:

```js
  it("serves every help page as Markdown", async () => {
    for (const slug of helpSlugs()) {
      const res = await call("GET", `/help/${slug}.md`);
      expect(res.status, slug).toBe(200);
      expect(res.headers["content-type"], slug).toMatch(/^text\/markdown/);
    }
  });
```

- [ ] **Step 2: Run to verify failure**

Run (sandbox disabled): `cd pi && npx vitest run test/help.test.js test/web.test.js`
Expected: FAIL: the help folder does not exist, and the 15 help requests return 404.

- [ ] **Step 3: Write the 15 pages**

Create each file with exactly this content.

`pi/public/help/dashboard.md`:

```markdown
# Dashboard

This is the screen for the night itself: start and stop the show, fire a scare, change the volume, and see at a glance that everything is healthy.

## Play and Stop

**Play** switches the projector on and starts the playlist (in scare mode, the calm clip). **Stop** switches it off. Matter, the schedule and the motion sensor use the same switch, so this button always shows the real state. If playback cannot start, the reason appears above the button.

## Scare now

Shown only in scare mode while playing. It plays one scare clip, then goes back to the calm clip. A cooldown follows each scare and is counted down under the button.

## Volume

The slider and **Mute** control the speakers. During quiet hours the volume is capped, whoever asks.

## Tiles

- **Projector**: its power state and how it is switched (CEC, relay, IR or HDMI).
- **Schedule**: the next automatic on or off.
- **Network**: Ethernet, or the Wi-Fi strength.
- **Pi temperature**: the Pi's own temperature. At the critical temperature it stops playback and switches the projector off.

## Banners

- **DMX in control**: a lighting desk is sending signal, so power and volume are locked until it stops.
- A red banner lists alarms (heat, projector) and system problems (no password, clock not synced, storage).

Read more: [How it works](https://github.com/davidwkeith/atmosfx-projector-case/blob/main/pi/README.md#how-it-works)
```

`pi/public/help/media.md`:

```markdown
# Media

## Playlist

The playlist plays top to bottom and loops. Untick an item to skip it without removing it. Use the arrows to reorder. Nothing changes on the Pi until you press **Save playlist**, and saving restarts playback if it is running. Your unsaved edits stay while you look at other screens.

## Videos

These are the files on the Pi. **Add** puts one on the playlist (you can add the same file more than once). The bin deletes the file from the Pi and from the playlist.

## Uploading

Choose one or more video or audio files, or an `.m3u` playlist. The page shows how much space is free and the largest file it accepts; the limit is **Largest upload** under Settings > Web page. Uploaded files are not on the playlist until you add them and save.

Your purchased videos are not included with VideoFX. Upload them here, or copy them to the media folder over SSH.

Read more: [Videos, playlist, scare mode](https://github.com/davidwkeith/atmosfx-projector-case/blob/main/pi/README.md#videos-playlist-scare-mode)
```

`pi/public/help/scares.md`:

```markdown
# Scares

Scare mode loops a calm clip without a gap. On a trigger, one scare clip plays, then it goes back to the calm clip.

## Turn it on

Set **Mode** to `scare` under Settings > Playback. Until then this screen only prepares the clips.

## Clips

- **Calm clip**: the clip that loops between scares.
- **Scare clips**: the clips a trigger can play. The calm clip is never offered as a scare clip.
- **Suggest from file names** picks the file with "buffer" in its name as the calm clip and the matching scare clips. Check its guess before applying.

Clip changes wait in the Apply bar until you press **Apply**.

## What triggers a scare

The **Scare** switch in your Home app, the motion sensor, a DMX signal, and **Scare now** on the Dashboard. Quiet hours can switch scares off, whoever asks.

## Motion sensor

Scares only fire when playback is on and the mode is scare. The sensor also shows up in Matter as an occupancy sensor. Choose the pin it is wired to under **PIR GPIO**; the default is GPIO17 (physical pin 11).

Read more: [Videos, playlist, scare mode](https://github.com/davidwkeith/atmosfx-projector-case/blob/main/pi/README.md#videos-playlist-scare-mode)
```

`pi/public/help/schedule.md`:

```markdown
# Schedule

## Weekly schedule

Pick an on and an off time for each weekday, or tick **At sunset** to switch on at sunset. Times are local to the Pi. An off time earlier than the on time means after midnight.

The schedule only acts at these times. If you switch on or off by hand, that holds until the next scheduled time.

## Sunset

Sunset is worked out on the Pi from **Latitude** and **Longitude** (north and east are positive, so west is negative). The **offset** moves the time: a negative number is before sunset. Days with no sunset, in polar summer or winter, get no on time.

## The Pi's clock

The Pi has no battery clock. The schedule and quiet hours wait until it has the time from the network, and the Dashboard says so.

## Quiet hours

Quiet hours cap the volume (0 mutes) and can turn scares off during a window each day. An end earlier than the start runs past midnight. They apply whoever asks: this page, Home, the schedule, the motion sensor. DMX follows them too, unless **DMX ignores quiet hours** is ticked. Switching on and off is not affected.

Changes wait in the Apply bar until you press **Apply**.

Read more: [Schedule](https://github.com/davidwkeith/atmosfx-projector-case/blob/main/pi/README.md#schedule), [Quiet hours](https://github.com/davidwkeith/atmosfx-projector-case/blob/main/pi/README.md#quiet-hours)
```

`pi/public/help/system.md`:

```markdown
# System

## Matter

Matter lets Apple Home and other controllers switch VideoFX on and off, change the volume and fire a scare. Until it is paired, this screen shows a QR code and a manual code. In Apple Home choose **+**, **Add Accessory**, then scan the code.

**Reset pairing** removes the device from every controller. You will have to pair it again. Videos and settings are kept.

## Backup and restore

The backup file holds your settings, schedule, quiet hours, playlist and Matter pairing, but not the videos. It contains the pairing keys and the password hash, so keep it private.

When restoring, leave **Also restore the Matter pairing** off unless this is the same Pi, or the old one is gone for good. Two devices with one Matter identity confuse Apple Home. Without it, this Pi keeps its own pairing.

## Software

The page shows the installed version. VideoFX never updates itself: when an update is available, run `sudo videofx-update` on the Pi.

**Restart service** stops playback for a few seconds. It comes back by itself and restores the last state.

Read more: [Pair with Apple Home](https://github.com/davidwkeith/atmosfx-projector-case/blob/main/pi/README.md#pair-with-apple-home), [Backup and restore](https://github.com/davidwkeith/atmosfx-projector-case/blob/main/pi/README.md#backup-and-restore), [Updates](https://github.com/davidwkeith/atmosfx-projector-case/blob/main/pi/README.md#updates)
```

`pi/public/help/device.md`:

```markdown
# Device

## Device name

The name shown in Matter controllers and at the top of this page. Up to 32 characters.

## After a power cut

What the Pi does when power comes back: `last` returns to the state it was in, `on` always plays, `off` always stays off.

## How settings work

Every setting shows a label, a one-line description and a control. Press the (i) next to the label for where the value comes from, its default, and when a change takes effect. Changes are collected in the bar at the bottom; nothing is saved until you press **Apply**.

A value can come from three places, strongest first: set on this page, set in `/etc/default/videofx`, or the built-in default. **Reset to file value or default** in the (i) panel drops the value set here.

**Show advanced settings** reveals rarely needed rows. The search box finds any setting by name or description, advanced or not.

Read more: [Settings](https://github.com/davidwkeith/atmosfx-projector-case/blob/main/pi/README.md#settings)
```

`pi/public/help/playback.md`:

```markdown
# Playback

## Mode

- `loop` plays the playlist top to bottom and repeats.
- `scare` loops the calm clip and plays a scare clip on a trigger. Choose the clips on the Scares screen.

Changing the mode takes effect the next time playback starts.

Read more: [Videos, playlist, scare mode](https://github.com/davidwkeith/atmosfx-projector-case/blob/main/pi/README.md#videos-playlist-scare-mode)
```

`pi/public/help/projector.md`:

```markdown
# Projector

## Projector power

How VideoFX switches the projector on and off:

- `cec`: HDMI-CEC wake and standby. If the projector never answers, it falls back to `hdmi-off`.
- `relay-ir`: a relay on the projector's DC feed, then the projector's IR power code.
- `relay`: the relay only, for projectors that switch on by themselves.
- `hdmi-off`: turn the HDMI signal off when stopped.
- `none`: leave the projector alone.

Not every projector answers CEC. If the Dashboard says CEC has no response, try `relay-ir`.

## IR power code

Shown when the mode is `relay-ir`. Point the projector's remote at the IR receiver, press **Learn power button**, then press the remote's power button within 15 seconds. **Send test** fires the code at the projector. Press **Apply** to keep it.

## Two power presses

Tick **Projector needs two power presses** if the projector ignores a single press of its power button.

## Advanced rows

**Relay settle time** is how long to wait after power-up before sending IR and starting playback. **CEC device** is `/dev/cec0`, the only HDMI port on a Pi 3 or Zero 2 W.

Read more: [Projector power](https://github.com/davidwkeith/atmosfx-projector-case/blob/main/pi/README.md#projector-power)
```

`pi/public/help/audio.md`:

```markdown
# Audio

## Volume and Mute

The starting volume and whether the speakers start muted. The Dashboard slider changes the same values. The slider sets the level at once; the value here is where it starts.

## Sound card

With the Raspberry Pi DigiAMP+, the card name is `RPiDigiAMP` and the mixer control is `Digital`. Use the card's name, never its number: numbers can change between restarts. `aplay -l` on the Pi shows the names. Both rows are advanced.

Read more: [Audio](https://github.com/davidwkeith/atmosfx-projector-case/blob/main/pi/README.md#audio)
```

`pi/public/help/display.md`:

```markdown
# Display

## Video output

The DRM connector mpv draws on. `HDMI-A-1` is the only HDMI port on a Pi 3 or Zero 2 W; on a Pi 4B or 5 it is HDMI0, next to USB-C. Leave it empty to let mpv choose.

## Mirror

Flips the picture left to right, for rear projection onto window material. The flip is done in software, so it uses more CPU. A Pi 4B or 5 copes; a Pi 3 or Zero 2 W may not manage 1080p.

## Console

The console used for the black screen and the pairing screen. This is an advanced row; leave it alone unless the screen stays blank.

Read more: [Videos, playlist, scare mode](https://github.com/davidwkeith/atmosfx-projector-case/blob/main/pi/README.md#videos-playlist-scare-mode)
```

`pi/public/help/dmx.md`:

```markdown
# DMX

VideoFX can be driven by a lighting desk over the network (sACN, also called E1.31). No DMX cable is involved.

## How it takes over

While a source is sending, DMX overrides Matter, this page and the schedule. The Dashboard shows "DMX in control" and locks power and volume. When the signal stops, control goes back after the data-loss timeout plus **Hold after the signal stops**.

## Addressing

Set **Universe** and **Start address**. VideoFX reads eight channels from the start address: Power, Mode, Clip, Trigger, Volume, Mute, Dimmer and a reserved one.

## Wi-Fi

**Accept multicast** off means unicast only: send to this Pi's IP address. That is the better choice on Wi-Fi.

## Live status

Below the settings, the live block shows whether a signal is present, who is sending, and the eight values being received.

Read more: [DMX (sACN)](https://github.com/davidwkeith/atmosfx-projector-case/blob/main/pi/README.md#dmx-sacn)
```

`pi/public/help/cooling.md`:

```markdown
# Cooling

VideoFX watches the Pi's own temperature. It does not read the projector's.

## Over-temperature protection

Turn it on, then set two limits:

- **Warning temperature**: the Dashboard shows an alarm.
- **Critical temperature**: playback stops and the projector is switched off. Whether that is a real power cut depends on the projector power mode; with CEC it can only ask the projector to go to standby.

The warning must be below the critical limit, or Apply is refused.

## Resuming

**Cool-down before resuming** is how far below the critical temperature the Pi must fall before it switches back on by itself.

Read more: [Cooling](https://github.com/davidwkeith/atmosfx-projector-case/blob/main/pi/README.md#cooling)
```

`pi/public/help/web-page.md`:

```markdown
# Web page

## Password

Anyone on your network can use this page unless you set a password. It uses basic authentication over plain HTTP, with any user name, so it keeps casual visitors out but does not protect against someone watching the network. The password is stored as a hash and never shown. Changing or removing it needs the current password.

Without a password the page also lets anyone download a backup, which contains the Matter pairing keys.

## Who can reach the page

The page answers only private network addresses. It also checks the host name used, to block DNS rebinding. If you reach the Pi by a name of your own, such as a local DNS record, add it under **Extra host names**.

## Uploads

**Largest upload** caps the size of one uploaded file.

## Pairing code

**Hide the Matter pairing code once paired** keeps the QR code off this page after pairing.

Read more: [Web page security](https://github.com/davidwkeith/atmosfx-projector-case/blob/main/pi/README.md#web-page-security)
```

`pi/public/help/advanced.md`:

```markdown
# Advanced

## Extra mpv options

Extra `--name=value` options for the player, separated by spaces and added after the built-in ones, so they can override them. A common one is `--hwdec=v4l2m2m-copy` if a Pi 3 or Zero 2 W struggles with decoding.

Only decoding, DRM output, scaling, sync, cache, audio-timing and a few filter options are accepted. Everything else is refused, including anything that can read or write files. Wrong options can stop playback; clear the field and apply to go back.

This group is only listed when **Show advanced settings** is on. Other advanced rows live in their own groups.

Read more: [Settings](https://github.com/davidwkeith/atmosfx-projector-case/blob/main/pi/README.md#settings)
```

`pi/public/help/hardware.md`:

```markdown
# Hardware

These values cannot be changed here. Ports need root, and paths would let this page point the service anywhere. To change one, edit `/etc/default/videofx` over SSH and restart the service. Every key is listed in that file, commented.

## What is shown

- The Raspberry Pi model, detected from the board.
- The GPIO pins for the relay, the IR LED and the IR receiver, with the pins reserved for the DigiAMP+.
- The web page and Matter ports, the media folder, the playlist file and the state folder.

Each row's (i) panel names the variable to set.

Read more: [GPIO pins and wiring](https://github.com/davidwkeith/atmosfx-projector-case/blob/main/pi/README.md#gpio-pins-and-wiring)
```

- [ ] **Step 4: Run to verify pass**

Run (sandbox disabled): `cd pi && npx vitest run`
Expected: all suites PASS, including the new help tests. If a README anchor check fails, open `pi/README.md`, find the real heading and correct the link in that page.

- [ ] **Step 5: Check it in the browser**

Run (sandbox disabled, background): `cd pi && node tools/dev-web.mjs`. On each of the six screens press `?` and confirm the sheet shows that screen's page with headings, lists, code and a working "Read more" link. On Settings, check that the page changes with the selected group (Projector, DMX, Cooling and Hardware at least). Open a "Read more" link and confirm it lands on the README heading (open it in the browser pane; GitHub renders pi/README.md). Esc closes the sheet. Stop the server.

- [ ] **Step 6: Commit**

```bash
git add pi/public/help pi/test/help.test.js pi/test/web.test.js
git commit -m "Pi UI: in-page help pages for every screen and settings group

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Docs, version and final verification

**Files:**
- Modify: `pi/README.md`, `CLAUDE.md`, `pi/package.json`, `pi/package-lock.json`, `docs/superpowers/specs/2026-10-13-web-ui-redesign-design.md`

**Interfaces:** none.

- [ ] **Step 1: Update `pi/README.md`**

Run this from the repo root; each replacement is asserted to match exactly once.

```bash
python3 - <<'PY'
p = "pi/README.md"
t = open(p).read()
def rep(old, new):
    global t
    assert t.count(old) == 1, (old, t.count(old))
    t = t.replace(old, new)
rep("handles videos, the playlist, scare clips, the schedule and every setting.",
    "handles videos, the playlist, scare clips, the schedule and every setting. It has six screens (Dashboard, Media, Scares, Schedule, Settings, System), and every screen has a **?** button with help for that screen.")
rep("  public/              web page (plain HTML/CSS/JS)",
    "  public/              web page (plain HTML/CSS/JS); public/help/ holds the in-page help, one Markdown file per screen and settings group")
rep("under Settings > Advanced (not verified)", "under Settings > Advanced (switch on **Show advanced settings** first; not verified)")
rep("Web page > **Quiet hours**: per weekday", "Schedule > **Quiet hours**: per weekday")
rep("Settings > Schedule > Latitude/Longitude", "Schedule > Latitude/Longitude")
rep("web page > Matter > **Reset Matter pairing**", "System > Matter > **Reset Matter pairing**")
rep("Web page > **Backup** > **Download backup**.", "System > **Backup** > **Download backup**.")
rep("On the page: **Learn power button**", "On the page (Settings > Projector, with **Projector power** set to `relay-ir`): **Learn power button**")
rep("Everything is on the web page under **Settings**. Each setting shows its value, where it comes from (*set here* / *from /etc/default/videofx* / *default*), its default, when it takes effect (at once / next play / after a restart), and a **Reset**.",
    "Settings are on the web page: the **Settings** screen holds most of them, and the Scares and Schedule screens hold their own. Each row shows its label and a one-line description; the (i) button shows its value's source (*set here* / *from /etc/default/videofx* / *default*), its default, when it takes effect (at once / next play / after a restart), and a **Reset**. Edits are collected in a bar at the bottom and saved together with **Apply**. **Show advanced settings** reveals rarely needed rows, and the search box finds any setting.")
open(p, "w").write(t)
PY
grep -n "Settings >\|web page >\|Web page >" pi/README.md docs/*.md README.md 2>/dev/null
```

Expected from the grep: only references that are still true (Settings > Playback / Display / DMX / Web page / Cooling / Advanced, and the UniFi Settings > Networks). Fix any other stale path you find.

- [ ] **Step 2: Update `CLAUDE.md`**

```bash
python3 - <<'PY'
p = "CLAUDE.md"
t = open(p).read()
old = "\nToolchain on the owner Mac:"
assert t.count(old) == 1
new = "\nPi web page: plain ES modules in `pi/public/` (hash router, one module per screen in `views/`, DOM-free logic in `nav.js`, `notes.js`, `markdown.js` and the top half of `settings-form.js`). In-page help is `pi/public/help/*.md`, one page per screen and per settings group; `pi/test/help.test.js` fails if a screen or group has none, or a page links to a README heading that does not exist. `node pi/tools/dev-web.mjs` serves the page with a fake device on http://localhost:8080 (run it outside the sandbox).\n" + old
t = t.replace(old, new)
open(p, "w").write(t)
PY
```

- [ ] **Step 3: Bump the version**

```bash
cd pi && grep -rln "0\.8\.3" --include=*.js --include=*.json --include=*.md --include=*.sh . 2>/dev/null | grep -v node_modules; npm version 0.9.0 --no-git-tag-version && git diff --stat package.json package-lock.json
```

Expected: `package.json` and `package-lock.json` change by version lines only. Any other file the grep listed that hard-codes `0.8.3` must be updated too (none expected). The `v0.9.0` tag is created by the owner at release time.

- [ ] **Step 4: Bring the spec in line with the plan**

In `docs/superpowers/specs/2026-10-13-web-ui-redesign-design.md`:

- Section 2: replace "opens a popover with:" with "opens an inline detail panel under the row with:" and the word "popover" elsewhere with "detail panel".
- Section 2, search paragraph: replace "filters rows across all groups by label and help text and ignores the Simple filter." with "filters every non-custom row, including those that live on the Scares and Schedule screens, by label and help text and ignores the Simple filter."
- Section 4 file table: add rows `state.js` ("Shared store, refreshers, subscriptions, dirty registry"), `nav.js` ("Views, group-to-view map, hash parsing, help slugs; pure") and `notes.js` ("Alarms, system notes and nav badges from /api/status; pure"), and change the `settings-form.js` row to end "...pending-changes store (pure) and the row, detail-panel and Apply-bar renderers".
- Section 4 `app.js` row: "Boot: hash router, 3 s status poll, chrome, help sheet" (the store moved to `state.js`).

- [ ] **Step 5: Full automated verification**

Run (sandbox disabled): `cd pi && npx vitest run`
Expected: every suite PASSES.

Run: `ls pi/public/help | wc -l` Expected: `15`.
Run: `grep -rn "style=" pi/public/*.js pi/public/views/*.js pi/public/index.html` Expected: no output (the CSP forbids inline styles).
Run: `grep -rn "Fixed" pi/public pi/src/config.js` Expected: no output.

- [ ] **Step 6: Full manual pass**

Run (sandbox disabled, background): `cd pi && DEV_ALARM=1 node tools/dev-web.mjs`. In the built-in browser:

1. Visit all six screens at 375 px wide (`resize_window` preset `mobile`), then 1000 px (`desktop`), in light and dark (`colorScheme`). No horizontal page scroll, nothing clipped, the Apply bar never covers the bottom nav, the nav dots match the alarms.
2. Read the console after the tour: `read_console_messages` with `onlyErrors`, then again with pattern `Content Security Policy`. Expected: neither shows anything.
3. Restart the server with `DEV_DMX=1`: DMX banner on Dashboard, a one-line strip on every other screen, Play and volume disabled.
4. Restart with `DEV_PASSWORD=1`: the browser asks for a password (`pumpkin`), every module and help page still loads after you sign in, and the "No password" note is gone.
5. Review Focus 5: on Settings make an edit, wait 10 s (three polls), switch to Dashboard, back, toggle Show advanced settings. The edit and the Apply bar survive all of it, and typing in a field is never interrupted by the poll.
6. Press `?` on every screen and on at least three Settings groups; each shows its own page.

Stop the server.

- [ ] **Step 7: Commit**

```bash
git add pi/README.md CLAUDE.md pi/package.json pi/package-lock.json docs/superpowers/specs/2026-10-13-web-ui-redesign-design.md
git commit -m "Pi: document the new web page, bump to 0.9.0

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

## Self-review (done while writing)

**Spec coverage.** Section 1 (six views, nav, badges, DMX strip): Tasks 3, 6, 8-11. Section 2 (sub-nav, rows, (i), Simple/Advanced, search, Apply bar, password card, Hardware, IR): Tasks 2, 5, 7. Section 3 (help sheet, Markdown, route, tests, README and CLAUDE.md pointers): Tasks 1, 4, 6, 12, 13. Section 4 (module layout, state, `web.js`, `config.js`): Tasks 1, 2, 6, 7. Section 5 (tests, error handling, rollout, version): every task's test step, Task 7 failure check, Task 13.

**Verified while planning.** Every code block above was extracted into a scratch copy of `pi/` and run: all 515 vitest tests pass, every module passes `node --check`, and the six screens, the help sheet, the Apply bar, search, the Simple/Advanced switch, DMX and alarm states, dark mode and a 375 px layout were driven in the built-in browser against `tools/dev-web.mjs`. That pass found and fixed five defects in earlier drafts of this plan (an unclosed code fence, a link pattern that split `javascript:alert(1)`, a focus check that blocked the first draw of every settings screen, a doubled label in the Apply error toast, and a missing import in the config test). Not verified: the password prompt with real browser credentials, the Pi hardware, and that the README links resolve on GitHub (the tests only check that each anchor matches a README heading).

**Known gaps, on purpose.** DOM code (router, views, rows) has no automated tests; each has a numbered browser check. The `v0.9.0` tag and the GitHub release are the owner's step.

**Type consistency.** `pending.set(key, value, current)`, `pending.get(key)` returning `{value}` or `{reset: true}`, `effective(key)`, `visibleItems(items, {advanced, query})`, `rowOf(s)`, `mount(root, {sub})` returning `{update, unmount?, helpSlug}` and `parseHash(hash)` returning `{view, sub}` are used with the same names and shapes in every task that mentions them.
