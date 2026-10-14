import { enabledCount, isMediaFile, moveEntry } from "/playlist-core.js";
import { api, bytes, el, json, run, toast } from "../api.js";
import { onDirtyCheck, refreshMedia, refreshStatus } from "../state.js";

// Module-level on purpose: unsaved playlist edits survive leaving this screen and coming back.
let files = []; // [{ name, size }]
let saved = []; // playlist as on disk
let entries = []; // playlist being edited
let maxUploadBytes = Infinity;
let freeText = "";
let seen = null; // the state.media object last copied in
const dirty = () => JSON.stringify(entries) !== JSON.stringify(saved);
onDirtyCheck(dirty);

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

export function mount(root) {
  const playlist = el("ol", { className: "rows" });
  const playlistEmpty = el("p", { className: "hint", hidden: true }, "Empty. Add videos below.");
  const save = el("button", { type: "button", className: "primary", disabled: true }, "Save playlist");
  const revert = el("button", { type: "button", disabled: true }, "Undo changes");
  const unsaved = el("span", { className: "hint", hidden: true }, "Unsaved changes");
  const list = el("ul", { className: "rows" });
  const empty = el("p", { className: "hint", hidden: true }, "No videos yet.");
  const input = el("input", { type: "file", multiple: true, accept: "video/*,audio/*,.m3u,.m3u8" });
  const progress = el("progress", { max: 1, value: 0, hidden: true });
  const space = el("p", { className: "hint" });

  root.append(
    el(
      "section",
      {},
      el("h3", {}, "Playlist"),
      el("p", { className: "hint" }, "Plays top to bottom and loops. Unchecked items are skipped. Saving restarts playback if it is running."),
      playlist,
      playlistEmpty,
      el("div", { className: "actions" }, save, revert, unsaved),
    ),
    el("section", {}, el("h3", {}, "Videos"), list, empty, el("label", { className: "upload" }, el("span", {}, "Upload videos"), input), progress, space),
  );

  function render() {
    const names = new Set(files.map((f) => f.name));
    playlist.replaceChildren(
      ...entries.map((entry, i) => {
        const check = el("input", { type: "checkbox", checked: entry.enabled, title: "Play this item" });
        check.addEventListener("change", () => ((entries[i].enabled = check.checked), render()));
        const up = el("button", { type: "button", className: "icon", disabled: i === 0, title: "Move up" }, "↑");
        up.addEventListener("click", () => ((entries = moveEntry(entries, i, i - 1)), render()));
        const down = el("button", { type: "button", className: "icon", disabled: i === entries.length - 1, title: "Move down" }, "↓");
        down.addEventListener("click", () => ((entries = moveEntry(entries, i, i + 1)), render()));
        const remove = el("button", { type: "button", className: "icon", title: "Remove from playlist" }, "✕");
        remove.addEventListener("click", () => (entries.splice(i, 1), render()));
        const missing = !names.has(entry.file);
        return el(
          "li",
          { className: [entry.enabled ? "" : "off", missing ? "missing" : ""].join(" ").trim() },
          check,
          el("span", { className: "name" }, entry.file + (missing ? " (missing)" : "")),
          up,
          down,
          remove,
        );
      }),
    );
    playlistEmpty.hidden = entries.length > 0;

    const inList = new Set(entries.map((e) => e.file));
    list.replaceChildren(
      ...files.map((f) => {
        const add = el("button", { type: "button", title: "Add to playlist" }, inList.has(f.name) ? "Add again" : "Add");
        add.addEventListener("click", () => (entries.push({ file: f.name, enabled: true }), render()));
        const del = el("button", { type: "button", className: "icon danger", title: `Delete ${f.name}` }, "🗑");
        del.addEventListener("click", () => run(() => deleteFile(f.name)));
        return el("li", {}, el("span", { className: "name" }, f.name), el("span", { className: "size" }, bytes(f.size)), add, del);
      }),
    );
    empty.hidden = files.length > 0;
    space.textContent = freeText;
    save.disabled = revert.disabled = !dirty();
    unsaved.hidden = !dirty();
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
    await api(`/api/media/${encodeURIComponent(name)}`, { method: "DELETE" });
    entries = entries.filter((e) => e.file !== name);
    toast(`Deleted ${name}.`);
    await refreshMedia();
  }

  async function upload(fileList) {
    const picked = [...fileList];
    const bad = picked.filter((f) => (!isMediaFile(f.name) && !/\.m3u8?$/i.test(f.name)) || f.size > maxUploadBytes);
    if (bad.length) toast(`Skipped (not a video, audio or .m3u file, or too big): ${bad.map((f) => f.name).join(", ")}`);
    const good = picked.filter((f) => !bad.includes(f));
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
      input.value = "";
      await refreshMedia();
    }
  }

  save.addEventListener("click", () => run(savePlaylist));
  revert.addEventListener("click", () => ((entries = structuredClone(saved)), render()));
  input.addEventListener("change", () => run(() => upload(input.files)));

  render(); // module state from an earlier visit, if any

  return {
    helpSlug: () => "media",
    update({ media }) {
      if (!media || media === seen) return; // the status poll must not rebuild the lists
      const edited = dirty(); // keep unsaved edits across refreshes
      seen = media;
      files = media.files;
      saved = media.playlist;
      maxUploadBytes = media.maxUploadBytes ?? Infinity;
      freeText = `${bytes(media.freeBytes)} free` + (media.maxUploadBytes ? ` · max ${bytes(media.maxUploadBytes)} per file` : "");
      if (!edited) entries = structuredClone(saved);
      render();
    },
  };
}
