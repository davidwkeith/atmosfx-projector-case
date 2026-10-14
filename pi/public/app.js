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
