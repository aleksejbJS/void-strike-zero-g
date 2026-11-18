// Shared helpers for the SootPlumes tests: a fake flame engine view whose soot points the test moves, frames
// that carry it, a frame runner and a few readings of a plume's grid.

import type { AirGrid } from './airGrid';
import type { FlameAir } from './flameAir';
import type { SmokeFrame } from './cloudField';
import type { SootPlumes } from './sootPlumes';
import { FRAME_MS, VIEW, frameOf, stateOf } from './cloudField.testkit';
import type { SmokeQuality } from './smokeTuning';

export type Point = { x: number; y: number };

/** A flame view whose soot is whatever `points` holds right now (the test edits the array between frames). */
export const airOf = (points: Point[]): FlameAir => ({
    streams: () => [],
    forEachSoot: (visit) => { for (const p of points) visit(p.x, p.y, 0, 2); },    // fresh particles: they leave their full amount
    hasSoot: () => points.length > 0,
});

/** A frame over the usual 1600 x 900 view whose flame view is `points`. */
export const sootFrame = (points: Point[], quality: SmokeQuality = 'high', state = stateOf()): SmokeFrame =>
    ({ ...frameOf(state, VIEW, quality), flame: airOf(points) });

/** Sync `plumes` for `n` frames of `ms` each after `start`, with `dt` as the frame time; returns the time of the last frame. */
export function runFrames(plumes: SootPlumes, frame: SmokeFrame, n: number, start: number, ms = FRAME_MS): number {
    let now = start;
    for (let i = 0; i < n; i++) { now += ms; plumes.sync(now, frame, [], ms / 1000); }
    return now;
}

/** Mean world y of the soot in `grid`, weighted by soot (NaN when there is none). */
export function sootMeanY(grid: AirGrid): number {
    let sum = 0, weight = 0;
    for (let j = 0; j < grid.n; j++) {
        for (let i = 0; i < grid.n; i++) {
            const s = grid.s[i + j * grid.n];
            sum += s * (grid.y0 + (j + 0.5) * grid.cell);
            weight += s;
        }
    }
    return sum / weight;
}

/** Total soot over the grid, in cell units. */
export const sootTotal = (grid: AirGrid): number => grid.s.reduce((a, b) => a + b, 0);
