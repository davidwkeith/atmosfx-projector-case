// Structure of the page, as data. No DOM here, so the tests can import it.

export const VIEWS = [
  { id: "dashboard", title: "Dashboard", icon: "dashboard" },
  { id: "media", title: "Media", icon: "media" },
  { id: "schedule", title: "Schedule", icon: "schedule" },
  { id: "settings", title: "Settings", icon: "settings" },
  { id: "system", title: "System", icon: "system" },
];

// Which view shows each schema group. Key order is the order of the Settings sub-navigation.
export const GROUP_VIEW = {
  Device: "settings",
  Projector: "settings",
  Audio: "dashboard", // volume and mute: the Dashboard slider is their only control
  Display: "settings",
  DMX: "settings",
  Cooling: "settings",
  "Web page": "settings",
  Advanced: "settings",
  Hardware: "settings",
  Playback: "media",
  Scare: "media",
  "Motion sensor": "media",
  Schedule: "schedule",
};

export const groupsOf = (view) => Object.keys(GROUP_VIEW).filter((g) => GROUP_VIEW[g] === view);
export const SETTINGS_GROUPS = groupsOf("settings");
export const groupSlug = (group) => group.toLowerCase().replace(/[^a-z0-9]+/g, "-");

/** One help page per view, except Settings, which has one per group. */
export const helpSlugs = () => [...VIEWS.filter((v) => v.id !== "settings").map((v) => v.id), ...SETTINGS_GROUPS.map(groupSlug)];

export const DOCS_VIEW = "docs";
export const REPO_BLOB = "https://github.com/davidwkeith/atmosfx-projector-case/blob/main/";

/** A doc page name: lower-case words and hyphens. "index" is the contents page. */
export const isDocSlug = (slug) => /^[a-z][a-z0-9-]{0,40}$/.test(slug);

/**
 * Where a Markdown link goes inside the web page. The files are written for GitHub, so links
 * are relative paths from the file ("dmx.md", "../../docs/WIRING.md"): a page of pi/docs becomes
 * the Docs route, any other repository file opens on GitHub, absolute and anchor-only links stay.
 * `dir` is the repository folder holding the file that has the link.
 */
export function docHref(href, dir = "pi/docs") {
  if (/^([a-z][a-z0-9+.-]*:|#|\/)/i.test(href)) return href;
  const [path, frag = ""] = href.split("#");
  const parts = [];
  for (const seg of `${dir}/${path}`.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg && seg !== ".") parts.push(seg);
  }
  const target = parts.join("/");
  const page = /^pi\/docs\/([a-z][a-z0-9-]*)\.md$/.exec(target);
  if (page) return `#/${DOCS_VIEW}/${page[1]}`;
  return REPO_BLOB + target + (frag ? `#${frag}` : "");
}

// Old links: scare mode and the Mode setting used to have their own screen and settings group.
const MOVED = { scares: "media", "settings/playback": "media" };

/** "#/settings/web-page" -> { view: "settings", sub: "web-page" }. Unknown views fall back to the dashboard. */
export function parseHash(hash = "") {
  const path = hash.replace(/^#\/?/, "");
  const [name = "", sub = ""] = (MOVED[path] ?? MOVED[path.split("/")[0]] ?? path).split("/");
  return { view: name === DOCS_VIEW || VIEWS.some((v) => v.id === name) ? name : "dashboard", sub };
}
