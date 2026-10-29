import { el } from "../api.js";
import { advancedShown, effective, locateCard, pending, rowOf, safeToRebuild, visibleItems } from "../settings-form.js";
import { setting, state } from "../state.js";
import { sunsetTimes } from "../sun.js";

const DAY_NAMES = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };
const has = (v) => v !== null && v !== undefined && v !== "";

export function mount(root) {
  let lastSettings = null;

  // weekly schedule
  const schedEnabled = el("input", { type: "checkbox" });
  const sunOffset = el("input", { type: "number", min: -180, max: 240, step: 5, inputMode: "numeric", id: "sched-offset" });
  const schedDays = el("tbody");
  const geo = el("p", { className: "hint" });
  const place = el("div", {}); // latitude and longitude rows

  // quiet hours
  const quietEnabled = el("input", { type: "checkbox" });
  const quietCap = el("input", { type: "number", min: 0, max: 100, step: 1, inputMode: "numeric", id: "quiet-cap" });
  const quietNoScares = el("input", { type: "checkbox" });
  const quietDmx = el("input", { type: "checkbox" });
  const quietDays = el("tbody");

  root.append(
    el(
      "section",
      {},
      el("h3", {}, "Weekly schedule"),
      el("p", { className: "hint" }, "Times are local to the Pi. An off time earlier than the on time means after midnight. The schedule only acts at these times: switching on or off by hand holds until the next one."),
      el("label", { className: "check" }, schedEnabled, "Use the schedule"),
      el("table", { className: "sched" }, el("thead", {}, el("tr", {}, el("th", {}, "Day"), el("th", {}, "On"), el("th", {}, "At sunset"), el("th", {}, "Off"))), schedDays),
      el("label", { className: "title", htmlFor: "sched-offset" }, "Sunset offset (minutes, - is before)"),
      sunOffset,
      geo,
      place,
    ),
    el(
      "section",
      {},
      el("h3", {}, "Quiet hours"),
      el("p", { className: "hint" }, "While quiet, the volume is capped (0 mutes) and scares can be off, whoever asks: this page, Home, the schedule, the motion sensor. An end earlier than the start runs past midnight."),
      el("label", { className: "check" }, quietEnabled, "Use quiet hours"),
      el("table", { className: "sched" }, el("thead", {}, el("tr", {}, el("th", {}, "Day"), el("th", {}, "From"), el("th", {}, "Until"))), quietDays),
      el("label", { className: "title", htmlFor: "quiet-cap" }, "Volume cap (%)"),
      quietCap,
      el("label", { className: "check" }, quietNoScares, "No scares during quiet hours"),
      el("label", { className: "check" }, quietDmx, "DMX ignores quiet hours"),
    ),
  );

  function collectSchedule() {
    const days = {};
    for (const row of schedDays.children) {
      const [on, sun, off] = row.querySelectorAll("input");
      days[row.dataset.day] = { on: sun.checked ? "sunset" : on.value, off: off.value };
    }
    return { enabled: schedEnabled.checked, sunsetOffsetMin: Number(sunOffset.value || 0), days };
  }
  function collectQuiet() {
    const days = {};
    for (const row of quietDays.children) {
      const [start, end] = row.querySelectorAll("input");
      days[row.dataset.day] = { start: start.value, end: end.value };
    }
    return { enabled: quietEnabled.checked, volumeCap: Number(quietCap.value || 0), disableScares: quietNoScares.checked, dmxBypass: quietDmx.checked, days };
  }
  const scheduleEdited = () => pending.set("schedule", collectSchedule(), setting("schedule"));
  const quietEdited = () => pending.set("quietHours", collectQuiet(), setting("quietHours"));

  sunOffset.addEventListener("input", () => drawSunsetLabels());
  for (const control of [schedEnabled, sunOffset]) {
    control.addEventListener("input", scheduleEdited);
    control.addEventListener("change", scheduleEdited);
  }
  for (const control of [quietEnabled, quietCap, quietNoScares, quietDmx]) {
    control.addEventListener("input", quietEdited);
    control.addEventListener("change", quietEdited);
  }

  function drawSchedule() {
    const sched = effective("schedule");
    if (!sched) return;
    schedEnabled.checked = sched.enabled;
    sunOffset.value = sched.sunsetOffsetMin;
    schedDays.replaceChildren(
      ...Object.keys(DAY_NAMES).map((d) => {
        const day = sched.days[d];
        // a disabled, empty time input reads as a greyed placeholder time (Safari shows the
        // current time), so sunset days show the word instead of the field
        const on = el("input", { type: "time", value: day.on === "sunset" ? "" : day.on, hidden: day.on === "sunset", attrs: { "aria-label": `${DAY_NAMES[d]} on` } });
        const atSunset = el("span", { className: "sunset", hidden: day.on !== "sunset" });
        const sun = el("input", { type: "checkbox", checked: day.on === "sunset", title: "On at sunset", attrs: { "aria-label": `${DAY_NAMES[d]} on at sunset` } });
        sun.addEventListener("change", () => {
          on.hidden = sun.checked;
          atSunset.hidden = !sun.checked;
        });
        const off = el("input", { type: "time", value: day.off, attrs: { "aria-label": `${DAY_NAMES[d]} off` } });
        const row = el("tr", {}, el("td", {}, DAY_NAMES[d]), el("td", {}, on, atSunset), el("td", {}, sun), el("td", {}, off));
        row.dataset.day = d;
        row.addEventListener("input", scheduleEdited);
        row.addEventListener("change", scheduleEdited);
        return row;
      }),
    );
    drawSunsetLabels();
  }

  // each sunset day shows its next on time, worked out like the Pi does, in the Pi's time zone
  function drawSunsetLabels() {
    const n = Number(sunOffset.value || 0);
    const what = n ? `sunset ${n > 0 ? "+" : "\u2212"}${Math.abs(n)} min` : "sunset";
    const lat = Number(effective("latitude"));
    const lon = Number(effective("longitude"));
    const located = has(effective("latitude")) && has(effective("longitude")) && Number.isFinite(lat) && Number.isFinite(lon);
    const times = located ? sunsetTimes(new Date(), { lat, lon, offsetMin: n, timeZone: state.status?.clock?.timeZone }) : {};
    for (const row of schedDays.children) {
      const span = row.querySelector(".sunset");
      if (!located) span.textContent = what[0].toUpperCase() + what.slice(1);
      else if (times[row.dataset.day] === null) span.textContent = "No sunset";
      else span.textContent = `${times[row.dataset.day]} (${what})`;
    }
  }

  function drawQuiet() {
    const qh = effective("quietHours");
    if (!qh) return;
    quietEnabled.checked = qh.enabled;
    quietCap.value = qh.volumeCap;
    quietNoScares.checked = qh.disableScares;
    quietDmx.checked = qh.dmxBypass;
    quietDays.replaceChildren(
      ...Object.keys(DAY_NAMES).map((d) => {
        const start = el("input", { type: "time", value: qh.days[d].start, attrs: { "aria-label": `${DAY_NAMES[d]} from` } });
        const end = el("input", { type: "time", value: qh.days[d].end, attrs: { "aria-label": `${DAY_NAMES[d]} until` } });
        const row = el("tr", {}, el("td", {}, DAY_NAMES[d]), el("td", {}, start), el("td", {}, end));
        row.dataset.day = d;
        row.addEventListener("input", quietEdited);
        row.addEventListener("change", quietEdited);
        return row;
      }),
    );
  }

  function drawPlace() {
    const data = state.settings;
    if (!data) return;
    place.replaceChildren(...visibleItems(data.settings.filter((s) => s.group === "Schedule"), { advanced: advancedShown(), query: "" }).map(rowOf), locateCard());
  }

  function updateGeo() {
    const lat = effective("latitude");
    const lon = effective("longitude");
    drawSunsetLabels();
    geo.textContent = has(lat) && has(lon) ? `Sunset for ${lat}, ${lon}. Days with no sunset (polar summer or winter) have no on time.` : "For sunset, set Latitude and Longitude below.";
  }
  const offPending = pending.subscribe(updateGeo);

  return {
    helpSlug: () => "schedule",
    unmount: offPending,
    update(s) {
      drawSunsetLabels(); // the Pi's time zone comes with the status
      if (s.settings === lastSettings || !safeToRebuild(root)) return; // not under someone who is typing
      lastSettings = s.settings;
      drawSchedule();
      drawQuiet();
      drawPlace();
      updateGeo();
    },
  };
}
