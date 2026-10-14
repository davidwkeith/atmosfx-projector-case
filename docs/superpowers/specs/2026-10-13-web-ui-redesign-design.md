# VideoFX web UI redesign

Date: 2026-10-13. Status: approved design, awaiting implementation plan.

## Goal

Replace the single scrolling page in `pi/public/` with grouped views, UniFi OS
style: a navigation bar, a schema-driven Settings area with its own sub-navigation,
inline one-line descriptions, (i) tooltips for the fine print, a Simple/Advanced
toggle, settings search, a sticky "Apply changes" bar, and a per-screen help panel
served from Markdown kept in the repo.

Primary use: the owner on a phone, in the yard, at night. Play/Stop, Scare now,
volume and a health glance must be one tap away. Setup on a laptop is the
secondary case and gets a two-column layout from about 900 px.

## Constraints

- Plain HTML, CSS and ES modules. No build step, no CDN, no framework. The CSP
  stays `default-src 'self'; img-src 'self' data:; style-src 'self'`, so no inline
  scripts or styles.
- Served from a Raspberry Pi 3 by the `node:http` server in `pi/src/web.js`.
- No change to any `/api/*` contract. Matter, the player and the power path are
  untouched.
- Light and dark themes as today (`prefers-color-scheme`).
- Tests run with vitest outside Claude Code's sandbox (they bind sockets).

## 1. Information architecture and navigation

Six views, addressed as `#/<view>` so the back button and bookmarks work.
Deep links such as `#/settings/projector` open Settings on that group.

| View | Contents |
|---|---|
| Dashboard (landing) | State pill, Play/Stop, Scare now (scare mode only), volume slider and mute, alert banners (DMX in control, thermal, system notes), status tiles: Projector, Schedule next, Network, Pi temperature |
| Media | Videos list with upload, delete and free-space line; Playlist editor with Save and Undo |
| Scares | Calm clip, scare clips, Suggest from file names; the Scare and Motion sensor setting groups |
| Schedule | Weekly schedule table, sunset offset, latitude and longitude; Quiet hours |
| Settings | Every remaining schema group, with a secondary nav (section 2) |
| System | Matter pairing QR / fabrics / reset, Backup download and Restore, Restart service, version and update notice, storage and maintenance state |

Navigation: a bottom tab bar with icons and labels under 900 px, a left sidebar
above that. Badges: a dot on Dashboard while any alert is active, a dot on System
when an update is available or no password is set. Alert banners render on the
Dashboard only. Other views show a one-line strip at the top while DMX is in
control, because it disables their power and volume controls.

Scares and Schedule take their setting groups with them. The global Settings tree
holds only what has no home elsewhere.

## 2. Settings view

Secondary nav from the schema's `group` field, in this order: Device, Playback,
Projector, Audio, Display, DMX, Cooling, Web page, Advanced, Hardware. Tabs under
the title on phones, a second column on desktop.

Row layout: bold label; the schema `help` string as a muted one-liner beneath it;
the control (text, number, select, checkbox) to the right or below on narrow
screens. An (i) button after the label opens an inline detail panel under the row with: source (set here /
from `/etc/default/videofx` / default), the default value, when the change applies
(at once / next play / after a restart), the env var name, and a "Reset to file
value or default" action when the source is `web`.

Simple/Advanced toggle at the top of Settings, remembered in `localStorage`. Simple
hides rows with `advanced: true`. The schema gains that flag on: `mpvExtraArgs`
(already), `cecDevice`, `relaySettleSec`, `audioCard`, `mixerControl`, `console`,
`pirDebounceMs`, `tempHysteresisC`, `dmxMulticast`, `dmxHoldSec`, `webHosts`.
A group with no visible rows (Advanced, in Simple mode) drops out of the
secondary nav.

Search box above the nav filters every non-custom row (including those on the Scares and Schedule screens) by label and help text and
ignores the Simple filter. Results show the group name next to each row.

Saving: edits are held in a pending-changes store. A sticky bar at the bottom
reads "N changes · Apply · Discard" and adds "restart needed" when any pending key
has `apply: restart`. Apply sends `PUT /api/settings/<key>` in order, stops at the
first error, shows the failing label in the toast, and keeps that edit and the
rest pending. After success the existing restart banner shows if needed. The same
store and bar serve the Scare, Motion sensor, Schedule and Quiet hours rows on
their own views.

Password keeps its own card (current, new, Set/Change, Remove, Reset with
confirmation) because of its auth rules. Hardware is read-only: the Pi model,
each fixed value with its env var, the GPIO pin table, and the "edit over SSH,
then restart" note. The group `Fixed` is renamed `Hardware` in the schema.

Projector hosts the IR code controls (field, Learn, Send test, Save) and shows
them only while `projectorPower` is `relay-ir`.

## 3. Help panel and documentation

Every view header has a "?" button opening a side sheet: a `<dialog>` on phones, a
right-hand panel on desktop. Settings opens the help for the current group.

Source files: `pi/public/help/<slug>.md`, one per view (`dashboard`, `media`,
`scares`, `schedule`, `system`) and one per settings group (`device`, `playback`,
`projector`, `audio`, `display`, `dmx`, `cooling`, `web-page`, `advanced`,
`hardware`). Written for the page reader: what the screen does, common mistakes,
and the few things the README explains at length (sunset needs latitude and
longitude, CEC against relay against IR, the two-Pi Matter pairing warning). Each
ends with a link to the matching README section on GitHub.
The folder is under public/ because setup.sh and the image build copy only src/, public/ and system/.

Delivery: `GET /help/<slug>.md` in `web.js`, slug pattern `^[a-z][a-z0-9-]{0,40}$`,
served only if the file exists, `cache-control: no-store` like everything else.
The client renders it with `public/markdown.js`, an in-house subset: ATX headings,
paragraphs, bold, italic, inline code, fenced code, bulleted and numbered lists,
links with `http(s):` or relative targets. Raw HTML is escaped. Other link schemes
render as plain text. A failed fetch shows "Help not available" inside the sheet.

The README's web page section shrinks to a pointer to the "?" buttons. CLAUDE.md's
docs list gains `pi/public/help/`.

## 4. Code structure and server changes

`pi/public/`:

| File | Role |
|---|---|
| `index.html` | Shell: header with name and state pill, nav, empty `<main>`, help dialog, toast |
| `app.js` | Boot: hash router, 3 s status poll, chrome, help sheet |
| `state.js` | Shared store, refreshers, subscriptions, dirty registry |
| `nav.js` | Views, group-to-view map, hash parsing, help slugs (pure) |
| `notes.js` | Alarms, system notes and nav badges from /api/status (pure) |
| `api.js` | `api()`, `json()`, `toast()`, `run()`, `el()`, `bytes()`, moved unchanged |
| `views/dashboard.js`, `media.js`, `scares.js`, `schedule.js`, `settings.js`, `system.js` | One module per view exporting `render(root, state)` and `update(state)` |
| `settings-form.js` | Schema-driven row renderer, (i) detail panel, pending-changes store, Apply bar |
| `markdown.js` | Markdown subset renderer |
| `app.css` | Tokens, layout, nav, rows, detail panel, dialog, light and dark |

State: one object (`status`, `media`, `settings`) refreshed by the existing three
fetches. Views re-render only live parts and keep today's guard against replacing
an input that has focus. Unsaved playlist and settings edits live in the store, so
they survive navigation; `beforeunload` still warns when anything is dirty.

`pi/src/web.js`: the fixed `STATIC` map becomes an allow-list serving
`public/**/*.{js,css,html}` and `docs/help/*.md`, with path normalisation that
refuses `..`, dotfiles, symlink escapes and other extensions. `/playlist-core.js`
keeps its route. No other server change.

`pi/src/config.js`: the `advanced` flags above and the `Fixed` to `Hardware`
rename. `describe()` already exposes `group`, `label`, `help`, `apply`,
`advanced`, `custom`, `source`, `default`.

## 5. Testing and error handling

- `pi/test/web.test.js`: the static route serves each view module and a help
  file; refuses `..`, dotfiles and unknown extensions; 404s an unknown help slug.
  Every slug the UI references (a list exported from
  `nav.js`) has a file in `pi/public/help/`.
- New `pi/test/markdown.test.js`: each supported construct, raw HTML escaped,
  `javascript:` links rendered as text.
- New `pi/test/settings-form.test.js`: the pending-changes store in isolation:
  add, overwrite, discard, restart-needed detection, Apply order and stop-on-error.
- Router, views, nav and both themes are checked by hand in the built-in browser
  against `node src/main.js` with a fake media folder, at phone and desktop widths.
  No DOM test framework is added.

Error handling keeps today's posture: every API failure goes to the toast. Apply
names the failing key and keeps it pending; a help fetch failure is shown in the
sheet.

## Rollout

One PR on this branch. The old `app.js` is deleted, not kept behind a flag.
Version bump to 0.9.0 (`pi/package.json` and the `v0.9.0` tag together).

## Out of scope

Matter, player, power path, any `/api/*` change, HTTPS, user accounts, a build
toolchain, multi-projector sync.
