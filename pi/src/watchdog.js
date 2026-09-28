// systemd service watchdog (Type=notify, WatchdogSec=). The ping comes from the
// main event loop: if the loop hangs, or a health check fails, pings stop and
// systemd restarts the service. The Pi's hardware watchdog (RuntimeWatchdogSec)
// covers a hung kernel.
//
// Node can't send to a Unix datagram socket without a native addon, so pings go
// through `systemd-notify` (NotifyAccess=all). Attribution of the short-lived
// helper's message to our unit relies on SCM_PIDFD (systemd >= 254 with kernel
// >= 6.5), which Debian trixie has.

export class Watchdog {
  #notify;
  #intervalMs;
  #healthy;
  #log;
  #setInterval;
  #clearInterval;
  #timer = null;
  #inFlight = false;
  #ready = false;
  #lastProblem = null;

  /**
   * @param {object} o
   * @param {(message: string) => Promise<void>} o.notify  sends e.g. "WATCHDOG=1"
   * @param {string|number|undefined} o.watchdogUsec        $WATCHDOG_USEC from systemd
   * @param {() => string|null} [o.healthy]                 null when fine, else what's wrong
   */
  constructor({ notify, watchdogUsec, healthy = () => null, log = console, setInterval: si = setInterval, clearInterval: ci = clearInterval }) {
    this.#notify = notify;
    const usec = Number(watchdogUsec);
    // systemd recommends pinging at half the timeout.
    this.#intervalMs = Number.isFinite(usec) && usec > 0 ? Math.max(1000, Math.floor(usec / 2000)) : null;
    this.#healthy = healthy;
    this.#log = log;
    this.#setInterval = si;
    this.#clearInterval = ci;
  }

  get enabled() {
    return this.#intervalMs !== null;
  }

  get intervalMs() {
    return this.#intervalMs;
  }

  /** Tell systemd we're up (once), and start pinging if a watchdog is configured. */
  async ready() {
    if (!this.#ready) {
      this.#ready = true;
      await this.#send("READY=1");
    }
    if (this.enabled && !this.#timer) {
      this.#timer = this.#setInterval(() => this.tick(), this.#intervalMs);
      this.#timer?.unref?.();
    }
  }

  /** One ping, if healthy and the previous ping has finished. */
  async tick() {
    if (this.#inFlight) return "busy"; // a stuck helper must not pile up processes
    const problem = this.#healthy();
    if (problem) {
      if (problem !== this.#lastProblem) this.#log.error(`Watchdog: not pinging: ${problem}`);
      this.#lastProblem = problem;
      return "unhealthy";
    }
    this.#lastProblem = null;
    await this.#send("WATCHDOG=1");
    return "pinged";
  }

  async stopping() {
    if (this.#timer) this.#clearInterval(this.#timer);
    this.#timer = null;
    await this.#send("STOPPING=1");
  }

  async #send(message) {
    this.#inFlight = true;
    try {
      await this.#notify(message);
    } catch (err) {
      this.#log.warn(`systemd-notify ${message}: ${err.message}`);
    } finally {
      this.#inFlight = false;
    }
  }
}
