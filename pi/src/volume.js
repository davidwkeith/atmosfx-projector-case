// Speaker volume on the amplifier's hardware mixer (Raspberry Pi DigiAMP+: ALSA card
// "RPiDigiAMP", simple control "Digital"). Persisted in settings.json so it
// survives reboots; first boot starts low because outdoor speakers can be loud.

export const DEFAULT_VOLUME = { level: 30, muted: false };

export function clampLevel(level) {
  const n = Number(level);
  if (typeof level === "boolean" || level === null || level === "" || !Number.isFinite(n)) {
    throw new Error("level must be a number from 0 to 100");
  }
  return Math.min(100, Math.max(0, Math.round(n)));
}

export class Volume {
  #store;
  #apply;
  #log;
  #defaultLevel;

  /**
   * @param {object} o
   * @param {{load: () => any, save: (v: {level: number, muted: boolean}) => void}} o.store
   * @param {(v: {level: number, muted: boolean}) => Promise<void>} o.apply  sets the mixer
   * @param {number} [o.defaultLevel]
   */
  constructor({ store, apply, defaultLevel = DEFAULT_VOLUME.level, log = console }) {
    this.#store = store;
    this.#apply = apply;
    this.#log = log;
    this.#defaultLevel = defaultLevel;
  }

  /** The stored state, read fresh each time (settings can change it too). */
  get state() {
    const saved = this.#store.load();
    let level = this.#defaultLevel;
    try {
      if (saved && saved.level !== undefined) level = clampLevel(saved.level);
    } catch {
      // corrupt value: fall back to the safe default
    }
    return { level: clampLevel(level), muted: saved?.muted === true };
  }

  /** Push the current state to the mixer (at startup, or after the card appears). */
  async applyCurrent() {
    try {
      await this.#apply(this.state);
    } catch (err) {
      this.#log.error(`Volume: ${err.message}`);
      throw err;
    }
  }

  /** Change level and/or mute, persist, then set the mixer. */
  async set({ level, muted } = {}) {
    const next = this.state;
    if (level !== undefined) next.level = clampLevel(level);
    if (muted !== undefined) {
      if (typeof muted !== "boolean") throw new Error("muted must be true or false");
      next.muted = muted;
    }
    this.#store.save(next);
    await this.applyCurrent();
    return this.state;
  }
}

/** amixer arguments for a state. -M: perceptual (mapped) volume scale. */
export function amixerArgs(card, control, { level, muted }) {
  return ["-q", "-c", card, "-M", "sset", control, `${level}%`, muted ? "mute" : "unmute"];
}
