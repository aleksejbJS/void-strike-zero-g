import { describe, it, expect } from 'vitest';
import { FixedStepper, FIXED_STEP_MS } from './fixedStep';
import { PHYSICS_TICK_RATE } from '../../constants';

const runFrames = (stepper: FixedStepper, frameMs: number, frames: number) => {
    let ticks = 0;
    for (let i = 0; i < frames; i++) stepper.advance(frameMs, () => ticks++);
    return ticks;
};

describe('FixedStepper', () => {
    it.each([
        ['60 Hz', 60],
        ['120 Hz', 120],
        ['144 Hz', 144],
        ['240 Hz', 240],
    ])('runs PHYSICS_TICK_RATE ticks per second on a %s display', (_label, hz) => {
        const ticks = runFrames(new FixedStepper(), 1000 / hz, hz);
        expect(ticks).toBeGreaterThanOrEqual(PHYSICS_TICK_RATE - 1);
        expect(ticks).toBeLessThanOrEqual(PHYSICS_TICK_RATE);
    });

    it('runs the same tick count every frame under normal 60 Hz vsync jitter', () => {
        const stepper = new FixedStepper();
        const perFrame = Math.round((1000 / 60) / FIXED_STEP_MS);
        for (const frameMs of [16.5, 16.8, 16.6, 16.7, 16.4, 16.9]) {
            let ticks = 0;
            stepper.advance(frameMs, () => ticks++);
            expect(ticks).toBe(perFrame);
        }
    });

    it('caps catch-up ticks after a long stall and drops the backlog', () => {
        const stepper = new FixedStepper();
        let ticks = 0;
        stepper.advance(2000, () => ticks++);
        expect(ticks).toBe(10);

        ticks = 0;
        stepper.advance(FIXED_STEP_MS, () => ticks++);
        expect(ticks).toBe(1);
    });

    it('ignores negative frame times', () => {
        const stepper = new FixedStepper();
        let ticks = 0;
        stepper.advance(-50, () => ticks++);
        expect(ticks).toBe(0);
    });
});
