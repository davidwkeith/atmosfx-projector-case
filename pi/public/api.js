// Small helpers shared by every module. Nothing here touches the DOM at import time.

export const WRITE = { "x-videofx": "1" }; // required on every write (CSRF guard)

export async function api(path, options = {}) {
  const res = await fetch(path, { ...options, headers: { ...WRITE, ...options.headers } });
  const body = res.headers.get("content-type")?.includes("json") ? await res.json() : null;
  if (!res.ok) throw new Error(body?.error ?? `${res.status} ${res.statusText}`);
  return body;
}

export const json = (method, body) => ({ method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

let toastTimer;
export function toast(message) {
  const node = document.getElementById("toast");
  node.textContent = message;
  node.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (node.hidden = true), 4000);
}

export async function run(fn) {
  try {
    await fn();
  } catch (err) {
    toast(err.message);
  }
}

/** el("div", { className: "x", attrs: { "aria-label": "y" } }, child, "text"). Empty children are skipped. */
export function el(tag, props = {}, ...children) {
  const { attrs, ...rest } = props;
  const node = Object.assign(document.createElement(tag), rest);
  for (const [name, value] of Object.entries(attrs ?? {})) node.setAttribute(name, value);
  node.append(...children.filter((c) => c !== null && c !== undefined && c !== false));
  return node;
}

/** True while a form control inside root has focus. Views skip rebuilding then (the router focuses <main> itself, which does not count). */
export function editing(root) {
  const a = document.activeElement;
  return !!a && a !== root && root.contains(a) && a.matches("input, select, textarea");
}

export function bytes(n) {
  if (n == null) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  while (n >= 1024 && i < units.length - 1) (n /= 1024), i++;
  return `${n.toFixed(i ? 1 : 0)} ${units[i]}`;
}

const ICONS = {
  dashboard: ["M3 3h7v9H3z", "M14 3h7v5h-7z", "M14 12h7v9h-7z", "M3 16h7v5H3z"],
  media: ["M4 4h16v16H4z", "M4 9h16", "M4 15h16", "M9 4v16", "M15 4v16"],
  schedule: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M12 7v5l3 2"],
  settings: ["M4 21v-7", "M4 10V3", "M12 21v-9", "M12 8V3", "M20 21v-5", "M20 12V3", "M1 14h6", "M9 8h6", "M17 16h6"],
  system: ["M5 5h14v14H5z", "M9 9h6v6H9z", "M9 2v3", "M15 2v3", "M9 19v3", "M15 19v3", "M2 9h3", "M2 15h3", "M19 9h3", "M19 15h3"],
  help: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7", "M12 17h.01"],
  info: ["M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", "M12 11v5", "M12 8h.01"],
  close: ["M6 6l12 12", "M18 6 6 18"],
  play: ["M7 4v16l13-8z"],
  pause: ["M8 5v14", "M16 5v14"],
  chevron: ["M9 6l6 6-6 6"],
};

export function icon(name) {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  for (const [k, v] of Object.entries({ viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true", class: "icon-svg" })) {
    svg.setAttribute(k, v);
  }
  for (const d of ICONS[name] ?? []) {
    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", d);
    svg.append(path);
  }
  return svg;
}

export async function restartService() {
  if (!confirm("Restart the service? Playback stops for a few seconds.")) return;
  await api("/api/restart", { method: "POST" });
  toast("Restarting… this page reconnects by itself.");
}
