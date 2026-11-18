import { describe, it, expect } from 'vitest';
import type { GameState } from '../../../types';
import { stateOf } from '../smoke/cloudField.testkit';
import { BlastCloud, blastFade } from './blastCloud';
import { BLAST_FADE_S, BLAST_LIFE_S, BLAST_MIN_S } from './blastTuning';

const FRAME = 1000 / 60;
const X = 500, Y = 400;

/** A rocket blast at (X, Y) on a 40-cell grid, run frame by frame up to `ms` after its birth at t = 0. */
const blastRun = (ms: number, state: GameState = stateOf()) => {
    const c = new BlastCloud(X, Y, 1, 40, 0, state);
    for (let t = FRAME; t <= ms; t += FRAME) c.advance(t, state);
    return c;
};

const mass = (c: BlastCloud) => c.grid.d.reduce((a, x) => a + x, 0);

/** Density-weighted mean height of the smoke, px. */
const heightOf = (c: BlastCloud) => {
    const { n, d, y0, cell } = c.grid;
    let m = 0, my = 0;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const w = d[i + j * n]; m += w; my += w * (y0 + (j + 0.5) * cell); }
    return my / m;
};

describe('BlastCloud', () => {
    it('shows smoke on its first frame, around the blast point', () => {
        const c = blastRun(0);
        const { n, cell, x0, y0 } = c.grid;
        const i = Math.floor((X - x0) / cell), j = Math.floor((Y - y0) / cell);
        expect(c.grid.d[i + j * n]).toBeGreaterThan(0.1);
        c.destroy();
    });

    it('the fireball pours: more smoke, hot and sooty, after a third of a second', () => {
        const first = mass(blastRun(0)), c = blastRun(330);
        expect(mass(c)).toBeGreaterThan(first * 2);
        expect(Math.max(...c.grid.t)).toBeGreaterThan(0.5);
        expect(Math.max(...c.grid.s)).toBeGreaterThan(0.3);
        c.destroy();
    });

    it('the hot smoke rises', () => {
        const early = heightOf(blastRun(300)), late = heightOf(blastRun(1300));
        expect(late).toBeLessThan(early - 10);
    });

    it('no smoke inside a floor under the blast', () => {
        const floor = { x: 0, y: Y + 10, w: 2000, h: 200 };
        const c = blastRun(800, stateOf({ platforms: [floor] } as Partial<GameState>));
        const { n, cell, y0, d, solid } = c.grid;
        let inside = 0, cells = 0;
        for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
            if (y0 + (j + 0.5) * cell <= floor.y + 1) continue;
            cells++;
            inside += d[i + j * n];
            expect(solid[i + j * n]).toBe(1);
        }
        expect(cells).toBeGreaterThan(0);
        expect(inside).toBe(0);
        c.destroy();
    });

    it('is not spent while young, and is spent after its life at the latest', () => {
        const c = new BlastCloud(X, Y, 1, 24, 0, stateOf());
        expect(c.isSpent(BLAST_MIN_S * 1000 - 1)).toBe(false);
        expect(c.isSpent(BLAST_LIFE_S * 1000 + 1)).toBe(true);
        c.destroy();
    });

    it('thins a lot over its life, and the last of it fades out instead of popping away', () => {
        const peak = (c: BlastCloud) => Math.max(...c.grid.d);
        const young = blastRun(400), old = blastRun(BLAST_LIFE_S * 1000 - 100);
        expect(peak(old)).toBeLessThan(peak(young) * 0.15);
        expect(blastFade(0)).toBe(1);
        expect(blastFade(BLAST_LIFE_S - BLAST_FADE_S)).toBeCloseTo(1);
        expect(blastFade(BLAST_LIFE_S - BLAST_FADE_S / 2)).toBeCloseTo(0.5);
        expect(blastFade(BLAST_LIFE_S)).toBe(0);
        young.destroy(); old.destroy();
    });

    it('destroy frees the quad, and is safe twice', () => {
        const c = blastRun(100);
        c.destroy();
        c.destroy();
        expect(c.gone).toBe(true);
        expect(c.quad.mesh.destroyed).toBe(true);
    });
});
