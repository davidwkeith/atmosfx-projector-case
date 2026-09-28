import { enabledCount, isMediaFile, moveEntry, suggestScarePairs } from "/playlist-core.js";

const $ = (id) => document.getElementById(id);
const WRITE = { "x-videofx": "1" }; // required on every write (CSRF guard)

let status = null;
let files = []; // [{ name, size }]
let settingsData = null; // /api/settings
let maxUploadBytes = Infinity;
let saved = []; // playlist as on disk
let entries = []; // playlist being edited

// --- helpers

async function api(path, options = {}) {
  const res = await fetch(path, { ...options, headers: { ...WRITE, ...options.headers } });
  const body = res.headers.get("content-type")?.includes("json") ? await res.json() : null;
  if (!res.ok) throw new Error(body?.error ?? `${res.status} ${res.statusText}`);
  return body;
}

const json = (method, body) => ({ method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

let toastTimer;
function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 4000);
}

async function run(fn) {
  try {
    await fn();
  } catch (err) {
    toast(err.message);
  }
}

function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

function bytes(n) {
  if (n == null) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  while (n >= 1024 && i < units.length - 1) (n /= 1024), i++;
  return `${n.toFixed(i ? 1 : 0)} ${units[i]}`;
}

const dirty = () => JSON.stringify(entries) !== JSON.stringify(saved);

// --- status

async function refreshStatus() {
  status = await api("/api/status");
  document.title = status.name;
  $("name").textContent = status.name;

  const pill = $("state");
  pill.textContent = status.playing ? "Playing" : status.on ? "Starting…" : "Off";
  pill.classList.toggle("on", status.on);

  const power = $("power");
  power.disabled = false;
  power.textContent = status.on ? "Stop" : "Play";
  power.classList.toggle("stop", status.on);

  $("problem").hidden = !status.problem || status.on;
  $("problem").textContent = status.problem ? `Can't play: ${status.problem}.` : "";

  renderVolume(status.volume);
  $("restart-banner").hidden = !status.restartNeeded?.length;
  renderLive(status);

  const m = status.matter;
  $("unpaired").hidden = m.commissioned;
  $("paired").hidden = !m.commissioned;
  if (!m.commissioned) {
    // Shown as 1234-567-8901, the way controllers print it.
    $("manual").textContent = m.manualPairingCode?.replace(/^(\d{4})(\d{3})(\d{4})$/, "$1-$2-$3") ?? "";
    if (!$("qr").getAttribute("src")) $("qr").src = `/api/pairing.svg?${Date.now()}`;
  } else {
    $("qr").removeAttribute("src");
    $("fabrics").textContent = `Paired with ${m.fabrics} Matter controller${m.fabrics === 1 ? "" : "s"}.`;
  }
}

// --- volume

function renderVolume(v) {
  if (!v) return;
  const slider = $("volume");
  // Don't yank the slider while someone is dragging it.
  if (document.activeElement !== slider) slider.value = v.level;
  slider.disabled = false;
  $("volume-value").textContent = `${v.level}%`;
  $("mute").disabled = false;
  $("mute").textContent = v.muted ? "Unmute" : "Mute";
  $("mute").setAttribute("aria-pressed", String(v.muted));
  $("volume").closest(".volume").classList.toggle("muted", v.muted);
}

async function setVolume(change) {
  renderVolume((status.volume = await api("/api/volume", json("POST", change))));
}

// --- playlist and media

async function refreshMedia() {
  const data = await api("/api/media");
  const edited = dirty(); // keep unsaved edits across refreshes
  files = data.files;
  saved = data.playlist;
  maxUploadBytes = data.maxUploadBytes ?? Infinity;
  queueMicrotask(() => renderScare());
  if (!edited) entries = structuredClone(saved);
  $("space").textContent =
    `${bytes(data.freeBytes)} free` + (data.maxUploadBytes ? ` · max ${bytes(data.maxUploadBytes)} per file` : "");
  render();
}

function render() {
  const names = new Set(files.map((f) => f.name));

  const list = $("playlist");
  list.replaceChildren(
    ...entries.map((entry, i) => {
      const check = el("input", { type: "checkbox", checked: entry.enabled, title: "Play this item" });
      check.addEventListener("change", () => {
        entries[i].enabled = check.checked;
        render();
      });
      const up = el("button", { type: "button", className: "icon", disabled: i === 0, title: "Move up" }, "↑");
      up.addEventListener("click", () => ((entries = moveEntry(entries, i, i - 1)), render()));
      const down = el("button", { type: "button", className: "icon", disabled: i === entries.length - 1, title: "Move down" }, "↓");
      down.addEventListener("click", () => ((entries = moveEntry(entries, i, i + 1)), render()));
      const remove = el("button", { type: "button", className: "icon", title: "Remove from playlist" }, "✕");
      remove.addEventListener("click", () => (entries.splice(i, 1), render()));
      const missing = !names.has(entry.file);
      const label = el("span", { className: "name" }, entry.file + (missing ? " (missing)" : ""));
      return el("li", { className: [entry.enabled ? "" : "off", missing ? "missing" : ""].join(" ") }, check, label, up, down, remove);
    }),
  );
  $("playlist-empty").hidden = entries.length > 0;

  const inList = new Set(entries.map((e) => e.file));
  $("media").replaceChildren(
    ...files.map((f) => {
      const add = el("button", { type: "button", title: "Add to playlist" }, inList.has(f.name) ? "Add again" : "Add");
      add.addEventListener("click", () => (entries.push({ file: f.name, enabled: true }), render()));
      const del = el("button", { type: "button", className: "icon danger", title: `Delete ${f.name}` }, "🗑");
      del.addEventListener("click", () => deleteFile(f.name));
      return el("li", {}, el("span", { className: "name" }, f.name), el("span", { className: "size" }, bytes(f.size)), add, del);
    }),
  );
  $("media-empty").hidden = files.length > 0;

  $("save").disabled = !dirty();
  $("revert").disabled = !dirty();
}

async function savePlaylist() {
  const data = await api("/api/playlist", json("PUT", { entries }));
  saved = data.playlist;
  entries = structuredClone(saved);
  render();
  toast(enabledCount(saved) ? "Playlist saved." : "Saved, but nothing is checked, so nothing will play.");
  await refreshStatus();
}

async function deleteFile(name) {
  if (!confirm(`Delete ${name} from the Pi? It is also removed from the playlist.`)) return;
  await run(async () => {
    await api(`/api/media/${encodeURIComponent(name)}`, { method: "DELETE" });
    entries = entries.filter((e) => e.file !== name);
    toast(`Deleted ${name}.`);
    await refreshMedia();
  });
}

// XMLHttpRequest because fetch() cannot report upload progress.
function uploadOne(file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", `/api/media/${encodeURIComponent(file.name)}`);
    xhr.setRequestHeader("x-videofx", "1");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      if (xhr.status < 300) return resolve();
      let message = `${xhr.status}`;
      try {
        message = JSON.parse(xhr.responseText).error;
      } catch {}
      reject(new Error(`${file.name}: ${message}`));
    };
    xhr.onerror = () => reject(new Error(`${file.name}: upload failed`));
    xhr.send(file);
  });
}

async function upload(fileList) {
  const picked = [...fileList];
  const bad = picked.filter((f) => (!isMediaFile(f.name) && !/\.m3u8?$/i.test(f.name)) || f.size > maxUploadBytes);
  if (bad.length) toast(`Skipped (not a video, audio or .m3u file, or too big): ${bad.map((f) => f.name).join(", ")}`);
  const good = picked.filter((f) => !bad.includes(f));
  const progress = $("progress");
  const total = good.reduce((n, f) => n + f.size, 0) || 1;
  let done = 0;
  progress.hidden = false;
  try {
    for (const file of good) {
      await uploadOne(file, (p) => (progress.value = (done + p * file.size) / total));
      done += file.size;
    }
    if (good.length) toast(`Uploaded ${good.length} file${good.length === 1 ? "" : "s"}. Add them to the playlist and save.`);
  } catch (err) {
    toast(err.message);
  } finally {
    progress.hidden = true;
    progress.value = 0;
    $("upload").value = "";
    await refreshMedia();
  }
}

// --- settings

const APPLY = {
  live: "Takes effect at once",
  play: "Applies on the next play",
  restart: "Needs a service restart",
  fixed: "Edit /etc/default/videofx over SSH, then restart",
};
const SOURCE = { web: "set here", file: "from /etc/default/videofx", default: "default" };
const NUMBER_KEYS = new Set(["volume", "maxUploadMb", "httpPort", "matterPort"]);
const GROUPS = ["Device", "Playback", "Scare", "Projector", "Motion sensor", "Schedule", "DMX", "Cooling", "Web page", "Audio", "Display", "Advanced", "Fixed"];

const show = (key, v) => (Array.isArray(v) ? v.join(" ") : v === "" ? "(empty)" : String(v));

async function refreshSettings() {
  settingsData = await api("/api/settings");
  renderSettings(settingsData);
  renderScare();
  renderSchedule();
  $("ir-code").value = setting("irPowerCode") ?? "";
}

const setting = (key) => settingsData?.settings.find((s) => s.key === key)?.value;

function renderSettings({ settings, restartNeeded, device }) {
  $("restart-banner").hidden = !restartNeeded?.length;
  const shown = settings.filter((s) => !s.custom); // those have their own sections
  const byGroup = shown.reduce((g, s) => ((g[s.group] ??= []).push(s), g), {});
  const groups = GROUPS.filter((g) => byGroup[g]).map((group) => {
    const rows = byGroup[group].map((s) => (s.key === "password" ? passwordRow(s) : s.apply === "fixed" ? fixedRow(s) : settingRow(s)));
    if (group === "Fixed") {
      rows.unshift(fixedRow({ label: "Raspberry Pi model", value: device?.model ?? "unknown (not a Pi?)", key: "model", apply: "detected" }));
      rows.push(pinTable(settings));
    }
    if (group === "DMX") rows.push(el("div", { id: "dmx-live" }));
    const title = group === "Fixed" ? "Fixed here (root only)" : group;
    const note =
      group === "Fixed"
        ? el("p", { className: "hint" }, "Change these in /etc/default/videofx over SSH, then restart. Ports need root (port 80 and the Bonjour entry); paths would let this page point the service anywhere.")
        : "";
    const box = el("div", { className: "group" }, el("h3", {}, title), note, ...rows);
    if (group === "Advanced") {
      return el(
        "details",
        { className: "group" },
        el("summary", {}, "Advanced"),
        el("p", { className: "warn-box" }, "Wrong VLC arguments can stop playback. Network, control, streaming and scripting options are refused."),
        ...rows,
      );
    }
    return box;
  });
  $("settings").replaceChildren(...groups);
}

function meta(s) {
  const parts = [el("span", { className: `tag ${s.source}` }, SOURCE[s.source] ?? s.source), el("span", {}, APPLY[s.apply] ?? "")];
  if (s.default !== undefined && !s.secret) parts.push(el("span", {}, `Default: ${show(s.key, s.default)}`));
  return el("div", { className: "meta" }, ...parts);
}

function settingRow(s) {
  const id = `set-${s.key}`;
  let input;
  if (s.options) {
    input = el("select", { id }, ...s.options.map((o) => el("option", { value: o, selected: o === s.value }, o)));
  } else if (typeof s.value === "boolean") {
    input = el("input", { id, type: "checkbox", checked: s.value });
  } else {
    input = el("input", {
      id,
      type: NUMBER_KEYS.has(s.key) ? "number" : "text",
      value: show(s.key, s.value) === "(empty)" ? "" : show(s.key, s.value),
      autocomplete: "off",
      spellcheck: false,
    });
    if (NUMBER_KEYS.has(s.key)) input.inputMode = "numeric";
  }
  const read = () => (input.type === "checkbox" ? input.checked : input.type === "number" ? Number(input.value) : input.value);
  const save = el("button", { type: "button", className: "primary" }, "Save");
  save.addEventListener("click", () => run(() => changeSetting("PUT", s, { value: read() })));
  const reset = el("button", { type: "button", disabled: s.source !== "web", title: "Use the file value or the default" }, "Reset");
  reset.addEventListener("click", () => run(() => changeSetting("DELETE", s, {})));
  return el(
    "div",
    { className: "setting" },
    el("label", { className: "title", htmlFor: id }, s.label),
    el("div", { className: "row" }, input, save, reset),
    s.help ? el("p", { className: "hint" }, s.help) : "",
    meta(s),
  );
}

function passwordRow(s) {
  const current = el("input", { type: "password", autocomplete: "current-password", placeholder: "Current password" });
  const next = el("input", { type: "password", autocomplete: "new-password", placeholder: s.isSet ? "New password" : "Password (6+ characters)" });
  const save = el("button", { type: "button", className: "primary" }, s.isSet ? "Change" : "Set password");
  save.addEventListener("click", () =>
    run(async () => {
      await changeSetting("PUT", s, { value: next.value, currentPassword: current.value || undefined });
      toast("Password saved. Your browser will ask for it.");
    }),
  );
  const remove = el("button", { type: "button", className: "danger", disabled: !s.isSet }, "Remove password");
  remove.addEventListener("click", () =>
    run(async () => {
      if (!confirm("Remove the password? Anyone on your network can then use this page.")) return;
      await changeSetting("PUT", s, { value: "", currentPassword: current.value, confirm: true });
    }),
  );
  const reset = el("button", { type: "button", disabled: s.source !== "web" }, "Reset");
  reset.addEventListener("click", () =>
    run(async () => {
      if (!confirm("Go back to the password in /etc/default/videofx? If there is none, the page will have no password.")) return;
      await changeSetting("DELETE", s, { currentPassword: current.value || undefined, confirm: true });
    }),
  );
  return el(
    "div",
    { className: "setting" },
    el("label", { className: "title" }, `${s.label}: ${s.isSet ? "set" : "not set"}`),
    el("div", { className: "row" }, ...(s.isSet ? [current] : []), next),
    el("div", { className: "row", style: "margin-top:8px" }, save, remove, reset),
    s.help ? el("p", { className: "hint" }, s.help) : "",
    meta(s),
  );
}

function fixedRow(s) {
  return el(
    "div",
    { className: "setting" },
    el("span", { className: "title" }, s.label),
    el("div", { className: "fixed-value" }, show(s.key, s.value)),
    s.apply === "detected"
      ? el("div", { className: "meta" }, "Detected from /proc/device-tree/model")
      : el("div", { className: "meta" }, el("span", { className: `tag ${s.source}` }, SOURCE[s.source]), s.env ? `${s.env} in /etc/default/videofx` : ""),
  );
}

async function changeSetting(method, s, body) {
  const res = await api(`/api/settings/${s.key}`, json(method, body));
  toast(res.note ?? (method === "DELETE" ? `${s.label} reset.` : `${s.label} saved.`));
  await Promise.all([refreshSettings(), refreshStatus()]);
}

async function restartService() {
  if (!confirm("Restart the service? Playback stops for a few seconds.")) return;
  await api("/api/restart", { method: "POST" });
  toast("Restarting… this page reconnects by itself.");
}

// --- live status: DMX, alarms, projector, scare, schedule, cooling

function renderLive(st) {
  const dmx = st.dmx ?? {};
  $("dmx-banner").hidden = !dmx.inControl;
  for (const id of ["power", "volume", "mute"]) if (dmx.inControl) $(id).disabled = true;

  const alarms = [...(st.thermal?.enabled ? st.thermal.alarms : []), ...(st.projector?.notice ? [{ level: "warn", text: st.projector.notice }] : [])];
  $("alarm-banner").hidden = alarms.length === 0;
  $("alarm-banner").replaceChildren(...alarms.map((a) => el("p", {}, `${a.level === "critical" ? "⚠ " : ""}${a.text}`)));

  const p = st.player ?? {};
  $("scare-now").hidden = !(st.on && p.mode === "scare");
  const seam = p.lastSeamMs?.toScareMs !== null && p.lastSeamMs?.toScareMs !== undefined ? ` · last seams ${p.lastSeamMs.toScareMs} / ${p.lastSeamMs.toBufferMs ?? "–"} ms` : "";
  $("scare-state").hidden = p.mode !== "scare";
  $("scare-state").textContent = p.scareActive ? "Scare playing…" : p.cooldownLeftMs > 0 ? `Cooling down: ${Math.ceil(p.cooldownLeftMs / 1000)} s${seam}` : `Ready${seam}`;

  const pr = st.projector ?? {};
  const cec = pr.mode === "cec" ? ` · CEC ${pr.cec === "supported" ? "supported" : pr.cec === "no-response" ? "no response (using hdmi-off)" : "not checked yet"}` : "";
  $("projector-state").textContent = `Projector (${pr.mode ?? "?"}): ${pr.power ?? "unknown"}${cec}`;

  const next = st.schedule?.next;
  $("schedule-next").hidden = !st.schedule?.enabled;
  $("schedule-next").textContent = next
    ? `Next: ${next.on ? "on" : "off"} ${new Date(next.at).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })} (${next.label})${dmx.inControl ? " · paused while DMX is in control" : ""}`
    : "Schedule on, but nothing is scheduled in the next week.";

  renderCooling(st.thermal);
  renderDmx(dmx);
}

function renderCooling(t) {
  const table = $("cooling");
  if (!t?.enabled) {
    table.replaceChildren(el("tr", {}, el("td", {}, "Off. Turn on in Settings > Cooling once the fans and sensors are wired.")));
    $("sensor-pick").replaceChildren();
    return;
  }
  const c = (v) => (v === null || v === undefined ? "–" : `${v.toFixed(1)} °C`);
  const rows = [
    ["Projector zone", `${c(t.temps?.[0])} · fan ${t.duty?.[0] ?? "–"}% · ${t.rpm?.[0] ?? "–"} rpm`],
    ["Pi / brick zone", `${c(t.temps?.[1])} · fan ${t.duty?.[1] ?? "–"}% · ${t.rpm?.[1] ?? "–"} rpm`],
    ["State", t.tripped ? `Stopped: ${t.tripped}` : t.cooling ? "Projector fan running on after power-off" : "OK"],
  ];
  table.replaceChildren(...rows.map(([k, v]) => el("tr", {}, el("th", {}, k), el("td", {}, v))));
  // DS18B20 pickers
  if (!settingsData || document.activeElement?.closest?.("#sensor-pick")) return;
  const pick = (key, label) => {
    const current = setting(key) ?? "";
    const ids = [...new Set(["", ...(t.sensors ?? []), current])];
    const select = el("select", { id: `pick-${key}` }, ...ids.map((id) => el("option", { value: id, selected: id === current }, id || "(none)")));
    const save = el("button", { type: "button", className: "primary" }, "Save");
    save.addEventListener("click", () => run(() => changeSetting("PUT", { key, label }, { value: select.value })));
    return el("div", { className: "setting" }, el("label", { className: "title", htmlFor: select.id }, label), el("div", { className: "row" }, select, save));
  };
  $("sensor-pick").replaceChildren(pick("sensorProjector", "Projector-zone sensor"), pick("sensorPi", "Pi-zone sensor"));
}

function renderDmx(dmx) {
  const box = $("dmx-live");
  if (!box) return;
  if (!dmx.enabled) return box.replaceChildren(el("p", { className: "hint" }, "DMX is off."));
  const names = ["Power", "Mode", "Clip", "Trigger", "Volume", "Mute", "Dimmer", "Reserved"];
  const values = dmx.values ? names.map((n, i) => `${n} ${dmx.values[i]}`).join(" · ") : "no data yet";
  box.replaceChildren(
    el("p", { className: "hint" }, dmx.inControl ? "In control." : dmx.live ? "Signal present." : "No signal."),
    el("table", { className: "kv" }, ...(dmx.sources ?? []).map((s) => el("tr", {}, el("th", {}, s.name || "(unnamed)"), el("td", {}, `${s.ip} · priority ${s.priority} · ${s.packetsPerSecond} packets/s`)))),
    el("p", { className: "mono" }, values),
    el("p", { className: "hint" }, `${dmx.rejected ?? 0} packets rejected (malformed / out of sequence).`),
  );
}

function pinTable(settings) {
  const v = Object.fromEntries(settings.map((s) => [s.key, s.value]));
  const rows = [
    ["Amp4 (HiFiBerry)", "GPIO 2, 3 (I2C), 4 (mute), 18-21 (I2S) · reserved"],
    ["PIR sensor in", `GPIO${v.pirPin}`],
    ["Projector relay out", `GPIO${v.relayPin}${v.relayActiveLow ? " (active-low)" : ""}`],
    ["IR LED out", `GPIO${v.irTxPin} (${v.irTxDriver})`],
    ["IR receiver in", `GPIO${v.irRxPin}`],
    ["Projector fan PWM", `GPIO${v.fan1PwmPin} (PWM0)`],
    ["Pi fan PWM", `GPIO${v.fan2PwmPin} (PWM1)`],
    ["Fan tach in", `GPIO${v.fan1TachPin}, GPIO${v.fan2TachPin}`],
    ["1-wire (DS18B20)", `GPIO${v.w1Pin}`],
  ];
  return el("div", { className: "setting" }, el("span", { className: "title" }, "GPIO pins"), el("table", { className: "kv" }, ...rows.map(([k, x]) => el("tr", {}, el("th", {}, k), el("td", {}, x)))));
}

// --- scare clips

let scareDraft = null; // { buffer, clips }

function renderScare(force = false) {
  if (!settingsData) return;
  if (!scareDraft || force) scareDraft = { buffer: setting("scareBuffer") ?? "", clips: [...(setting("scareClips") ?? [])] };
  const names = files.map((f) => f.name);
  const select = $("scare-buffer");
  select.replaceChildren(el("option", { value: "" }, "(choose)"), ...names.map((n) => el("option", { value: n, selected: n === scareDraft.buffer }, n)));
  $("scare-clips").replaceChildren(
    ...names
      .filter((n) => n !== scareDraft.buffer)
      .map((n) => {
        const box = el("input", { type: "checkbox", checked: scareDraft.clips.includes(n) });
        box.addEventListener("change", () => {
          scareDraft.clips = box.checked ? [...scareDraft.clips, n] : scareDraft.clips.filter((c) => c !== n);
        });
        return el("li", {}, box, el("span", { className: "name" }, n));
      }),
  );
}

// --- schedule

const DAY_NAMES = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };

function renderSchedule() {
  const sched = setting("schedule");
  if (!sched || document.activeElement?.closest?.("#h-schedule + *, .sched")) return;
  $("sched-enabled").checked = sched.enabled;
  $("sched-offset").value = sched.sunsetOffsetMin;
  $("sched-days").replaceChildren(
    ...Object.keys(DAY_NAMES).map((d) => {
      const day = sched.days[d];
      const on = el("input", { type: "time", value: day.on === "sunset" ? "" : day.on, disabled: day.on === "sunset" });
      const sun = el("input", { type: "checkbox", checked: day.on === "sunset", title: "On at sunset" });
      sun.addEventListener("change", () => (on.disabled = sun.checked));
      const off = el("input", { type: "time", value: day.off });
      const row = el("tr", {}, el("td", {}, DAY_NAMES[d]), el("td", {}, on), el("td", {}, sun), el("td", {}, off));
      row.dataset.day = d;
      return row;
    }),
  );
  const lat = setting("latitude");
  const lon = setting("longitude");
  $("sched-geo").textContent =
    lat === null || lon === null ? "For sunset, set Latitude and Longitude in Settings > Schedule." : `Sunset for ${lat}, ${lon}. Days with no sunset (polar summer or winter) have no on time.`;
}

async function saveSchedule() {
  const days = {};
  for (const row of $("sched-days").children) {
    const [on, sun, off] = row.querySelectorAll("input");
    days[row.dataset.day] = { on: sun.checked ? "sunset" : on.value, off: off.value };
  }
  const value = { enabled: $("sched-enabled").checked, sunsetOffsetMin: Number($("sched-offset").value || 0), days };
  await changeSetting("PUT", { key: "schedule", label: "Schedule" }, { value });
}

// --- wire up

$("power").addEventListener("click", () =>
  run(async () => {
    $("power").disabled = true;
    await api("/api/power", json("POST", { on: !status.on }));
    await refreshStatus();
  }).finally(() => ($("power").disabled = false)),
);
$("volume").addEventListener("input", (e) => ($("volume-value").textContent = `${e.target.value}%`));
$("volume").addEventListener("change", (e) => run(() => setVolume({ level: Number(e.target.value) })));
$("mute").addEventListener("click", () => run(() => setVolume({ muted: !status.volume.muted })));
$("restart").addEventListener("click", () => run(restartService));
$("scare-now").addEventListener("click", () =>
  run(async () => {
    const r = await api("/api/scare", json("POST", {}));
    toast(r.result === "fired" ? "Scare!" : r.result === "queued" ? "Queued after the current scare." : `Not now: ${r.reason}.`);
    await refreshStatus();
  }),
);
$("scare-buffer").addEventListener("change", (e) => {
  scareDraft.buffer = e.target.value;
  scareDraft.clips = scareDraft.clips.filter((c) => c !== scareDraft.buffer);
  renderScare();
});
$("scare-suggest").addEventListener("click", () => {
  const [best] = suggestScarePairs(files.map((f) => f.name));
  if (!best) return toast('No file with "buffer" in its name. Pick the clips by hand.');
  scareDraft = { buffer: best.buffer, clips: best.scares };
  renderScare();
  toast(`Suggested ${best.buffer} with ${best.scares.length} scare clip${best.scares.length === 1 ? "" : "s"}. Save to use them.`);
});
$("scare-save").addEventListener("click", () =>
  run(async () => {
    await api("/api/settings/scareBuffer", json("PUT", { value: scareDraft.buffer }));
    await api("/api/settings/scareClips", json("PUT", { value: scareDraft.clips }));
    toast("Scare clips saved.");
    await refreshSettings();
    renderScare(true);
  }),
);
$("sched-save").addEventListener("click", () => run(saveSchedule));
$("ir-learn").addEventListener("click", () =>
  run(async () => {
    $("ir-learn").disabled = true;
    toast("Press the remote's power button at the receiver (15 s)…");
    try {
      const { code } = await api("/api/ir/learn", json("POST", {}));
      $("ir-code").value = code;
      toast(`Learned ${code}. Send test, then Save.`);
    } finally {
      $("ir-learn").disabled = false;
    }
  }),
);
$("ir-test").addEventListener("click", () =>
  run(async () => {
    await api("/api/ir/test", json("POST", { code: $("ir-code").value.trim() }));
    toast("Sent.");
  }),
);
$("ir-save").addEventListener("click", () => run(() => changeSetting("PUT", { key: "irPowerCode", label: "IR code" }, { value: $("ir-code").value.trim() })));
$("restart-now").addEventListener("click", () => run(restartService));
$("save").addEventListener("click", () => run(savePlaylist));
$("revert").addEventListener("click", () => ((entries = structuredClone(saved)), render()));
$("upload").addEventListener("change", (e) => upload(e.target.files));
$("reset").addEventListener("click", () =>
  run(async () => {
    if (prompt('This unpairs the device from all controllers. Type "reset" to confirm.') !== "reset") return;
    await api("/api/matter/reset", json("POST", { confirm: "reset" }));
    toast("Resetting. The pairing code appears here in a few seconds.");
  }),
);
window.addEventListener("beforeunload", (e) => dirty() && e.preventDefault());

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
poll();
