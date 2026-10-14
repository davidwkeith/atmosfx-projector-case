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
