import { describe, it, expect } from 'vitest';
import { TrailWalker } from './trailWalker';
import { JUMP } from './blastTuning';

type P = { x: number; y: number };

/** Walk `id` through `xs` (y = 0), one frame each, collecting the points. */
const walkAll = (w: TrailWalker, id: string, xs: number[], step: number): P[] => {
    const out: P[] = [];
    for (const x of xs) {
        w.walk(id, x, 0, step, (px, py) => out.push({ x: px, y: py }));
        w.endFrame();
    }
    return out;
};

describe('TrailWalker', () => {
    it('gives one point where a thing is first seen', () => {
        expect(walkAll(new TrailWalker(), 'r', [100], 5)).toEqual([{ x: 100, y: 0 }]);
    });

    it('cuts the path every step px, carrying the rest into the next frame', () => {
        const pts = walkAll(new TrailWalker(), 'r', [0, 7, 14, 21], 5);
        expect(pts.map(p => p.x)).toEqual([0, 5, 10, 15, 20]);
    });

    it('spacing does not depend on how the path is split into frames', () => {
        const fine = walkAll(new TrailWalker(), 'r', Array.from({ length: 61 }, (_, i) => i), 5).map(p => p.x);
        const coarse = walkAll(new TrailWalker(), 'r', [0, 13, 29, 60], 5).map(p => p.x);
        expect(coarse).toEqual(fine);
    });

    it('a jump farther than JUMP gives no points across the gap and starts over there', () => {
        const pts = walkAll(new TrailWalker(), 'r', [0, JUMP + 50, JUMP + 60], 5);
        expect(pts.map(p => p.x)).toEqual([0, JUMP + 55, JUMP + 60]);
    });

    it('forgets things not walked in a frame', () => {
        const w = new TrailWalker();
        walkAll(w, 'a', [0], 5);
        expect(w.size).toBe(1);
        w.endFrame();
        expect(w.size).toBe(0);
        expect(walkAll(w, 'a', [50], 5)).toEqual([{ x: 50, y: 0 }]);      // seen anew: one point, no line from 0
    });

    it('a thing standing still gives no more points', () => {
        expect(walkAll(new TrailWalker(), 'r', [10, 10, 10], 5)).toHaveLength(1);
    });
});
