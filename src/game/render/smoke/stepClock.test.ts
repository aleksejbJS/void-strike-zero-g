import { describe, it, expect } from 'vitest';
import { StepClock } from './stepClock';

/** Total steps and their dt over `frames` frames of `ms` each, after a first tick at time 0. */
const run = (full: boolean, frames: number, ms: number) => {
    const clock = new StepClock(0);
    let steps = 0, time = 0;
    for (let i = 1; i <= frames; i++) {
        const n = clock.tick(i * ms, full);
        steps += n;
        time += n * clock.dt;
    }
    return { steps, time };
};

describe('StepClock', () => {
    it('full rate: one 1/60 s step per 60 Hz frame, and the same real time at other frame rates', () => {
        expect(run(true, 10, 1000 / 60)).toEqual({ steps: 10, time: expect.closeTo(10 / 60, 9) });
        expect(run(true, 10, 1000 / 120).steps).toBe(5);
        expect(run(true, 60, 1000 / 144).steps).toBe(25);                  // 417 ms of frames: 25 steps of 16.7 ms
    });

    it('half rate: one 2/60 s step per two 60 Hz frames', () => {
        const { steps, time } = run(false, 10, 1000 / 60);
        expect(steps).toBe(5);
        expect(time).toBeCloseTo(10 / 60, 9);
        expect(run(false, 20, 1000 / 120).steps).toBe(5);                  // 167 ms: a step per 33 ms
    });

    it('full rate: a long gap runs at most three steps and the lost time is not owed', () => {
        const clock = new StepClock(0);
        expect(clock.tick(10_000, true)).toBe(3);
        expect(clock.tick(10_000 + 1000 / 60, true)).toBe(1);
    });

    it('half rate: a long gap runs one step, never several', () => {
        const clock = new StepClock(0);
        const f = 1000 / 60;
        expect(clock.tick(10_000, false)).toBe(1);
        expect(clock.dt).toBeCloseTo(2 / 60, 9);
        // The cap held 50 ms and the step used 33: the 17 ms left is kept, so the next frame is due, then the pace is every second frame
        expect([1, 2, 3, 4].map(i => clock.tick(10_000 + i * f, false))).toEqual([1, 0, 1, 0]);
    });

    it('gathers nothing while skipped', () => {
        const clock = new StepClock(0);
        clock.skip(5000);
        expect(clock.tick(5000 + 1000 / 120, true)).toBe(0);
        expect(clock.tick(5000 + 1000 / 60, true)).toBe(1);
    });

    it('ignores a clock that runs backwards', () => {
        const clock = new StepClock(1000);
        expect(clock.tick(500, true)).toBe(0);
        expect(clock.tick(500 + 1000 / 60, true)).toBe(1);
    });

    it('wouldStep says whether tick would step now, and changes nothing', () => {
        const clock = new StepClock(0), frame = 1000 / 120;
        expect(clock.wouldStep(frame, true)).toBe(false);
        expect(clock.wouldStep(2 * frame, true)).toBe(true);
        expect(clock.wouldStep(2 * frame, false)).toBe(false);                // half rate needs two step periods
        expect(clock.wouldStep(4 * frame, false)).toBe(true);
        expect(clock.tick(2 * frame, true)).toBe(1);                          // the questions did not use the time up
    });
});

