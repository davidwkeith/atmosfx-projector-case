// THROWAWAY: Pi 3 feasibility spike for the phone fit (BRINGUP row 11a). Delete
// this once the fit is proven on the Pi. It imports only Node builtins and
// ../src/{fit-math,fit-shader,mpv}.js, so a plain copy of pi/src and pi/tools works.
//
// On the Pi (service stopped, as the service user, projector on):
//   scp -r pi/src pi/tools <user>@videofx-xxxx.local:fit-spike/      (from your Mac)
//   sudo systemctl stop videofx-player
//   node fit-spike/tools/fit-spike.mjs CLIP --mode none     [--minutes 10] [--yes]
//   node fit-spike/tools/fit-spike.mjs CLIP --mode shader --variant gpu       (the Pi's current VO)
//   node fit-spike/tools/fit-spike.mjs CLIP --mode shader --variant gpu-next
//   node fit-spike/tools/fit-spike.mjs CLIP --mode lavfi
// Run `none` first: it writes /tmp/fit-spike-none.json, the drop baseline.
// Each run prints a labelled report and writes /tmp/fit-spike-<mode>[-<variant>].json. Paste the report back.
// --yes (or no TTY) skips the questions and records null for the answers.
// FIT_SPIKE_EXTRA="--vo=null ..." appends mpv args (laptop smoke test only).

import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { performance } from "node:perf_hooks";
import { defaultFit } from "../src/fit-math.js";
import { fitShader, fitShaderOpts, SHADER_DESC } from "../src/fit-shader.js";
import { MpvIpc, mpvArgs } from "../src/mpv.js";

// ---- arguments ----
const argv = process.argv.slice(2);
let clip = null;
let mode = "shader";
let variant = "gpu";
let minutes = 10;
let yes = false;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--mode") mode = argv[++i];
  else if (a === "--variant") variant = argv[++i];
  else if (a === "--minutes") minutes = Number(argv[++i]);
  else if (a === "--yes") yes = true;
  else if (!a.startsWith("--") && !clip) clip = a;
  else usage();
}
function usage() {
  console.error("usage: node tools/fit-spike.mjs CLIP [--mode shader|none|lavfi] [--variant gpu|gpu-next] [--minutes 10] [--yes]");
  process.exit(2);
}
if (!clip || !["shader", "none", "lavfi"].includes(mode) || !(minutes > 0) || !['gpu', 'gpu-next'].includes(variant)) usage();
const tag = mode === "shader" ? `shader-${variant}` : mode;
const jsonPath = `/tmp/fit-spike-${tag}.json`;
const gpuNext = variant === "gpu-next";

const interactive = !yes && process.stdin.isTTY;
const rl = interactive ? createInterface({ input: process.stdin, output: process.stdout }) : null;
async function ask(q) {
  if (!rl) return null;
  return (await rl.question(`${q} `)).trim();
}
async function askYes(q) {
  const a = await ask(`${q} [y/n]`);
  return a === null ? null : /^y/i.test(a);
}

// ---- the test fit: three thirds, inset 0.05, skewed corners ----
// A: rectangle shifted up. B: skewed and shifted down.
// C: dst = src exactly, no skew, so its perspective terms come out tiny (like 1.11e-16): checks mpv
// parses exponent notation. Corners TL, TR, BR, BL, y down.
function makeThree(dx = 0, dy = 0) {
  const fit = defaultFit("spike", false);
  const col = (i) => [i / 3 + 0.05, (i + 1) / 3 - 0.05];
  const [a0, a1] = col(0);
  const [b0, b1] = col(1);
  const src = (i) => ({ x: i / 3, y: 0, w: 1 / 3, h: 1 });
  fit.regions = [
    { src: src(0), dst: [[a0, 0.02], [a1, 0.02], [a1, 0.7], [a0, 0.7]] },
    { src: src(1), dst: [[b0 + 0.02, 0.28], [b1 - 0.02, 0.3], [b1, 0.96], [b0, 0.94]] },
    { src: src(2), dst: [[2 / 3, 0], [1, 0], [1, 1], [2 / 3, 1]] },
  ].map((r) => ({ ...r, dst: r.dst.map(([x, y]) => [x + dx, y + dy]) }));
  return fit;
}
const three = makeThree();
const moved = makeThree(0.04, 0.02);

const EXPECT = {
  shader: "left face high, middle face low and tilted, right face full height and unmoved, nothing mirrored (faces in clip order, left to right)",
  lavfi: "the whole picture squeezed into the left third, up near the top (CPU fallback: one warped region)",
  none: "the clip full screen, unwarped",
}[mode];

// ---- helpers ----
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : null;
};
const round = (x, d = 2) => (x == null ? null : Number(x.toFixed(d)));
const tryGet = async (ipc, name) => {
  try {
    return await ipc.command("get_property", name);
  } catch {
    return null;
  }
};
function readCpu() {
  try {
    const f = readFileSync("/proc/stat", "utf8").split("\n")[0].trim().split(/\s+/).slice(1).map(Number);
    return { idle: f[3] + (f[4] || 0), total: f.reduce((a, b) => a + b, 0) };
  } catch {
    return null;
  }
}
const cpuPct = (a, b) => (a && b && b.total > a.total ? (100 * (1 - (b.idle - a.idle) / (b.total - a.total))) : null);
const readFile = (p) => {
  try {
    return readFileSync(p, "utf8").replace(/\0/g, "").trim();
  } catch {
    return null;
  }
};

const report = { mode, variant: mode === "shader" ? variant : null, clip, minutes, started: new Date().toISOString() };
const dir = mkdtempSync(join(tmpdir(), "fit-spike-"));
const sock = join(dir, "mpv.sock");
let fileNo = 0;
// mpv caches shader files by path, so every update gets a fresh file
const freshShader = (fit) => {
  const f = join(dir, `fit-${String(++fileNo).padStart(4, "0")}.glsl`);
  writeFileSync(f, fitShader(fit, { params: gpuNext }));
  return f;
};
let child = null;
const cleanup = () => {
  try {
    child?.kill("SIGKILL");
  } catch {}
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {}
};
process.on("SIGINT", () => {
  cleanup();
  process.exit(130);
});

// ---- 1. environment ----
report.mpv = (spawnSync("mpv", ["--version"], { encoding: "utf8" }).stdout || "mpv not found").split("\n")[0];
report.board = readFile("/proc/device-tree/model");
console.log(`Fit spike, mode ${mode}`);
console.log(`mpv:   ${report.mpv}`);
console.log(`board: ${report.board ?? "unknown (not a Pi)"}`);
console.log(`Expect on the projector: ${EXPECT}`);

// ---- 2. start mpv ----
const extra = (process.env.FIT_SPIKE_EXTRA ?? "").split(/\s+/).filter(Boolean);
const args = [...mpvArgs({}, sock), "--loop-file=inf", "--msg-level=all=warn,vo=v", ...(mode === "shader" && gpuNext ? ["--vo=gpu-next"] : []), ...extra, "--", clip];
const mpvLog = [];
child = spawn("mpv", args, { stdio: ["ignore", "pipe", "pipe"] });
const onOut = (chunk) => {
  for (const line of chunk.toString().split("\n")) if (line.trim()) mpvLog.push(line.trim());
  if (mpvLog.length > 2000) mpvLog.splice(0, mpvLog.length - 2000);
};
child.stdout.on("data", onOut);
child.stderr.on("data", onOut);
let exited = false;
child.on("error", (e) => {
  console.error(`could not start mpv: ${e.message}`);
  cleanup();
  process.exit(1);
});
child.on("exit", () => (exited = true));

let ipc;
for (let i = 0; i < 100 && !ipc; i++) {
  try {
    ipc = await MpvIpc.connect(sock, { timeoutMs: 10_000 });
  } catch {
    if (exited) break;
    await sleep(100);
  }
}
if (!ipc) {
  console.error("no mpv IPC socket. mpv said:\n" + mpvLog.slice(-20).join("\n"));
  cleanup();
  process.exit(1);
}

// wait until the video is playing
for (let i = 0; i < 100; i++) {
  if ((await tryGet(ipc, "width")) != null) break;
  await sleep(100);
}
await sleep(2000); // let hwdec settle
const width = await tryGet(ipc, "width");
const height = await tryGet(ipc, "height");
report.clip_info = {
  width,
  height,
  fps: await tryGet(ipc, "container-fps"),
  codec: await tryGet(ipc, "video-codec"),
  hwdec: await tryGet(ipc, "hwdec-current"),
};

report.current_vo = await tryGet(ipc, "current-vo");

if (mode === "shader") {
  report.exponent_literals = (fitShader(three, { params: gpuNext }).match(/^-?\d\.\d+e[-+]?\d+/gm) ?? []).length
    + (fitShader(three, { params: gpuNext }).match(/= -?\d\.\d+e[-+]?\d+;/gm) ?? []).length;
  try {
    await ipc.command("change-list", "glsl-shaders", "append", freshShader(three));
    report.shader_loaded = true;
  } catch (e) {
    report.shader_loaded = false;
    report.shader_error = e.message;
  }
} else if (mode === "lavfi") {
  const d = three.regions[0].dst.map(([x, y]) => [Math.round(x * width), Math.round(y * height)]);
  // perspective wants TL, TR, BL, BR
  const q = [d[0], d[1], d[3], d[2]].map(([x, y]) => `${x}:${y}`).join(":");
  const vf = `lavfi=[perspective=${q}:sense=destination]`;
  try {
    await ipc.command("vf", "set", vf);
    report.lavfi_loaded = true;
  } catch (e) {
    report.lavfi_loaded = false;
    report.lavfi_error = e.message;
  }
  report.lavfi_filter = vf;
}
await sleep(1500);
if (mode === "lavfi") {
  report.lavfi_hwdec_after = await tryGet(ipc, "hwdec-current");
  report.lavfi_vf_after = await tryGet(ipc, "vf");
  report.lavfi_filter_kept = Array.isArray(report.lavfi_vf_after) ? report.lavfi_vf_after.length > 0 : null;
}

// ---- 3. pass present, and does the video fill the output? ----
const passes = async () => {
  const p = await tryGet(ipc, "vo-passes");
  if (!p) return null;
  return [...(p.fresh ?? []), ...(p.redraw ?? [])];
};
if (mode === "shader") {
  const isOurs = (x) => typeof x.desc === "string" && x.desc.includes(SHADER_DESC);
  let all = await passes();
  for (let i = 0; i < 20 && !all?.some(isOurs); i++) {
    await sleep(250);
    all = await passes();
  }
  const found = (all ?? []).filter(isOurs);
  report.pass_descs = (all ?? []).map((x) => x.desc);
  report.pass_present = found.length > 0;
  if (found.length) report.pass_ms = { avg: round(found[0].avg / 1e6, 3), peak: round(found[0].peak / 1e6, 3) };
}
{
  const vp = await tryGet(ipc, "video-params");
  const od = await tryGet(ipc, "osd-dimensions");
  const vAspect = vp ? (vp.dw ?? vp.w) / (vp.dh ?? vp.h) : null;
  const dAspect = od ? od.w / od.h : null;
  const margins = od ? [od.ml, od.mr, od.mt, od.mb] : null;
  report.fill = {
    video: vp ? `${vp.w}x${vp.h} (display ${vp.dw}x${vp.dh}, aspect ${round(vAspect, 3)})` : null,
    output: od ? `${od.w}x${od.h} (aspect ${round(dAspect, 3)})` : null,
    margins_lrtb: margins,
    fills: margins ? margins.every((m) => Math.abs(m) <= 1) : null,
  };
}

// ---- 4. live update ----
// The times are how long mpv took to acknowledge the command over IPC, not how long the reload takes.
async function timeUpdates(step) {
  const ms = [];
  for (let i = 0; i < 20; i++) {
    const t = performance.now();
    await step(i % 2 === 1 ? moved : three); // ends on `moved`
    ms.push(performance.now() - t);
    await sleep(60);
  }
  return { ipc_ack_median_ms: round(median(ms)), ipc_ack_max_ms: round(Math.max(...ms)) };
}
const setFile = (fit) => ipc.command("change-list", "glsl-shaders", "set", freshShader(fit));
if (mode === "shader" && report.shader_loaded) {
  report.live = {};
  if (gpuNext) {
    try {
      report.live.opts = await timeUpdates((fit) => ipc.command("set_property", "glsl-shader-opts", fitShaderOpts(fit)));
      console.log("Live update (a), glsl-shader-opts: the picture should now show the shifted layout.");
      report.live.opts.moved = await askYes("Did the three faces move for (a)?");
    } catch (e) {
      report.live.opts = { error: e.message, moved: false };
    }
    // opts override the file's defaults, so clear them before testing the file way
    await ipc.command("set_property", "glsl-shader-opts", "").catch(() => {});
  }
  await setFile(three).catch(() => {});
  await sleep(1000);
  try {
    report.live.file = await timeUpdates(setFile);
    console.log("Live update (b), new shader file each time: the picture should now show the shifted layout.");
    report.live.file.moved = await askYes("Did the three faces move for (b)?");
  } catch (e) {
    report.live.file = { error: e.message, moved: false };
  }
  // back to the base fit, and ask about orientation
  await setFile(three).catch(() => {});
  await sleep(1000);
  report.orientation_ok = await askYes(`Back at the base layout. Do you see: ${EXPECT}?`);
}

// ---- 5. play, sampling drops and CPU ----
const counters = async () => ({
  frame_drop: await tryGet(ipc, "frame-drop-count"),
  decoder_drop: await tryGet(ipc, "decoder-frame-drop-count"),
  vo_delayed: await tryGet(ipc, "vo-delayed-frame-count"),
});
console.log(`Playing for ${minutes} min...`);
const c0 = await counters();
const cpu0 = readCpu();
const playStart = Date.now();
let prev = cpu0;
let peak = null;
const endAt = playStart + minutes * 60_000;
while (Date.now() < endAt && !exited) {
  await sleep(Math.min(5000, Math.max(0, endAt - Date.now())));
  const now = readCpu();
  const p = cpuPct(prev, now);
  if (p != null) peak = Math.max(peak ?? 0, p);
  prev = now;
}
const playedMin = (Date.now() - playStart) / 60_000;
const c1 = exited ? { frame_drop: null, decoder_drop: null, vo_delayed: null } : await counters();
const delta = (k) => (c0[k] != null && c1[k] != null ? c1[k] - c0[k] : null);
report.mpv_exited = exited;
report.played_minutes = round(playedMin, 2);
report.drops = { frame_drop: delta("frame_drop"), decoder_drop: delta("decoder_drop"), vo_delayed: delta("vo_delayed") };
// a null counter is unknown, never 0
report.drops.total = Object.values(report.drops).some((v) => v == null) ? null : Object.values(report.drops).reduce((a, b) => a + b, 0);
report.drops.per_min = report.drops.total == null ? null : round(report.drops.total / playedMin, 2);
report.cpu = { avg_pct: round(cpuPct(cpu0, prev), 1), peak_5s_pct: round(peak, 1) };

// ---- 6. reach-scan check (runs beside the playing mpv, as it would in service) ----
{
  const t = Date.now();
  const scan = spawn(
    "nice",
    ["-n", "19", "mpv", "--no-config", "--msg-level=all=error", "--no-audio", "--hwdec=no", "--vf=fps=fps=2,scale=w=128:h=72,format=gray",
      "--o=-", "--of=rawvideo", "--ovc=rawvideo", "--", clip],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  let bytes = 0;
  const err = [];
  scan.stdout.on("data", (d) => (bytes += d.length));
  scan.stderr.on("data", (d) => err.push(...d.toString().split("\n").filter(Boolean)));
  scan.on("error", (e) => err.push(e.message));
  const code = await new Promise((r) => scan.on("close", r));
  const frames = Math.floor(bytes / 9216);
  report.reach_scan = { bytes, frames, seconds: round((Date.now() - t) / 1000, 1), exit_code: code };
  if (code !== 0 || frames === 0) report.reach_scan.stderr_tail = err.slice(-10);
}

// ---- 7. verdict ----
const dropsOf = (j) => j?.drops?.per_min ?? null;
if (mode === "none") {
  report.baseline_per_min = report.drops.per_min;
}
if (mode === "shader") {
  let baseline = null;
  try {
    baseline = dropsOf(JSON.parse(readFileSync("/tmp/fit-spike-none.json", "utf8")));
  } catch {}
  if (baseline == null) {
    const a = await ask("No usable /tmp/fit-spike-none.json. Dropped frames per minute from the none run?");
    baseline = a !== null && a !== "" && !isNaN(Number(a)) ? Number(a) : null;
  }
  report.baseline_drops_per_min = baseline;
  const fail = [];
  const unknown = [];
  if (report.mpv_exited) fail.push("mpv exited during the run");
  if (report.shader_loaded === false) fail.push(`shader did not load (${report.shader_error})`);
  if (!report.pass_present) fail.push(`no "${SHADER_DESC}" pass`);
  if (report.drops.total == null) fail.push("a drop counter was unavailable");
  else if (baseline == null) unknown.push("no baseline drops to compare");
  else if (report.drops.per_min > baseline + 1) fail.push(`drops ${report.drops.per_min}/min > baseline ${baseline}/min + 1`);
  const moved_ok = report.live ? report.live.opts?.moved || report.live.file?.moved : null;
  if (moved_ok == null) unknown.push("live update not confirmed (no answer)");
  else if (!moved_ok) fail.push("neither live-update way moved the picture");
  if (report.orientation_ok === false) fail.push("picture flipped or mirrored");
  else if (report.orientation_ok == null) unknown.push("orientation not confirmed (no answer)");
  report.verdict = fail.length ? "FAIL" : unknown.length ? "INCONCLUSIVE" : "PASS";
  report.verdict_notes = [...fail, ...unknown];
}

// error and warning lines; verbose (vo=v) lines only when they look like a failure
report.mpv_log = mpvLog.filter((l) => /error|warn|fail|unrecognized|compile|invalid|cannot|could not/i.test(l)).slice(-40);

// ---- report ----
try {
  await ipc.command("quit");
} catch {}
await sleep(300);
cleanup();
rl?.close();

writeFileSync(jsonPath, JSON.stringify(report, null, 2) + "\n");
const L = (k, v) => console.log(`${k.padEnd(14)} ${typeof v === "string" ? v : JSON.stringify(v)}`);
console.log("\n===== FIT SPIKE REPORT =====");
L("mode", mode === "shader" ? `shader (${variant})` : mode);
L("mpv", report.mpv);
L("board", report.board);
L("current-vo", report.current_vo);
L("clip", report.clip_info);
L("mpv exited", `${report.mpv_exited} (played ${report.played_minutes} of ${minutes} min)`);
if (mode === "shader") {
  L("shader loaded", report.shader_loaded ? "yes" : `NO (${report.shader_error})`);
  L("exp literals", `${report.exponent_literals} (should be at least 1)`);
  L("pass present", report.pass_present ? `yes ${JSON.stringify(report.pass_ms ?? {})}` : "NO");
  L("all passes", report.pass_descs);
  L("live (a) opts", gpuNext ? report.live?.opts : "n/a on gpu");
  L("live (b) file", report.live?.file);
  L("orientation", report.orientation_ok);
}
if (mode === "lavfi") {
  L("lavfi", report.lavfi_loaded ? report.lavfi_filter : `NO (${report.lavfi_error})`);
  L("hwdec after", report.lavfi_hwdec_after);
  L("vf after", report.lavfi_vf_after);
  if (report.lavfi_filter_kept === false) console.log("WARNING: mpv dropped the lavfi filter (vf is empty after setting it)");
}
L("fills output", report.fill);
L("drops", report.drops);
L("cpu", report.cpu);
L("reach scan", report.reach_scan);
if (mode === "shader") {
  L("baseline", report.baseline_drops_per_min == null ? "none" : `${report.baseline_drops_per_min} drops/min`);
  L("verdict", `${report.verdict}${report.verdict_notes.length ? " (" + report.verdict_notes.join("; ") + ")" : ""}`);
}
L("mpv messages", report.mpv_log.length ? "" : "none");
for (const l of report.mpv_log) console.log(`  ${l}`);
console.log(`(JSON: ${jsonPath})`);
process.exit(0);
