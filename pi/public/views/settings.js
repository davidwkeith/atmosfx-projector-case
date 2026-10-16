import { api, el, json, run, toast } from "../api.js";
import { GROUP_VIEW, SETTINGS_GROUPS, groupSlug } from "../nav.js";
import { advancedShown, advancedToggle, effective, fixedRow, pending, pinTable, rowOf, safeToRebuild, visibleItems } from "../settings-form.js";
import { setting, state } from "../state.js";

function renderDmx(box, dmx) {
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

// The IR code is edited here, next to the "relay-ir" choice it belongs to. It goes through Apply like any other setting.
function irCard() {
  const code = el("input", { type: "text", value: String(effective("irPowerCode") ?? ""), placeholder: "nec:0x40bf or raw:+9000 -4500 ...", autocomplete: "off", spellcheck: false, attrs: { "aria-label": "IR power code" } });
  const edited = () => pending.set("irPowerCode", code.value.trim(), setting("irPowerCode") ?? "");
  code.addEventListener("input", edited);
  const learn = el("button", { type: "button" }, "Learn power button");
  learn.addEventListener("click", () =>
    run(async () => {
      learn.disabled = true;
      toast("Press the remote's power button at the receiver (15 s)…");
      try {
        const { code: learned } = await api("/api/ir/learn", json("POST", {}));
        code.value = learned;
        edited();
        toast(`Learned ${learned}. Send a test, then Apply.`);
      } finally {
        learn.disabled = false;
      }
    }),
  );
  const test = el("button", { type: "button" }, "Send test");
  test.addEventListener("click", () =>
    run(async () => {
      await api("/api/ir/test", json("POST", { code: code.value.trim() }));
      toast("Sent.");
    }),
  );
  return el(
    "div",
    { className: "setting" },
    el("span", { className: "title" }, "IR power code"),
    el("p", { className: "hint" }, 'For projector power "relay-ir". Point the remote at the IR receiver and press its power button after choosing Learn.'),
    el("div", { className: "control" }, code),
    el("div", { className: "actions" }, learn, test),
  );
}

// The HTTPS certificate: upload a PEM pair or make a self-signed one. These act at once, not through Apply.
function tlsCard() {
  const box = el("div", {});
  const certFile = el("input", { type: "file", accept: ".pem,.crt,.cer", attrs: { "aria-label": "Certificate file (PEM)" } });
  const keyFile = el("input", { type: "file", accept: ".pem,.key", attrs: { "aria-label": "Private key file (PEM)" } });
  const draw = ({ https, cert }) => {
    const status = !https.enabled
      ? "HTTPS is off."
      : https.running
        ? `HTTPS is running on port ${https.port}.`
        : https.error ?? "HTTPS is starting…";
    const rows = cert
      ? [
          ["Issued to", cert.subject],
          ["Issued by", cert.selfSigned ? "itself (self-signed)" : cert.issuer],
          ["Names", cert.names.join(", ") || "none"],
          ["Valid until", new Date(cert.validTo).toLocaleDateString()],
          ["SHA-256", cert.fingerprint],
        ]
      : [];
    const expired = cert && new Date(cert.validTo) < new Date();
    box.replaceChildren(
      el("p", { className: https.enabled && !https.running ? "warn-box" : "hint" }, status),
      cert ? el("table", { className: "kv" }, ...rows.map(([k, v]) => el("tr", {}, el("th", {}, k), el("td", { className: k === "SHA-256" ? "mono" : "" }, v)))) : el("p", { className: "hint" }, "No certificate yet."),
      ...(expired ? [el("p", { className: "warn-box" }, "This certificate has expired. Make a new one or upload another.")] : []),
    );
    remove.hidden = !cert;
  };
  const act = (fn) => () =>
    run(async () => {
      for (const b of [make, upload, remove]) b.disabled = true;
      try {
        draw(await fn());
      } finally {
        for (const b of [make, upload, remove]) b.disabled = false;
      }
    });
  const make = el("button", { type: "button" }, "Make self-signed certificate");
  make.addEventListener(
    "click",
    act(async () => {
      const r = await api("/api/tls/self-signed", json("POST", {}));
      toast("Made a self-signed certificate. Browsers warn about it once; accept it for this Pi.");
      return r;
    }),
  );
  const upload = el("button", { type: "button" }, "Upload certificate and key");
  upload.addEventListener(
    "click",
    act(async () => {
      const [c, k] = [certFile.files?.[0], keyFile.files?.[0]];
      if (!c || !k) throw new Error("Choose the certificate file and the key file first.");
      const r = await api("/api/tls", json("PUT", { cert: await c.text(), key: await k.text() }));
      certFile.value = keyFile.value = "";
      toast("Certificate installed.");
      return r;
    }),
  );
  const remove = el("button", { type: "button", className: "danger" }, "Remove certificate");
  remove.addEventListener(
    "click",
    act(async () => {
      if (!confirm("Remove the certificate? HTTPS stops until you add another.")) return api("/api/tls");
      const r = await api("/api/tls", json("DELETE", {}));
      toast("Certificate removed.");
      return r;
    }),
  );
  run(async () => draw(await api("/api/tls")));
  return el(
    "div",
    { className: "setting" },
    el("span", { className: "title" }, "HTTPS certificate"),
    el("p", { className: "hint" }, "Upload a PEM certificate (a chain is fine) and its unencrypted private key, or make a self-signed one for this Pi's names and current addresses."),
    box,
    el("div", { className: "control" }, el("label", {}, "Certificate ", certFile), el("label", {}, "Private key ", keyFile)),
    el("div", { className: "actions" }, make, upload, remove),
  );
}

export function mount(root, { sub }) {
  let group = null;
  let lastSettings = null;
  let ir = null;

  const search = el("input", { type: "search", placeholder: "Search settings", attrs: { "aria-label": "Search settings" } });
  const subnav = el("nav", { className: "subnav", attrs: { "aria-label": "Settings groups" } });
  const body = el("div", {});
  const dmxBox = el("div", {});
  root.append(el("div", { className: "toolbar" }, search, advancedToggle()), subnav, body);

  const syncIr = () => {
    if (ir) ir.hidden = effective("projectorPower") !== "relay-ir";
  };
  const offPending = pending.subscribe(syncIr);

  function draw() {
    ir = null;
    const data = state.settings;
    if (!data) return body.replaceChildren(el("p", { className: "hint" }, "Loading…"));
    const advanced = advancedShown();

    if (search.value.trim()) {
      subnav.hidden = true;
      const found = visibleItems(data.settings.filter((s) => GROUP_VIEW[s.group] !== "dashboard"), { advanced, query: search.value });
      body.replaceChildren(
        ...(found.length
          ? found.map((s) => {
              const row = rowOf(s);
              row.querySelector(".setting-head")?.append(el("span", { className: "tag" }, s.group));
              return row;
            })
          : [el("p", { className: "hint" }, "No settings match.")]),
      );
      return;
    }

    subnav.hidden = false;
    const inGroup = (g) => visibleItems(data.settings.filter((s) => s.group === g), { advanced, query: "" });
    const groups = SETTINGS_GROUPS.filter((g) => inGroup(g).length > 0); // an empty group (Advanced, in Simple mode) drops out
    group = groups.find((g) => groupSlug(g) === sub) ?? groups[0];
    subnav.replaceChildren(...groups.map((g) => el("a", { href: `#/settings/${groupSlug(g)}`, attrs: g === group ? { "aria-current": "page" } : {} }, g)));

    const before = [];
    const after = [];
    if (group === "Hardware") {
      before.push(el("p", { className: "hint" }, "Change these in /etc/default/videofx over SSH, then restart. Ports need root (port 80 and the Bonjour entry); paths would let this page point the service anywhere."));
      before.push(fixedRow({ label: "Raspberry Pi model", value: data.device?.model ?? "unknown (not a Pi?)", key: "model", apply: "detected" }));
      after.push(pinTable(data.settings));
    }
    if (group === "Advanced") before.push(el("p", { className: "warn-box" }, "Wrong mpv options can stop playback. IPC, scripting, config, file and network options are refused."));
    if (group === "Projector") {
      ir = irCard();
      after.push(ir);
      syncIr();
    }
    if (group === "Web page") after.push(tlsCard());
    if (group === "DMX") {
      after.push(dmxBox);
      if (state.status) renderDmx(dmxBox, state.status.dmx ?? {});
    }
    body.replaceChildren(el("section", {}, el("h3", {}, group ?? "Settings"), ...before, ...inGroup(group).map(rowOf), ...after));
  }

  search.addEventListener("input", draw);
  draw(); // shows "Loading…" until the settings arrive

  return {
    helpSlug: () => (group ? groupSlug(group) : "device"),
    unmount: offPending,
    update(s) {
      if (s.status) renderDmx(dmxBox, s.status.dmx ?? {});
      // Never rebuild rows under someone who is typing; the next update tries again.
      if (s.settings !== lastSettings && safeToRebuild(root)) {
        lastSettings = s.settings;
        draw();
      }
    },
  };
}
