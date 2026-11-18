import { describe, it, expect } from 'vitest';
import { SmokeStirs } from './smokeStirs';
import type { Stir } from './airGrid';
import { beam, frame, projectile, ring } from './smokeStirs.testkit';

describe('SmokeStirs chain guard', () => {
    it('makes no chain for a position that is not a finite number, and recovers on the next frame', () => {
        const stirs = new SmokeStirs(), out: Stir[] = [];
        stirs.collect(frame({ projectiles: [projectile('r1', 100, 200, 10, 0)] }), null, out);
        stirs.collect(frame({ projectiles: [projectile('r1', Number.NaN, 200, 10, 0)] }), null, out);
        expect(out.length).toBe(0);
        stirs.collect(frame({ projectiles: [projectile('r1', Infinity, 200, 10, 0)] }), null, out);
        expect(out.length).toBe(0);
        stirs.collect(frame({ projectiles: [projectile('r1', 150, 200, 10, 0)] }), null, out);
        expect(out.length).toBe(0);                          // the last good point was lost with the bad ones: nothing to chain from
        stirs.collect(frame({ projectiles: [projectile('r1', 170, 200, 10, 0)] }), null, out);
        expect(out.length).toBe(3);                          // 150 -> 170: 0, 7, 14
    });

    it('caps a chain at 400 points, whatever the distance', () => {
        const stirs = new SmokeStirs(), out: Stir[] = [];
        stirs.collect(frame({ projectiles: [projectile('r1', 0, 0, 0, 0)] }), null, out);
        stirs.collect(frame({ projectiles: [projectile('r1', 1e9, 0, 0, 0)] }), null, out);
        expect(out.length).toBe(400);
        stirs.collect(frame({ beams: [beam('b1', 0, 0, 1e7, 0)] }), null, out);
        expect(out.length).toBe(400);
    });
});

describe('SmokeStirs reset', () => {
    it('forgets projectiles and remembered ring and beam ids, so old ones stir again as new', () => {
        const stirs = new SmokeStirs(), out: Stir[] = [];
        const state = frame({ projectiles: [projectile('r1', 100, 200, 10, 0)], particles: [ring('ring_1', 0, 0)], beams: [beam('b1', 0, 0, 0, 20)] });
        stirs.collect(state, null, out);
        stirs.reset();
        expect(stirs.trackedProjectiles).toBe(0);
        expect(stirs.trackedIds).toBe(0);
        // Moved far while nothing was watching: without the memory the chain starts one tick back, not at the old point
        stirs.collect(frame({ projectiles: [projectile('r1', 5000, 200, 10, 0)] }), null, out);
        expect(out.length).toBe(2);                          // 4990 -> 5000: 0, 7
        expect(out[0].x).toBeCloseTo(4990, 6);
    });
});
