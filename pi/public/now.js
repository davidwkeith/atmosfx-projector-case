// The now-playing header on every screen: poster frame, clip, elapsed time and a Play/Pause
// button (Play switches on when off; while on, it freezes the current frame with the projector
// still on). Tapping the rest of it goes to the Dashboard. The functions at the top are
// DOM-free so the tests can import them.

/** 75 -> "1:15", 3725 -> "1:02:05". */
export function clock(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** "ghost-scare-1.mp4" -> "ghost-scare-1". */
export const clipTitle = (file) => file.replace(/\.[a-z0-9]{2,4}$/i, "");

/**
 * Where the clip is now: the Pi's position plus the time since the status arrived, so the
 * clock runs between polls. Held at the end until the next poll shows the next clip or loop.
 */
export function elapsed(now, sinceMs) {
  const pos = now.position + Math.max(0, sinceMs) / 1000;
  return now.duration ? Math.min(pos, now.duration) : pos;
}

/** Everything the header shows, from a status. */
export function nowView(st, sinceMs) {
  const now = st?.on ? st.now : null;
  const locked = !!st?.dmx?.inControl;
  const paused = !!(st?.on && st.player?.paused);
  // action: what a tap does. "power" switches on; "pause"/"resume" only while something plays.
  const action = !st?.on ? "power" : paused ? "resume" : "pause";
  const toggle = {
    action,
    icon: action === "pause" ? "pause" : "play",
    label: { power: "Play", pause: "Pause", resume: "Resume" }[action],
    disabled: !st || locked || (st.on && !now),
  };
  if (!now) {
    const title = !st ? "Connecting…" : st.on ? "Starting…" : st.problem ? `Can't play: ${st.problem}` : "Nothing playing";
    return { title, time: "", progress: null, poster: null, toggle };
  }
  const t = elapsed(now, paused ? 0 : sinceMs); // the clock stands still while paused
  const scare = paused ? " · paused" : st.player?.scareActive ? " · scare" : "";
  return {
    title: clipTitle(now.file),
    time: (now.duration ? `${clock(t)} / ${clock(now.duration)}` : clock(t)) + scare,
    progress: now.duration ? t / now.duration : null,
    poster: `/api/poster/${encodeURIComponent(now.file)}`,
    toggle,
  };
}

export function mountNowBar({ icon, api, json, run, refreshStatus, state }) {
  const $ = (id) => document.getElementById(id);
  const img = $("now-poster");
  const placeholder = $("now-placeholder");
  const toggle = $("now-toggle");
  placeholder.append(icon("media"));
  const play = icon("play");
  const pause = icon("pause");
  toggle.append(play, pause);

  let shown = null; // status the clock counts from
  let received = 0;
  let posterSrc = null;

  img.addEventListener("load", () => ((img.hidden = false), (placeholder.hidden = true)));
  img.addEventListener("error", () => ((img.hidden = true), (placeholder.hidden = false)));

  toggle.addEventListener("click", () =>
    run(async () => {
      const { action } = nowView(state.status, 0).toggle;
      toggle.disabled = true;
      try {
        if (action === "power") await api("/api/power", json("POST", { on: true }));
        else await api("/api/pause", json("POST", { paused: action === "pause" }));
        await refreshStatus();
      } finally {
        render();
      }
    }),
  );

  function render() {
    const st = state.status;
    if (st !== shown) ((shown = st), (received = performance.now()));
    const v = nowView(st, performance.now() - received);
    $("now-title").textContent = v.title;
    $("now-elapsed").textContent = v.time;
    $("now-progress").parentElement.hidden = v.progress === null;
    $("now-progress").style.width = `${Math.round((v.progress ?? 0) * 1000) / 10}%`;
    if (v.poster !== posterSrc) {
      posterSrc = v.poster;
      img.hidden = true;
      placeholder.hidden = false;
      if (v.poster) img.src = v.poster;
      else img.removeAttribute("src");
    }
    toggle.disabled = v.toggle.disabled;
    toggle.setAttribute("aria-label", v.toggle.label);
    toggle.title = v.toggle.label;
    toggle.classList.toggle("on", v.toggle.icon === "pause");
    play.style.display = v.toggle.icon === "play" ? "" : "none";
    pause.style.display = v.toggle.icon === "pause" ? "" : "none";
  }

  setInterval(() => document.visibilityState === "visible" && render(), 1000);
  return { update: render };
}
