import { api, el, icon, json, run, toast } from "../api.js";
import { CHECK_STATUS, alarmsOf, checksSummaryText, systemNotesOf } from "../notes.js";
import { refreshStatus, state } from "../state.js";

// Each tile opens the screen where that part is set up.
function tile(title, href) {
  const value = el("p", { className: "tile-value" }, "–");
  const sub = el("p", { className: "hint tile-sub" });
  return { box: el("a", { className: "tile", href }, el("h3", {}, title), value, sub, icon("chevron")), value, sub };
}

const when = (ms) => new Date(ms).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" });
const clockTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// One row of the setup checks. Problems and "not sure yet" say what to do and link to where.
function checkRow(c) {
  const s = CHECK_STATUS[c.status] ?? CHECK_STATUS.unknown;
  const open = c.status === "fail" || c.status === "unknown";
  return el(
    "li",
    { className: `check ${c.status}` },
    el("span", { className: "check-mark", attrs: { role: "img", "aria-label": s.text } }, s.mark),
    el(
      "div",
      { className: "check-body" },
      el("p", { className: "check-title" }, c.label),
      el("p", { className: "hint" }, c.detail),
      open && (c.fix || c.href) ? el("p", { className: "check-fix" }, c.fix ?? "", c.fix && c.href ? " " : "", c.href ? el("a", { href: c.href }, "Go there") : null) : null,
    ),
  );
}

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

  const projector = tile("Projector", "#/settings/projector");
  const schedule = tile("Schedule", "#/schedule");
  const network = tile("Network", "#/docs/networks"); // Wi-Fi is set in Raspberry Pi Imager, not on this page
  const heat = tile("Pi temperature", "#/settings/cooling");

  const checksSummary = el("p", { className: "hint" });
  const checksList = el("ul", { className: "checks" });
  const runChecks = el("button", { type: "button" }, "Run checks");

  root.append(
    dmx, alarms, notes,
    el("section", {}, el("h3", {}, "Playback"), problem, power, scareNow, scareState),
    el("section", {}, el("h3", {}, "Speaker volume"), volume),
    el("div", { className: "tiles" }, projector.box, schedule.box, network.box, heat.box),
    el("section", {}, el("h3", {}, "Setup checks"), checksSummary, checksList, runChecks),
  );

  // The list itself comes from /api/checks; the status only says when it last changed.
  let checksAt;
  let loadingChecks = false;
  function showChecks(r) {
    checksAt = r?.at ?? null;
    checksSummary.textContent = r?.at
      ? `${checksSummaryText(r.summary)} · checked at ${clockTime(r.at)}`
      : "Not run yet. They run by themselves about 30 seconds after the Pi starts.";
    checksList.replaceChildren(...(r?.checks ?? []).map(checkRow));
  }
  async function loadChecks() {
    if (loadingChecks) return;
    loadingChecks = true;
    try {
      showChecks(await api("/api/checks"));
    } finally {
      loadingChecks = false;
    }
  }
  loadChecks().catch(() => {});
  runChecks.addEventListener("click", () =>
    run(async () => {
      runChecks.disabled = true;
      runChecks.textContent = "Checking…";
      try {
        showChecks(await api("/api/checks", json("POST", {})));
        await refreshStatus();
      } finally {
        runChecks.disabled = false;
        runChecks.textContent = "Run checks";
      }
    }),
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

      if (st.checks !== undefined && (st.checks?.at ?? null) !== checksAt && !runChecks.disabled) loadChecks().catch(() => {});

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
        const fan = t.fan == null ? "" : t.fan ? ", fan on" : ", fan off";
        heat.sub.textContent = t.tripped ? `Stopped: ${t.tripped}` : `OK${fan}`;
      }
    },
  };
}
