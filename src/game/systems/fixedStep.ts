// Fixed-timestep accumulator: runs simulation ticks at a constant rate
// regardless of display refresh rate (60 Hz, 120 Hz, 144 Hz...).

import { PHYSICS_TICK_RATE } from '../../constants';

export const FIXED_STEP_MS = 1000 / PHYSICS_TICK_RATE;

// After a long stall (tab switch, GC pause) drop the backlog instead of
// running dozens of catch-up ticks in one frame (~83ms of simulation max)
const MAX_STEPS_PER_FRAME = 10;

// Frame times within this distance of a half-step multiple are treated as exact,
// so normal vsync jitter (16.5ms, 16.8ms...) doesn't cause uneven tick counts
const SNAP_TOLERANCE_MS = 0.5;

export class FixedStepper {
    private accumulator = 0;

    constructor(
        private readonly stepMs = FIXED_STEP_MS,
        private readonly maxSteps = MAX_STEPS_PER_FRAME
    ) {}

    /** Add frameMs of real time and run tick() as many times as it covers. Returns ticks run. */
    advance(frameMs: number, tick: () => void): number {
        this.accumulator += this.snap(Math.max(0, frameMs));

        let steps = 0;
        while (this.accumulator >= this.stepMs && steps < this.maxSteps) {
            tick();
            this.accumulator -= this.stepMs;
            steps++;
        }

        // Still behind after the cap — skip the rest rather than spiral
        if (this.accumulator >= this.stepMs) this.accumulator = 0;
        return steps;
    }

    reset() {
        this.accumulator = 0;
    }

    private snap(frameMs: number): number {
        const halfSteps = Math.round(frameMs / (this.stepMs / 2));
        const snapped = halfSteps * (this.stepMs / 2);
        return halfSteps > 0 && Math.abs(frameMs - snapped) < SNAP_TOLERANCE_MS ? snapped : frameMs;
    }
}
