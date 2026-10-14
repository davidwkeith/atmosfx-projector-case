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
