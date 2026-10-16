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
