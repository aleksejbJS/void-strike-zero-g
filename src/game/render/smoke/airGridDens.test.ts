import { describe, it, expect } from 'vitest';
import { AirGrid } from './airGrid';
import { DENS_MAX } from './smokeTuning';

const DT = 1 / 60;
const make = () => new AirGrid(16, 0, 0, 160);          // 10 px cells
const add = { x: 80, y: 80, r: 20, vx: 0, vy: 0, rate: 0, dens: 3 };

describe('AirGrid stir density', () => {
    it('adds smoke density around the centre, falling off linearly, for the time it is given', () => {
        const g = make();
        g.stir(add, DT);
        const centre = 8 + 8 * g.n;
        expect(g.d[centre]).toBeGreaterThan(0);
        expect(g.d[centre]).toBeGreaterThan(g.d[centre + 1]);
        expect(g.d[centre + 1]).toBeGreaterThan(0);
        expect(g.d[centre + 4]).toBe(0);                    // beyond the reach
        const once = g.mass();
        g.stir(add, DT);
        expect(g.mass()).toBeCloseTo(2 * once, 6);
        g.stir(add, DT / 2);
        expect(g.mass()).toBeCloseTo(2.5 * once, 6);
    });

    it('pushes no air and adds no soot or heat when only density is asked for', () => {
        const g = make();
        g.stir(add, DT);
        expect(g.u.every(x => x === 0) && g.v.every(x => x === 0)).toBe(true);
        expect(g.s.every(x => x === 0) && g.t.every(x => x === 0)).toBe(true);
    });

    it('caps the density of a cell at DENS_MAX and leaves solid cells empty', () => {
        const g = make();
        g.markSolids([{ x: 70, y: 70, w: 10, h: 10 }]);
        for (let i = 0; i < 600; i++) g.stir({ ...add, dens: 50 }, DT);
        expect(Math.max(...g.d)).toBeCloseTo(DENS_MAX, 6);
        expect(g.d[7 + 7 * g.n]).toBe(0);
    });

    it('skips a stir with a bad density, as it does for a bad heat', () => {
        for (const dens of [NaN, -1, Infinity]) {
            const g = make();
            g.stir({ ...add, dens }, DT);
            expect(g.mass()).toBe(0);
        }
    });
});
