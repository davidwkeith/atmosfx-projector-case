// What the status endpoint says is wrong or noteworthy. Pure functions of /api/status.

export function alarmsOf(st) {
  return [
    ...(st.thermal?.enabled ? (st.thermal.alarms ?? []) : []),
    ...(st.projector?.notice ? [{ level: "warn", text: st.projector.notice }] : []),
  ];
}

export function systemNotesOf(st) {
  const notes = [];
  const sto = st.storage;
  if (sto && (sto.maintenance || !sto.dataMounted)) {
    notes.push(
      sto.maintenance
        ? {
            id: "maintenance",
            text: `Maintenance mode: the system is writable${sto.rebootPending ? " (protection returns after a reboot)" : ""}. A power cut now can damage the SD card. Run "sudo videofx-maint off" when done.`,
          }
        : { id: "data", text: "The data partition is not mounted: settings and videos may not survive a restart." },
    );
  }
  if (sto?.state && sto.state !== "ok") notes.push({ id: "power", text: `Power-cut protection: ${sto.state}.` });
  if (st.web && !st.web.passwordSet) {
    notes.push({ id: "password", text: "No password: anyone on this network can control VideoFX and download its pairing keys. Set one in Settings > Web page." });
  }
  if (st.clock && !st.clock.synced) {
    notes.push({ id: "clock", text: "Time not synced yet: the schedule and sunset wait until the Pi has the correct time from the network." });
  }
  return notes;
}

/** How each setup check status reads on the dashboard. */
export const CHECK_STATUS = {
  pass: { mark: "✓", text: "OK" },
  fail: { mark: "✕", text: "Problem" },
  unknown: { mark: "?", text: "Not sure yet" },
  off: { mark: "–", text: "Not used" },
};

/** "8 OK · 1 problem · 1 to confirm", from the setup checks' summary; null before the first run. */
export function checksSummaryText(summary) {
  if (!summary) return null;
  const parts = [`${summary.pass} OK`];
  if (summary.fail) parts.push(`${summary.fail} problem${summary.fail === 1 ? "" : "s"}`);
  if (summary.unknown) parts.push(`${summary.unknown} to confirm`);
  if (summary.off) parts.push(`${summary.off} not used`);
  return parts.join(" · ");
}

/** Red dots on the navigation. A missing password belongs to System, not the Dashboard. */
export function badgesOf(st) {
  if (!st) return { dashboard: false, system: false };
  return {
    dashboard: alarmsOf(st).length > 0 || systemNotesOf(st).some((n) => n.id !== "password") || st.checks?.fail > 0,
    system: !!st.version?.available || (!!st.web && !st.web.passwordSet),
  };
}

// A run still "running" this long after its last step stopped without saying why
// (power cut, killed): the slowest step, npm ci on a Pi 3, takes about 15 minutes.
export const UPDATE_STALE_MS = 60 * 60 * 1000;

/**
 * One line about the last videofx-update run (st.version.last), for the Software
 * section: {level: "ok"|"warn"|"info", text}, or null when no run is recorded.
 */
export function lastUpdateNote(last, now = Date.now()) {
  if (!last) return null;
  const when = last.at ? new Date(last.at) : null;
  const at = when && !Number.isNaN(when.getTime()) ? ` (${when.toLocaleString()})` : "";
  const why = last.message ? `: ${last.message}` : "";
  switch (last.state) {
    case "done":
      return { level: "ok", text: `Last update finished${at}${why}.` };
    case "up-to-date":
      return { level: "ok", text: `Last update had nothing to do${at}${why}.` };
    case "failed":
      return { level: "warn", text: `Last update FAILED and the previous version was put back${at}${why}.` };
    case "stopped":
      return { level: "warn", text: `Last update stopped early, nothing was installed${at}${why}.` };
    case "running":
      return when && now - when.getTime() > UPDATE_STALE_MS
        ? { level: "warn", text: `Last update never finished${at}; its last step was${why || " unknown"}.` }
        : { level: "info", text: `Update in progress${at}${why}.` };
    default:
      return null;
  }
}

/**
 * Whether an upgrade to version `target` has finished, from a fresh /api/status: the
 * new version answers, or videofx-update recorded an outcome (done, failed, stopped,
 * up-to-date) other than the one on record when the button was pressed (`before`,
 * that record's `at`; compared as-is so the Pi's and browser's clocks never meet).
 */
export function upgradeFinished(st, { target, before }) {
  const v = st?.version;
  if (!v) return false;
  if (target && v.version === target) return true;
  const last = v.last;
  return !!last?.state && last.state !== "running" && (last.at ?? null) !== (before ?? null);
}
