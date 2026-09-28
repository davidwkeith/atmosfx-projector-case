// Playlist and file-name rules shared by the server and the browser (served as
// /playlist-core.js). No Node imports here.

export const VIDEO_EXTS = [".mp4", ".m4v", ".mov", ".mkv", ".webm", ".avi", ".mpg", ".mpeg", ".ts", ".wmv"];
export const AUDIO_EXTS = [".mp3", ".m4a", ".aac", ".wav", ".ogg", ".oga", ".flac"];
export const PLAYLIST_EXTS = [".m3u", ".m3u8"];

// Disabled entries stay in the .m3u as comments, which mpv skips.
const DISABLED = "#VIDEOFX-DISABLED:";

export function extOf(name) {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i).toLowerCase() : "";
}

/** A plain file name directly inside the media folder: no paths, no hidden files. */
export function isSafeName(name) {
  return (
    typeof name === "string" &&
    name.length > 0 &&
    name.length <= 200 &&
    name === name.trim() &&
    !name.startsWith(".") &&
    !/[/\\\x00-\x1f\x7f]/.test(name)
  );
}

export function isMediaFile(name) {
  return isSafeName(name) && [...VIDEO_EXTS, ...AUDIO_EXTS].includes(extOf(name));
}

export function isPlaylistFile(name) {
  return isSafeName(name) && PLAYLIST_EXTS.includes(extOf(name));
}

/**
 * Parse .m3u text into [{ file, enabled }]. `prefix` is stripped from entries
 * (used when the playlist does not live in the media folder and entries are absolute).
 */
export function parsePlaylist(text, prefix = "") {
  const entries = [];
  for (const raw of text.split(/\r?\n/)) {
    let line = raw.trim();
    let enabled = true;
    if (line.startsWith(DISABLED)) {
      line = line.slice(DISABLED.length).trim();
      enabled = false;
    } else if (line === "" || line.startsWith("#")) {
      continue; // #EXTM3U, #EXTINF and other comments
    }
    if (prefix && line.startsWith(prefix)) line = line.slice(prefix.length);
    if (line) entries.push({ file: line, enabled });
  }
  return entries;
}

export function serializePlaylist(entries, prefix = "") {
  const lines = entries.map(({ file, enabled }) => (enabled ? "" : DISABLED) + prefix + file);
  return ["#EXTM3U", ...lines, ""].join("\n");
}

/** Throws unless entries is a list of { file: media file name, enabled: boolean }. */
export function validateEntries(entries) {
  if (!Array.isArray(entries)) throw new Error("entries must be a list");
  if (entries.length > 1000) throw new Error("too many entries");
  return entries.map((e, i) => {
    if (!e || !isMediaFile(e.file)) throw new Error(`entry ${i + 1}: not a media file name: ${e?.file}`);
    if (typeof e.enabled !== "boolean") throw new Error(`entry ${i + 1}: enabled must be true or false`);
    return { file: e.file, enabled: e.enabled };
  });
}

/** New list with the entry at `from` moved to index `to` (clamped). */
export function moveEntry(entries, from, to) {
  if (from < 0 || from >= entries.length) return entries.slice();
  const out = entries.slice();
  const [item] = out.splice(from, 1);
  out.splice(Math.max(0, Math.min(to, out.length)), 0, item);
  return out;
}

export const enabledCount = (entries) => entries.filter((e) => e.enabled).length;

const stem = (name) => name.slice(0, name.length - extOf(name).length).toLowerCase();
const tokens = (name) => stem(name).split(/[^a-z0-9]+/).filter(Boolean);

/**
 * Suggest scare-mode pairs from file names: each file with "buffer" in its name
 * is a calm clip, and the other media files that share its name before "buffer"
 * are its scare clips. "Ghost_Buffer.mp4" pairs with "Ghost_Scare1.mp4" etc.
 * Returns [{ buffer, scares: [] }], best match first.
 */
export function suggestScarePairs(names) {
  const media = names.filter(isMediaFile);
  const pairs = [];
  for (const buffer of media) {
    const t = tokens(buffer);
    const i = t.indexOf("buffer");
    if (i < 0) continue;
    const prefix = t.slice(0, i);
    const scares = media.filter((other) => {
      if (other === buffer || tokens(other).includes("buffer")) return false;
      const o = tokens(other);
      return prefix.length > 0 ? prefix.every((w, k) => o[k] === w) : true;
    });
    pairs.push({ buffer, scares });
  }
  return pairs.sort((a, b) => b.scares.length - a.scares.length || a.buffer.localeCompare(b.buffer));
}
