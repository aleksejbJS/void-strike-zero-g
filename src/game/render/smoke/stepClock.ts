// The step schedule of one smoke grid: how many fixed steps are due this frame, and how long each is.
// A full-rate grid runs STEP_HZ steps per second, catching up after a hitch by at most MAX_CATCHUP_STEPS.
// A half-rate grid runs one double-length step every second step period: the time it has gathered is
// used up by that one step and never caught up. Visual only.

import { MAX_CATCHUP_STEPS, STEP_HZ } from './smokeTuning';

const STEP_S = 1 / STEP_HZ;
const CAP_S = MAX_CATCHUP_STEPS * STEP_S;       // the most time a clock holds, so a long pause does not turn into a long run
const EPS_S = 1e-9;                             // frame times are floats: 10 frames of 1000/60 ms must still give 10 steps

export class StepClock {
    /** Length of each step the last tick() asked for, in seconds. */
    dt = STEP_S;
    private held = 0;                           // seconds gathered and not yet stepped
    private last: number;

    constructor(now: number) {
        this.last = now;
    }

    /** Count the time since the last call and return how many steps of `this.dt` seconds to run now. `now` is in ms. */
    tick(now: number, full: boolean): number {
        this.held = Math.min(this.held + Math.max(0, now - this.last) / 1000, CAP_S);
        this.last = now;
        if (full) {
            this.dt = STEP_S;
            const steps = Math.min(MAX_CATCHUP_STEPS, Math.floor((this.held + EPS_S) / STEP_S));
            this.held = Math.max(0, this.held - steps * STEP_S);
            return steps;
        }
        this.dt = 2 * STEP_S;
        if (this.held + EPS_S < this.dt) return 0;
        this.held = Math.max(0, this.held - this.dt);
        return 1;
    }

    /** Time passes with no steps (the grid is out of view): it gathers nothing, so it does not catch up later. */
    skip(now: number): void {
        this.last = now;
        this.held = 0;
    }
}
