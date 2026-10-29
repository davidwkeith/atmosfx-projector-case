import { api, el, json, restartService, run, toast } from "../api.js";
import { chart, peak } from "../health.js";
import { lastUpdateNote, systemNotesOf, upgradeFinished } from "../notes.js";
import { refreshStatus } from "../state.js";

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

  // --- health log: the last 24 h from /api/health, refreshed every minute
  const healthSummary = el("p", { className: "hint" });
  const healthChart = el("div", { className: "health-chart" });
  const healthEvents = el("ul", { className: "health-events" });
  const loadHealth = () =>
    api("/api/health?hours=24")
      .then(drawHealth)
      .catch(() => {});
  const healthTimer = setInterval(loadHealth, 60_000);
  loadHealth();

  function drawHealth({ samples, events, warnC, critC }) {
    const w = 600;
    const h = 160;
    const c = chart(samples, { to: Date.now(), hours: 24, w, h });
    const svg = (tag, attrs, ...kids) => {
      const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
      for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
      node.append(...kids);
      return node;
    };
    const hLine = (temp, cls) => svg("line", { x1: 0, x2: w, y1: c.y(temp), y2: c.y(temp), class: cls });
    const label = (temp) => svg("text", { x: 4, y: c.y(temp) - 3, class: "axis" }, `${temp} °C`);
    healthChart.replaceChildren(
      svg(
        "svg",
        { viewBox: `0 0 ${w} ${h + 22}`, role: "img", "aria-label": "Pi temperature over the last 24 hours" },
        ...c.fan.map(([a, b]) => svg("rect", { x: a, y: h + 2, width: Math.max(1, b - a), height: 6, class: "fan" })),
        ...c.throttle.map((t) => svg("line", { x1: t.x, x2: t.x, y1: 0, y2: h, class: t.underVoltage ? "uv" : "thr" })),
        ...(warnC ? [hLine(warnC, "warn-line"), label(warnC)] : []),
        ...(critC ? [hLine(critC, "crit-line"), label(critC)] : []),
        label(50),
        ...[0, 6, 12, 18, 24].map((ago) =>
          svg("text", { x: w - (ago / 24) * w, y: h + 20, class: "axis", "text-anchor": ago === 0 ? "end" : ago === 24 ? "start" : "middle" }, ago ? `${ago} h ago` : "now"),
        ),
        ...c.lines.map((points) => svg("polyline", { points, class: "soc" })),
      ),
    );
    const top = peak(samples);
    healthSummary.textContent = samples.length
      ? `Pi temperature, last 24 h${top ? `: peak ${top.soc.toFixed(1)} °C at ${new Date(top.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}. Bar underneath: fan on. Red marks: under-voltage; amber: throttled.`
      : "No samples yet: the first one is written a minute after the service starts.";
    const recent = events.slice(-20).reverse();
    healthEvents.replaceChildren(
      ...(recent.length
        ? recent.map((e) => el("li", { className: e.lv }, el("time", {}, new Date(e.t).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })), " ", e.ev))
        : [el("li", { className: "hint" }, "Nothing logged in the last 24 hours.")]),
    );
  }

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
  const lastUpdate = el("div", { hidden: true });
  const restart = el("button", { type: "button" }, "Restart now");
  const checkNow = el("button", { type: "button" }, "Check now");
  const needsPassword = el("p", { className: "warn" }, "Set a page password (Settings > Web page) to upgrade from here, or run \"sudo videofx-update\" on the Pi.");
  const upgradeGo = el("button", { type: "button", className: "primary" }, "Upgrade now");
  const upgradeTitle = el("summary", {}, "Upgrade");
  const upgradePanel = el(
    "details",
    { className: "upgrade", hidden: true },
    upgradeTitle,
    el("p", {}, "Playback stops while the Pi installs the new version and reboots (twice when the power-cut protection is on). This page reconnects by itself. The old version is kept for a rollback."),
    needsPassword,
    upgradeGo,
  );

  root.append(
    el("section", {}, el("h3", {}, "Matter"), unpaired, paired),
    el(
      "section",
      {},
      el("h3", {}, "Health log"),
      healthSummary,
      healthChart,
      healthEvents,
      el("div", { className: "actions" }, el("a", { className: "button", href: "/api/health.csv", download: "" }, "Download CSV (all samples)")),
    ),
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
      lastUpdate,
      notes,
      upgradePanel,
      el("div", { className: "actions" }, checkNow),
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
  checkNow.addEventListener("click", () =>
    run(async () => {
      checkNow.disabled = true;
      try {
        await api("/api/update/check", json("POST", {}));
        toast("Checked GitHub.");
        await refreshStatus();
      } finally {
        checkNow.disabled = false;
      }
    }),
  );
  let latest = null;
  let lastAt = null;
  upgradeGo.addEventListener("click", () =>
    run(async () => {
      upgradeGo.disabled = true;
      const target = latest;
      const before = lastAt;
      try {
        await api("/api/update/upgrade", json("POST", {}));
      } catch (err) {
        upgradeGo.disabled = false;
        throw err;
      }
      showUpgrading(target);
      waitForReturn(target, before);
    }),
  );

  /** Covers the whole page: nothing on it works while the Pi installs and reboots. */
  function showUpgrading(target) {
    document.body.append(
      el(
        "div",
        { className: "upgrading", role: "status", "aria-live": "polite" },
        el("div", { className: "spinner", "aria-hidden": "true" }),
        el("p", {}, target ? `Upgrading to version ${target}` : "Upgrading"),
      ),
    );
  }

  /**
   * The Pi goes away while it installs: reload once it answers again after a gap,
   * or as soon as the status shows the new version or a finished (or failed) run.
   */
  function waitForReturn(target, before) {
    let wasDown = false;
    const timer = setInterval(async () => {
      try {
        const res = await fetch("/api/status", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        if (wasDown || upgradeFinished(await res.json(), { target, before })) {
          clearInterval(timer);
          location.reload();
        }
      } catch {
        wasDown = true;
      }
    }, 5000);
  }

  return {
    helpSlug: () => "system",
    unmount: () => clearInterval(healthTimer),
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
          ? `VideoFX ${v.version}${v.sha ? ` (${v.sha})` : ""} · update available: ${v.latest}.`
          : `VideoFX ${v.version}${v.sha ? ` (${v.sha})` : ""}${v.checkedAt ? ` · up to date as of ${new Date(v.checkedAt).toLocaleDateString()}` : ""}`
        : "";
      upgradePanel.hidden = !v?.available;
      // Upgrading is gated by the page password: without one, anyone on the LAN could press it.
      needsPassword.hidden = Boolean(st.web?.passwordSet);
      upgradeGo.hidden = !st.web?.passwordSet;
      latest = v?.latest ?? null;
      lastAt = v?.last?.at ?? null;
      upgradeTitle.textContent = v?.available ? `Upgrade to ${v.latest}` : "Upgrade";
      if (v?.error) version.textContent += ` · last check failed: ${v.error}`;
      const last = lastUpdateNote(v?.last);
      lastUpdate.hidden = !last;
      // Rebuilt only when the record changes, so an open log stays open across status polls.
      const lastKey = JSON.stringify(v?.last ?? null);
      if (last && lastKey !== lastUpdate.dataset.key) {
        lastUpdate.dataset.key = lastKey;
        const parts = [el("p", { className: last.level === "warn" ? "warn" : "hint" }, last.text)];
        // The end of the update's log: enough to see why it failed without SSH.
        if (last.level === "warn" && v.last.tail?.length) {
          parts.push(el("details", {}, el("summary", {}, "End of the update log"), el("pre", { className: "log" }, v.last.tail.join("\n"))));
        }
        lastUpdate.replaceChildren(...parts);
      }
      const list = systemNotesOf(st);
      notes.replaceChildren(...(list.length ? list.map((n) => el("p", { className: "warn" }, n.text)) : [el("p", { className: "hint" }, "No storage, clock or password problems.")]));
    },
  };
}
