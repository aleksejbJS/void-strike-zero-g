// What every smoke grid on screen shares, cloud or plume: a step clock and a queue of stirs. The stirs of the frames
// since the grid's last step wait in the queue and are applied once, at its next step, each for the time it carries
// (so a grid that steps every second frame gets the same push per second as one that steps every frame). Visual only.

import type { AirGrid, Box, Stir } from './airGrid';
import { StepClock } from './stepClock';

export class GridDriver {
    private readonly clock: StepClock;
    private readonly queue: Stir[] = [];

    /** `box` is the world rect of `grid`: only the stirs that reach it are kept. */
    constructor(private readonly grid: AirGrid, private readonly box: Box, now: number) {
        this.clock = new StepClock(now);
    }

    /** Length of each step the last due() asked for, in seconds. */
    get dt(): number {
        return this.clock.dt;
    }

    /** Keep the stirs of this frame that reach the grid. */
    queueStirs(stirs: readonly Stir[]): void {
        const { x, y, w, h } = this.box;
        for (const st of stirs) {
            if (st.x + st.r < x || st.x - st.r > x + w || st.y + st.r < y || st.y - st.r > y + h) continue;
            this.queue.push(st);
        }
    }

    /** How many steps of `dt` seconds are due at `now` (ms): the fast schedule if `full`, otherwise half rate. */
    due(now: number, full: boolean): number {
        return this.clock.tick(now, full);
    }

    /** Run `steps` steps (from due()): the queued stirs go in once, before the first; `before(dt, at)` runs ahead of each
     *  step, `at` being its date in ms (catch-up steps are dated back from `now`, so the last one is always the present). */
    run(now: number, steps: number, before?: (dt: number, at: number) => void): void {
        const { dt } = this.clock;
        for (let k = 0; k < steps; k++) {
            if (k === 0) this.applyQueue(dt);
            before?.(dt, now - (steps - 1 - k) * dt * 1000);
            this.grid.step(dt);
        }
    }

    /** Out of view: time passes with no steps, and the waiting stirs are dropped. */
    skip(now: number): void {
        this.queue.length = 0;
        this.clock.skip(now);
    }

    /** Drop the waiting stirs. */
    clear(): void {
        this.queue.length = 0;
    }

    // A stir acts for the time it carries, not for the step; `dt` is only for a stir with none
    private applyQueue(dt: number): void {
        for (const st of this.queue) this.grid.stir(st, st.dt ?? dt);
        this.queue.length = 0;
    }
}
