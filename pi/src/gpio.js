// One GPIO output held by libgpiod's gpioset (no native addon). gpioset keeps the
// line requested until it is killed (libgpiod 2 default; "--mode=signal" on 1.x),
// so one holder runs at a time and is replaced on change. Used for the relay.

/** gpioset arguments for libgpiod 2 (line by name) or 1.x (gpiochip0 + BCM offset). */
export function gpiosetArgs(major, pin, value, activeLow) {
  if (major >= 2) {
    return ["--consumer=videofx-relay", ...(activeLow ? ["--active-low"] : []), `GPIO${pin}=${value ? 1 : 0}`];
  }
  return ["--mode=signal", ...(activeLow ? ["--active-low"] : []), "gpiochip0", `${pin}=${value ? 1 : 0}`];
}

export class GpioOut {
  #spawn;
  #argsFor;
  #log;
  #child = null;
  #value = null;

  /** argsFor(value) -> gpioset args. */
  constructor({ spawn, argsFor, log = console }) {
    this.#spawn = spawn;
    this.#argsFor = argsFor;
    this.#log = log;
  }

  get value() {
    return this.#value;
  }

  /**
   * Drive the line (logical value: true = active). Resolves once the new holder runs.
   * Calls run one at a time, in order: an off then on a few ms apart must not race
   * for the line, or the relay could end up opposite to what was asked last.
   */
  set(value) {
    const job = this.#queue.then(() => this.#apply(value));
    this.#queue = job.catch(() => {});
    return job;
  }

  #queue = Promise.resolve();

  async #apply(value) {
    if (value === this.#value && this.#child) return;
    this.#value = value;
    // Only one process can hold the line: stop the old holder first. The Pi keeps
    // the last output level while the line is briefly released.
    await this.#stopHolder();
    const args = this.#argsFor(value);
    const child = this.#spawn("gpioset", args, { stdio: ["ignore", "ignore", "inherit"] });
    this.#child = child;
    child.once("error", (err) => this.#log.error(`gpioset: ${err.message}`));
    child.once("exit", (code) => {
      if (this.#child !== child) return;
      this.#child = null;
      if (code) this.#log.error(`gpioset ${args.join(" ")} exited (${code})`);
    });
  }

  #stopHolder() {
    const old = this.#child;
    this.#child = null;
    if (!old || old.exitCode !== null && old.exitCode !== undefined) return Promise.resolve();
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, 1000);
      old.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
      old.kill("SIGTERM");
    });
  }

  release() {
    this.#child?.kill("SIGTERM");
    this.#child = null;
  }
}
