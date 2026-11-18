// A dev-only meter of the smoke's CPU time per frame: SmokeView records how long each sync took, and the meter keeps
// the last WINDOW samples (a rolling average and max), the peak and the mean since its last reset. In a dev build the
// view's meter is exposed as `window.__smokeMs`, so a browser script can read it on the test range; in a production
// build the meter is disabled and records nothing. Visual tooling only.

const WINDOW = 120;                             // samples in the rolling window: one second at 120 fps

export class SmokeMeter {
    private readonly samples = new Float64Array(WINDOW);
    private filled = 0;                         // samples in the window (up to WINDOW)
    private next = 0;                           // where the next sample goes
    private total = 0;                          // sum of every sample since the reset
    private count = 0;                          // samples since the reset
    private top = 0;                            // largest sample since the reset

    constructor(readonly enabled: boolean) {}

    /** Average of the samples in the window, ms (0 with none). */
    get average(): number {
        let sum = 0;
        for (let k = 0; k < this.filled; k++) sum += this.samples[k];
        return this.filled > 0 ? sum / this.filled : 0;
    }

    /** Largest sample in the window, ms. */
    get max(): number {
        let top = 0;
        for (let k = 0; k < this.filled; k++) if (this.samples[k] > top) top = this.samples[k];
        return top;
    }

    /** Largest sample since the reset, ms. */
    get peak(): number {
        return this.top;
    }

    /** Average of every sample since the reset, ms. */
    get mean(): number {
        return this.count > 0 ? this.total / this.count : 0;
    }

    /** Samples since the reset. */
    get frames(): number {
        return this.count;
    }

    /** One frame's smoke time, ms. Ignored when the meter is disabled or the reading is not a finite number >= 0. */
    record(ms: number): void {
        if (!this.enabled || !Number.isFinite(ms) || ms < 0) return;
        this.samples[this.next] = ms;
        this.next = (this.next + 1) % WINDOW;
        if (this.filled < WINDOW) this.filled++;
        this.total += ms;
        this.count++;
        if (ms > this.top) this.top = ms;
    }

    /** Forget every sample. */
    reset(): void {
        this.filled = this.next = this.total = this.count = this.top = 0;
    }
}

/** The meter of a SmokeView: enabled and exposed as `window.__smokeMs` in a dev build, disabled otherwise. */
export function smokeMeterForView(): SmokeMeter {
    const dev = import.meta.env.DEV === true;
    const meter = new SmokeMeter(dev);
    if (dev && typeof window !== 'undefined') (window as unknown as { __smokeMs?: SmokeMeter }).__smokeMs = meter;
    return meter;
}
