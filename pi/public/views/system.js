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
