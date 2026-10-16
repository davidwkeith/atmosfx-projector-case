import { suggestScarePairs } from "/playlist-core.js";
import { el, toast } from "../api.js";
import { advancedShown, advancedToggle, effective, pending, rowOf, safeToRebuild, visibleItems } from "../settings-form.js";
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

/** The scare-mode sections of the Media screen: clips, behaviour, motion sensor. */
export function mountScares(root) {
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
      el("h3", {}, "Scare mode ", el("span", { className: "tag", hidden: true }, "in use")),
      el(
        "p",
        { className: "hint" },
        'A calm clip loops without a gap; on a trigger (the "Scare" switch in your Home app, the motion sensor, DMX, or the Scare now button on the Dashboard) one scare clip plays, then it goes back to the calm clip. Used when Mode is scare.',
      ),
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
    update(s) {
      // Not while someone is typing or choosing; the next update tries again.
      if (!safeToRebuild(root)) return;
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
