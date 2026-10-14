import { api } from "./api.js";

// One object for what the Pi last told us. Views read it in update() and never keep their own copy of it.
export const state = { status: null, media: null, settings: null };

const subs = new Set();
export const subscribe = (fn) => (subs.add(fn), () => subs.delete(fn));
function emit() {
  for (const fn of subs) {
    try {
      fn(state);
    } catch (err) {
      console.error(err); // one broken view must not stop the others updating
    }
  }
}

export async function refreshStatus() {
  state.status = await api("/api/status");
  emit();
}
export async function refreshMedia() {
  state.media = await api("/api/media");
  emit();
}
export async function refreshSettings() {
  state.settings = await api("/api/settings");
  emit();
}

/** Retry what the first load missed (a Pi that was slow or briefly unreachable). Quiet: the status poll already reports an unreachable Pi. */
export async function ensureLoaded() {
  const missing = [];
  if (!state.settings) missing.push(refreshSettings());
  if (!state.media) missing.push(refreshMedia());
  await Promise.allSettled(missing);
}

export const setting = (key) => state.settings?.settings.find((s) => s.key === key)?.value;

// Anything holding unsaved edits registers here; the page warns before it is closed.
const dirtyChecks = new Set();
export const onDirtyCheck = (fn) => dirtyChecks.add(fn);
export const isDirty = () => [...dirtyChecks].some((fn) => fn());

/** Ask the router to rebuild the current view (the Simple/Advanced switch, Discard). */
export const remount = () => window.dispatchEvent(new Event("videofx:remount"));
