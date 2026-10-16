import { api, editing, el, icon, json, run, toast } from "./api.js";
import { onDirtyCheck, refreshSettings, refreshStatus, remount, setting, state } from "./state.js";
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

// --- DOM half

export const pending = createPending();
onDirtyCheck(() => pending.count > 0);

/**
 * May a view rebuild its rows now? Not while someone is typing with edits waiting. Once nothing is pending (Apply
 * succeeded, or Discard), yes even if a tapped control still has focus: phones do not move focus to a tapped button.
 */
export const safeToRebuild = (root) => !editing(root) || pending.count === 0;

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
    ...(s.help ? [el("p", { className: "hint" }, s.help)] : []), // native append(): a null child would print "null"
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
    ["Pi fan out (gpio-fan)", `GPIO${v.fanPin}, on at ${v.fanOnC} °C`],
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
