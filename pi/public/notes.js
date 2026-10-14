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

/** Red dots on the navigation. A missing password belongs to System, not the Dashboard. */
export function badgesOf(st) {
  if (!st) return { dashboard: false, system: false };
  return {
    dashboard: alarmsOf(st).length > 0 || systemNotesOf(st).some((n) => n.id !== "password"),
    system: !!st.version?.available || (!!st.web && !st.web.passwordSet),
  };
}
