# Fit the picture from a phone (issue #40)

Date: 2026-10-16. Status: draft design, awaiting owner approval.

## Why

Physical aiming (`docs/AIMING.md`) gets the picture roughly onto the target. The
last few centimetres decide whether it looks real. The owner's main use is
AtmosFX's three singing pumpkins projected onto three foam pumpkins. When the fit
is off, faces distort or land on the tree behind the pumpkins. It is hard to get
right because some songs use more of each face's area than others: a fit that looks
right during a quiet moment spills during the next wide mouth. The same tool
has to work for a single object (one pumpkin, Santa on an inflatable) and for a
window or scrim.

Done when: one person, alone, fits the picture in under 10 minutes using only a
phone in the yard.

Deadline (owner, 2026-10-16): the full design, for Halloween 2026 (15 days out),
accepting the risk. Nothing is cut up front.

## Goals

- A **setup mode**, reached from a phone, that shows what to align against
  (each face's full reach, or a grid) and lets the owner move it into place.
- **Regions**: one or more rectangles in the video frame, each mapped to four
  corners on the output. One region covering the whole frame is the default
  and covers windows, Santa, one pumpkin, and three pumpkins already spaced like
  the video. One region per face covers pumpkins placed wherever the yard allows.
- **Face reach**: the outline of everything a region ever lights up, across all
  the clips in use, so one alignment covers every song.
- **Test grid** for flat targets (window, scrim), where square corners matter.
- **Fire a test scare** and **play** from the setup screen, to check in motion.
- **Saved fits**: named (for example "Pumpkins, front yard"), one active at a
  time, kept across reboots and updates, included in Backup, so next year it
  comes back.
- The existing **Mirror** setting keeps working, and lives with the fit.

## Non-goals

- **Masks.** Dropped by the owner: AtmosFX videos are already black around the
  character, and software cannot make anything darker than the video's black.
  Spill is face pixels missing the target, which the fit fixes.
- Curved warps or mesh warps for round objects. Four corners per region is the
  whole model.
- Multi-projector blending (deferred elsewhere).
- Camera-assisted or automatic fitting.

## Anti-goals (a failure even if it works)

- The show drops frames or stutters on a Pi 3 because of the fit. A fit that
  costs the seamless loop is worse than no fit.
- Fitting needs a laptop, a second person, or walking back to the case.
- A fit silently lost after an update, restore or power cut.

## Constraints

- Pi 3 is the baseline. Hardware H.264 decode must stay on (today's Mirror
  forces `hwdec=auto-copy` and a CPU `hflip`, and the help warns a Pi 3 may not
  cope with it).
- mpv is the only video tool on the image. **ffmpeg is not installed** (see
  `pi/src/poster.js`). mpv runs `--vo=gpu --gpu-context=drm`.
- `mpvExtraArgs` and `vf` are allow-listed in `pi/src/mpv.js`. Anything new that
  reaches mpv is built by the service, not typed by the user.
- Web page rules from the 2026-10-13 redesign: plain ES modules, no build step,
  no CDN, CSP `default-src 'self'; img-src 'self' data:; style-src 'self'`, phone
  first, light and dark. Every screen and settings group needs a help page
  (`pi/test/help.test.js`). User guides follow the Markdown subset and are
  linked from `pi/docs/index.md` and the README.
- DMX overrides everything while live. Setup mode must not fight it: while DMX is
  in control, setup is unavailable and says why.

## Decided

### Model

A **fit** = `{ name, mirror, regions: [ { src: {x, y, w, h}, dst: [4 corners] } ] }`.
`src` is in the video frame, normalised 0..1. `dst` is four points in output
space, normalised 0..1 (top-left, top-right, bottom-right, bottom-left). Anything
outside every region's output is black. The default fit has one region covering
the whole frame mapped to the whole screen: playback looks the same as today.

### Setup flow (phone)

1. Open Setup and choose or create a fit. Choose "1 region" or "N regions".
   For N, draw a box around each face on a still frame of the video.
2. The projector shows the setup overlay: each region's **face reach** outline in
   a bright colour over a still frame, its four corners marked and numbered. In
   grid mode it shows a test grid with numbered corners instead.
3. On the phone, the same picture with draggable corners (and the whole region
   draggable by its middle). Moves show on the projector live.
4. Tap **Play** to watch it in motion with the fit applied, or **Test scare**.
5. **Save**. Leaving setup without saving returns to the last saved fit.

### Face reach

Computed by the Pi in the background, at the lowest CPU priority like posters,
from the clips the show uses (playlist, calm clip, scare clips): a low-resolution
union of every pixel above a black threshold, per clip, cached on disk while the
clip's size and time are unchanged. Setup draws the union across all clips in use,
clipped to each region's `src`. Until the scan finishes, setup shows the region
box only and says the outline is coming.

### One fit for all clips

Every clip in the show uses the same layout this year (owner, 2026-10-16), so one
fit is active for all clips, and the player never switches fits between clips.
The face reach is the union across all clips in use.

### Where it lives

A **Setup** screen in the web page's navigation (a new `#/setup` view, its own
help page). Mirror moves from Settings > Display into the fit. Existing
installs keep their Mirror value: on first start, the stored setting seeds the
default fit's `mirror`.

## Builder's call, after a spike

**The rendering method is unknown and must be tested on a Pi 3 first**, before
any screens are built. Candidates:

- An mpv user shader (`--glsl-shader`, GPU) that maps output pixels back through
  each region's corners. It could also do the mirror, which would let Mirror
  stop forcing CPU frames. Questions to answer: does mpv on Pi OS's VC4 (GLES 2)
  accept the shader at all, can it be updated live over IPC while dragging
  (change-list `glsl-shaders` or shader parameters, depending on the mpv version
  shipped), and what does it cost at 1080p30.
- A `lavfi` filter graph (CPU) as a fallback. Likely too slow on a Pi 3 at
  1080p with hardware decoding on, but measure it.

The owner has a Pi 3, the TO2 and the three-pumpkin clip ready (2026-10-16) and
runs the spike: the builder writes a script that runs on the Pi, plays the clip
with a hard-coded three-region fit, and prints the clip's resolution and frame
rate, mpv's `frame-drop-count` and CPU load. The plan's first stage is the spike
alone and stops there for the owner's result; screens and API come after it
passes.

Pass bar for the spike: the three-pumpkin video with three regions plays
for 10 minutes at 1080p on a Pi 3 with no more dropped frames than without the
fit (mpv's `frame-drop-count`), and a corner move shows on the projector within
about a quarter of a second. If nothing passes, come back to the owner before
building anything: the fallback might be one region only, or Pi 4 and up only.

## Left to the builder

- Storage format and file location for fits (in the state folder, written
  atomically like settings, added to the backup format with a version bump).
- How the face-reach scan gets pixels out of mpv without ffmpeg.
- The black threshold and scan resolution.
- How the setup overlay reaches the projector (mpv OSD overlay, a generated
  image, the shader itself).
- The API shape under `/api/`, its auth (same as other writes), and tests.
- Docs: a `pi/docs/` guide for fitting, the Setup help page, `docs/AIMING.md`
  pointing to it for the last step, `docs/BRINGUP.md` row(s) for the Pi 3 spike
  and the 10-minute target.

## My calls (not discussed with the owner)

- Corners move both by dragging on the phone and by nudge arrows (with a
  coarse/fine step) for the last millimetres, since a finger on a small picture
  is imprecise.
- Mirror moves into the fit.
- Boards: the Pi 3 must pass the spike. The Zero 2 W has the same graphics chip,
  so it is expected to behave like the Pi 3 but is not tested. Pi 4 and Pi 5 use a
  different graphics driver and are best effort: if the shader fails to load,
  playback falls back to no fit and Setup says the board is not supported.
