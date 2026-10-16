import { describe, expect, it } from "vitest";
import { SETTINGS } from "../src/config.js";
import { GROUP_VIEW, REPO_BLOB, SETTINGS_GROUPS, VIEWS, docHref, groupSlug, groupsOf, helpSlugs, isDocSlug, parseHash } from "../public/nav.js";

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
    expect(SETTINGS_GROUPS).toEqual(["Device", "Projector", "Audio", "Display", "DMX", "Cooling", "Web page", "Advanced", "Hardware"]);
    expect(groupsOf("media")).toEqual(["Playback", "Scare", "Motion sensor"]);
    expect(groupsOf("schedule")).toEqual(["Schedule"]);
  });

  it("makes URL-safe, unique help slugs", () => {
    const slugs = helpSlugs();
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z][a-z0-9-]{0,40}$/);
    expect(groupSlug("Web page")).toBe("web-page");
    expect(slugs).toContain("web-page");
    expect(slugs).not.toContain("settings");
    expect(slugs).toHaveLength(13);
  });

  it.each([
    ["", { view: "dashboard", sub: "" }],
    ["#/media", { view: "media", sub: "" }],
    ["#/settings/web-page", { view: "settings", sub: "web-page" }],
    ["#/nonsense", { view: "dashboard", sub: "" }],
    ["#settings", { view: "settings", sub: "" }],
    ["#/scares", { view: "media", sub: "" }],
    ["#/settings/playback", { view: "media", sub: "" }],
  ])("parses %j", (hash, expected) => expect(parseHash(hash)).toEqual(expected));
});

describe("docs routing", () => {
  it("routes #/docs/<slug>", () => {
    expect(parseHash("#/docs")).toEqual({ view: "docs", sub: "" });
    expect(parseHash("#/docs/dmx")).toEqual({ view: "docs", sub: "dmx" });
  });

  it("accepts only plain slugs", () => {
    for (const ok of ["index", "apple-home", "dmx"]) expect(isDocSlug(ok)).toBe(true);
    for (const bad of ["", "../x", "A", "a/b", "a.md", "-a"]) expect(isDocSlug(bad)).toBe(false);
  });

  it("turns guide links into routes and other repository files into GitHub links", () => {
    expect(docHref("dmx.md")).toBe("#/docs/dmx");
    expect(docHref("projector.md#cec")).toBe("#/docs/projector");
    expect(docHref("../../docs/WIRING.md")).toBe(`${REPO_BLOB}docs/WIRING.md`);
    expect(docHref("../README.md#what-is-verified")).toBe(`${REPO_BLOB}pi/README.md#what-is-verified`);
    expect(docHref("../../docs/dmx.md", "pi/public/help")).toBe("#/docs/dmx");
    expect(docHref("https://example.com/a")).toBe("https://example.com/a");
    expect(docHref("#frag")).toBe("#frag");
    expect(docHref("../../../../etc/passwd")).toBe(`${REPO_BLOB}etc/passwd`);
  });
});
