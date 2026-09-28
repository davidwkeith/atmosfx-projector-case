import { describe, expect, it, vi } from "vitest";
import { checkPins, deviceIds, deviceName, loadConfig, resolveSettings } from "../src/config.js";
import { mpvArgs } from "../src/mpv.js";

const ctx = { home: "/home/pi", deviceName: "VideoFX-BEEF", hostName: "videofx-beef" };

describe("config", () => {
  it("defaults: ~/media/playlist.m3u, restore=last, loop mode, HiFiBerry audio by card name, port 80", () => {
    const c = loadConfig({}, ctx);
    expect(c.playlist).toBe("/home/pi/media/playlist.m3u");
    expect(c.restore).toBe("last");
    expect(c.mode).toBe("loop");
    expect(c.httpPort).toBe(80);
    expect(c.password).toBe("");
    expect(c.name).toBe("VideoFX-BEEF");
    expect([c.audioCard, c.mixerControl, c.volume]).toEqual(["sndrpihifiberry", "Digital", 30]);
    expect([c.scareCooldown, c.scareDuringScare, c.scareOrder]).toEqual([20, "ignore", "sequential"]);
    expect([c.pirEnabled, c.pirPin, c.relayPin, c.irTxPin, c.irRxPin]).toEqual([false, 17, 27, 22, 23]);
    expect(c.projectorPower).toBe("cec");
    expect(c.mpv).toBe("mpv");
    expect([c.fan1PwmPin, c.fan2PwmPin, c.fan1TachPin, c.fan2TachPin, c.w1Pin]).toEqual([12, 13, 24, 25, 26]);
    expect([c.thermalEnabled, c.tempCritC, c.tempHysteresisC, c.fanMinDuty]).toEqual([false, 55, 5, 30]);
  });

  it("builds mpv arguments: DRM connector, Amp4 by card name, IPC socket, idle", () => {
    const args = mpvArgs(loadConfig({}, ctx), "/run/videofx/mpv.sock");
    expect(args).toContain("--input-ipc-server=/run/videofx/mpv.sock");
    expect(args).toContain("--idle=yes");
    expect(args).toContain("--drm-connector=HDMI-A-1");
    expect(args).toContain("--audio-device=alsa/plughw:CARD=sndrpihifiberry,DEV=0");
    expect(args).toContain("--gpu-context=drm");
    expect(args).toContain("--osd-level=0");
    expect(args).toContain("--no-config");
    expect(args.join(" ")).not.toMatch(/hdmi:/);
  });

  it("can leave the connector to mpv or pick another; extra args come last", () => {
    expect(mpvArgs(loadConfig({ VIDEOFX_VIDEO_OUTPUT: "" }, ctx), "s").join(" ")).not.toMatch(/drm-connector/);
    const args = mpvArgs(loadConfig({ VIDEOFX_VIDEO_OUTPUT: "HDMI-A-2", VIDEOFX_MPV_EXTRA_ARGS: "--hwdec=v4l2m2m-copy" }, ctx), "s");
    expect(args).toContain("--drm-connector=HDMI-A-2");
    expect(args.at(-1)).toBe("--hwdec=v4l2m2m-copy");
    expect(() => loadConfig({ VIDEOFX_VIDEO_OUTPUT: "HDMI-A-1 --input-ipc-server=/tmp/x" }, ctx)).toThrow(/VIDEOFX_VIDEO_OUTPUT/);
  });

  it("honours overrides", () => {
    const c = loadConfig(
      {
        VIDEOFX_PLAYLIST: "/srv/videofx.m3u",
        VIDEOFX_RESTORE: "off",
        VIDEOFX_WEB_PASSWORD: "secret-pw",
        VIDEOFX_MAX_UPLOAD_MB: "10",
        VIDEOFX_AUDIO_CARD: "Headphones",
        VIDEOFX_MODE: "scare",
        VIDEOFX_SCARE_CLIPS: '["a.mp4","b.mp4"]',
        VIDEOFX_LATITUDE: "37.77",
        VIDEOFX_LONGITUDE: "-122.42",
        STATE_DIRECTORY: "/var/lib/videofx",
      },
      ctx,
    );
    expect(c.playlist).toBe("/srv/videofx.m3u");
    expect(c.restore).toBe("off");
    expect(c.stateDir).toBe("/var/lib/videofx");
    expect(c.password).toBe("secret-pw");
    expect(c.maxUploadMb).toBe(10);
    expect(c.mode).toBe("scare");
    expect(c.scareClips).toEqual(["a.mp4", "b.mp4"]);
    expect([c.latitude, c.longitude]).toEqual([37.77, -122.42]);
    expect(mpvArgs(c, "s")).toContain("--audio-device=alsa/plughw:CARD=Headphones,DEV=0");
  });

  it("keeps an empty VIDEOFX_CONSOLE (disabled) but treats other empty values as unset", () => {
    const c = loadConfig({ VIDEOFX_CONSOLE: "", VIDEOFX_RESTORE: "", VIDEOFX_HTTP_PORT: "" }, ctx);
    expect(c.console).toBe("");
    expect(c.restore).toBe("last");
    expect(c.httpPort).toBe(80);
  });

  it("rejects an unknown restore policy", () => {
    expect(() => loadConfig({ VIDEOFX_RESTORE: "maybe" }, ctx)).toThrow(/VIDEOFX_RESTORE/);
  });

  it("warns that old VLC settings are not used any more", () => {
    const warn = vi.fn();
    resolveSettings({ env: { VIDEOFX_VLC_EXTRA_ARGS: "--vout=drm_vout", VIDEOFX_VLC: "cvlc" }, ctx, warn });
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/VIDEOFX_VLC_EXTRA_ARGS is no longer used/));
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/VIDEOFX_VLC is no longer used/));
  });
});

describe("GPIO pins", () => {
  const base = { pirPin: 17, relayPin: 27, irTxPin: 22, irRxPin: 23, irTxDriver: "gpio-ir-tx" };
  it("accepts the default layout", () => expect(checkPins(base)).toBeUndefined());
  it("refuses two roles on one pin", () => {
    expect(checkPins({ ...base, relayPin: 17 })).toMatch(/GPIO17 is set for both the PIR and the relay/);
    expect(checkPins({ ...base, irRxPin: 22 })).toMatch(/GPIO22/);
  });
  it.each([2, 3, 4, 18, 19, 20, 21])("refuses Amp4 pin GPIO%i for any role", (pin) => {
    expect(checkPins({ ...base, pirPin: pin })).toMatch(/Amp4/);
    expect(() => loadConfig({ VIDEOFX_PIR_GPIO: String(pin) }, ctx)).toThrow(/Amp4/);
    expect(() => loadConfig({ VIDEOFX_RELAY_GPIO: String(pin) }, ctx)).toThrow(/Amp4/);
  });
  it("pwm-ir-tx is refused: its PWM0 channel drives the projector fan", () => {
    expect(checkPins({ ...base, irTxDriver: "pwm-ir-tx", irTxPin: 12 })).toMatch(/fan/);
  });
  it("the fan and 1-wire pins join the budget", () => {
    const all = { ...base, fan1PwmPin: 12, fan2PwmPin: 13, fan1TachPin: 24, fan2TachPin: 25, w1Pin: 26 };
    expect(checkPins(all)).toBeUndefined();
    expect(checkPins({ ...all, w1Pin: 17 })).toMatch(/GPIO17 is set for both the PIR and the 1-wire sensors/);
    expect(checkPins({ ...all, fan2TachPin: 24 })).toMatch(/GPIO24/);
  });
  it("a file conflict is an error in strict mode and a warning otherwise", () => {
    expect(() => loadConfig({ VIDEOFX_PIR_GPIO: "27" }, ctx)).toThrow(/both/);
    const warn = vi.fn();
    resolveSettings({ env: { VIDEOFX_PIR_GPIO: "27" }, ctx, warn });
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/both/));
  });
});

describe("device name", () => {
  const mac = (m) => [{ mac: m, address: "x" }];
  it("keeps a hostname that is already videofx-xxxx, and shows it as VideoFX-XXXX", () => {
    expect(deviceIds("videofx-1a2b", {})).toEqual({ display: "VideoFX-1A2B", host: "videofx-1a2b" });
    expect(deviceIds("VideoFX-1A2B", {})).toEqual({ display: "VideoFX-1A2B", host: "videofx-1a2b" });
  });
  it("uses the last 4 hex digits of eth0: uppercase for display, lowercase for the hostname", () => {
    expect(deviceIds("raspberrypi", { eth0: mac("B8:27:EB:12:AB:CD"), wlan0: mac("b8:27:eb:00:00:01") })).toEqual({
      display: "VideoFX-ABCD",
      host: "videofx-abcd",
    });
    expect(deviceName("raspberrypi", { eth0: mac("b8:27:eb:12:ab:cd") })).toBe("VideoFX-ABCD");
  });
  it("falls back to wlan0, then to the hostname", () => {
    expect(deviceName("raspberrypi", { wlan0: mac("b8:27:eb:00:12:34") })).toBe("VideoFX-1234");
    expect(deviceName("raspberrypi", { eth0: mac("00:00:00:00:00:00") })).toBe("raspberrypi");
  });
});

describe("system/videofx.default", () => {
  it("documents every setting's variable (regenerate with tools/gen-default.mjs)", async () => {
    const { readFile } = await import("node:fs/promises");
    const { SETTINGS } = await import("../src/config.js");
    const text = await readFile(new URL("../system/videofx.default", import.meta.url), "utf8");
    for (const s of SETTINGS.filter((x) => x.env)) expect(text, s.key).toContain(`#${[s.env].flat().at(-1)}=`);
  });
});
