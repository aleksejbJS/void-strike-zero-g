import { describe, it, expect } from 'vitest';
import { AirGrid } from './airGrid';
import { CloudShaper } from './cloudShape';
import { STEP_HZ } from './smokeTuning';
import { SMOKE_DURATION_MS, SMOKE_RADIUS } from '../../systems/smoke';
import { SmokeCloud } from '../../../types';

const R = SMOKE_RADIUS;
const HALF = 1.5 * R;                       // the cloud's grid box is its centre +- 1.5 radii (330 px)
const DT = 1 / STEP_HZ;
const BORN = 1000;
const cloud = (id = 'smoke_7'): SmokeCloud => ({ id, pos: { x: 500, y: 300 }, radius: R, bornAt: BORN, endsAt: BORN + SMOKE_DURATION_MS });
const makeGrid = (c: SmokeCloud) => new AirGrid(48, c.pos.x - HALF, c.pos.y - HALF, 2 * HALF);

/** A cloud with its grid, stepped like the game does: shape, then air, once per fixed step. */
const rig = (c = cloud(), floor = false) => {
    const grid = makeGrid(c), shaper = new CloudShaper(grid, c);
    if (floor) grid.markSolids([{ x: grid.x0, y: c.pos.y, w: grid.size, h: HALF }]);
    let steps = 0;
    const runTo = (age: number) => {
        while ((steps + 1) * DT <= age + 1e-9) { steps++; shaper.apply(DT, BORN + steps * DT * 1000); grid.step(DT); }
    };
    return { grid, shaper, c, runTo };
};

/** Each cell's distance from the cloud centre, px. */
const distOf = (grid: AirGrid, c: SmokeCloud, i: number, j: number) =>
    Math.hypot(grid.x0 + (i + 0.5) * grid.cell - c.pos.x, grid.y0 + (j + 0.5) * grid.cell - c.pos.y);

/** Radius of the circle with the same area as the cells at or above `level` density. */
const contourRadius = (grid: AirGrid, level: number) => {
    let cells = 0;
    for (const x of grid.d) if (x >= level) cells++;
    return Math.sqrt(cells * grid.cell * grid.cell / Math.PI);
};

const massBeyond = (grid: AirGrid, c: SmokeCloud, radius: number) => {
    let sum = 0;
    for (let j = 0; j < grid.n; j++) for (let i = 0; i < grid.n; i++) if (distOf(grid, c, i, j) > radius) sum += grid.d[i + j * grid.n];
    return sum;
};

describe('CloudShaper', () => {
    it('grows to the live radius within 0.7 s', () => {
        const r = rig();
        r.runTo(0.7);
        expect(contourRadius(r.grid, 0.1)).toBeGreaterThanOrEqual(0.8 * R);
    });

    it('stays inside the circle at rest', () => {
        const r = rig();
        r.runTo(4);
        const total = r.grid.mass();
        expect(total).toBeGreaterThan(100);
        expect(massBeyond(r.grid, r.c, 1.2 * R) / total).toBeLessThan(0.05);
    });

    it('shrinks with the fade', () => {
        const r = rig();
        r.runTo(4);
        const settled = r.grid.mass();
        r.runTo((r.c.endsAt - 500 - BORN) / 1000);
        expect(r.grid.mass()).toBeLessThan(0.4 * settled);
    });

    it('prefills a cloud first seen after its burst', () => {
        const settled = rig();
        settled.runTo(5);
        const c = cloud(), grid = makeGrid(c), shaper = new CloudShaper(grid, c);
        shaper.prefill(BORN + 500);                       // still bursting: nothing to prefill
        expect(grid.mass()).toBe(0);
        shaper.prefill(BORN + 5000);
        expect(grid.mass()).toBeGreaterThanOrEqual(0.8 * settled.grid.mass());
        expect(grid.mass()).toBeLessThanOrEqual(1.25 * settled.grid.mass());    // and not a much denser cloud than a real one
        expect(massBeyond(grid, c, 1.2 * R) / grid.mass()).toBeLessThan(0.05);    // the lobes reach out to 1.32 R, but thinly
        for (let n = 0; n < 60; n++) { shaper.apply(DT, BORN + 5000 + n * 17); grid.step(DT); }
        expect(grid.mass()).toBeGreaterThan(0.6 * settled.grid.mass());         // it carries on like a settled cloud
    });

    it('cloud on a floor keeps the floor empty', () => {
        const r = rig(cloud(), true);
        const solid: number[] = [];
        r.grid.solid.forEach((s, k) => { if (s) solid.push(k); });
        expect(solid.length).toBeGreaterThan(100);
        r.runTo(2);
        for (const k of solid) { expect(r.grid.d[k]).toBe(0); expect(r.grid.u[k]).toBe(0); expect(r.grid.v[k]).toBe(0); }
        expect(r.grid.mass()).toBeGreaterThan(50);                              // the half above the floor is there
    });

    it('the burst writes no velocity into solid cells', () => {
        const r = rig(cloud(), true);
        for (let n = 1; n <= 8; n++) r.shaper.apply(DT, BORN + n * DT * 1000);  // apply only: nothing else clears the solids
        let pushed = 0;
        for (let k = 0; k < r.grid.solid.length; k++) {
            if (r.grid.solid[k]) { expect(r.grid.u[k]).toBe(0); expect(r.grid.v[k]).toBe(0); }
            else pushed += Math.abs(r.grid.u[k]) + Math.abs(r.grid.v[k]);
        }
        expect(pushed).toBeGreaterThan(0);                                       // the open cells did get the burst
    });

    it('same id, same shape', () => {
        const a = rig(cloud('smoke_3')), b = rig(cloud('smoke_3')), other = rig(cloud('smoke_4'));
        for (const r of [a, b, other]) r.runTo(1.5);
        expect(Array.from(a.grid.d)).toEqual(Array.from(b.grid.d));
        expect(Array.from(a.grid.d)).not.toEqual(Array.from(other.grid.d));
    });

    it('a different step length gives about the same cloud', () => {
        const mass = (dt: number) => {
            const c = cloud(), grid = makeGrid(c), shaper = new CloudShaper(grid, c);
            for (let t = dt; t <= 2 + 1e-9; t += dt) { shaper.apply(dt, BORN + t * 1000); grid.step(dt); }
            return grid.mass();
        };
        expect(mass(2 * DT) / mass(DT)).toBeGreaterThan(0.85);
        expect(mass(2 * DT) / mass(DT)).toBeLessThan(1.15);
    });

    it('no NaN after a long run, with a floor', () => {
        const r = rig(cloud(), true);
        r.runTo(10);
        r.shaper.apply(DT, r.c.endsAt + 100);                                    // past its end: nothing left to hold
        for (const f of [r.grid.d, r.grid.u, r.grid.v]) expect(f.every(Number.isFinite)).toBe(true);
    });

    it('soot a flame left in the cloud fades within about two seconds', () => {
        const { grid, c, runTo } = rig();
        runTo(1);
        grid.stir({ x: c.pos.x, y: c.pos.y, vx: 0, vy: 0, rate: 0, r: 4 * grid.cell, soot: 60 }, 1 / 60);
        const total = () => grid.s.reduce((a, x) => a + x, 0);
        const before = total();
        expect(before).toBeGreaterThan(1);
        runTo(3);
        expect(total()).toBeLessThan(before * 0.05);
    });
});
