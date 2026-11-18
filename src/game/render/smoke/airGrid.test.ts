import { describe, it, expect } from 'vitest';
import { AirGrid } from './airGrid';
import { seededRandom } from './seededRandom';

const DT = 1 / 60;

// A 32 x 32 grid over 320 px at the origin: 10 px cells, cell (i, j) centred at (5 + 10 i, 5 + 10 j)
const makeGrid = () => new AirGrid(32, 0, 0, 320);

/** Fill the 3 x 3 block of cells around the grid centre with `value`. */
const fillCentreBlock = (grid: AirGrid, field: Float32Array, value: number) => {
    const c = grid.n >> 1;
    for (let j = c - 2; j <= c; j++) for (let i = c - 2; i <= c; i++) field[i + j * grid.n] = value;
};

/** Density-weighted mean position along one axis, in px. */
const meanPos = (grid: AirGrid, axis: 'x' | 'y') => {
    let sum = 0, weight = 0;
    for (let j = 0; j < grid.n; j++) for (let i = 0; i < grid.n; i++) {
        const dens = grid.d[i + j * grid.n];
        sum += dens * (grid[axis === 'x' ? 'x0' : 'y0'] + ((axis === 'x' ? i : j) + 0.5) * grid.cell);
        weight += dens;
    }
    return sum / weight;
};

const isFinite32 = (a: Float32Array) => a.every(Number.isFinite);

describe('seededRandom', () => {
    it('gives the same sequence for the same id and a different one for another id', () => {
        const a = seededRandom('smoke_1'), b = seededRandom('smoke_1'), c = seededRandom('smoke_2');
        const seqA = Array.from({ length: 8 }, a), seqB = Array.from({ length: 8 }, b), seqC = Array.from({ length: 8 }, c);
        expect(seqA).toEqual(seqB);
        expect(seqA).not.toEqual(seqC);
        for (const v of seqA) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
    });
});

describe('AirGrid', () => {
    it('a push moves density along it', () => {
        const grid = makeGrid();
        fillCentreBlock(grid, grid.d, 1);
        grid.stir({ x: 160, y: 160, r: 60, vx: 300, vy: 0, rate: 60 }, DT);
        for (let n = 0; n < 30; n++) grid.step(DT);
        expect(meanPos(grid, 'x')).toBeGreaterThan(160 + 20);
    });

    it('still air keeps its smoke where it is', () => {
        const grid = makeGrid();
        fillCentreBlock(grid, grid.d, 1);
        const before = meanPos(grid, 'x');
        for (let n = 0; n < 30; n++) grid.step(DT);
        expect(grid.mass()).toBeCloseTo(9, 4);
        expect(meanPos(grid, 'x')).toBeCloseTo(before, 4);
    });

    it('hot air rises', () => {
        const grid = makeGrid();
        fillCentreBlock(grid, grid.d, 1);
        fillCentreBlock(grid, grid.t, 1);
        for (let n = 0; n < 30; n++) grid.step(DT);
        expect(meanPos(grid, 'y')).toBeLessThan(160 - 10); // y points down, so rising means smaller y
    });

    it('solid cells stay empty', () => {
        const grid = makeGrid();
        grid.markSolids([{ x: 0, y: 200, w: 320, h: 120 }]);
        const solidCells: number[] = [];
        grid.solid.forEach((s, k) => { if (s) solidCells.push(k); });
        expect(solidCells.length).toBeGreaterThan(0);
        for (let j = 0; j < 20; j++) for (let i = 0; i < grid.n; i++) {
            grid.d[i + j * grid.n] = 1;
            grid.t[i + j * grid.n] = 0.5;
            grid.s[i + j * grid.n] = 0.5;
        }
        for (let n = 0; n < 60; n++) {
            grid.stir({ x: 160, y: 120, r: 100, vx: 0, vy: 400, rate: 30, heat: 20, soot: 20 }, DT);
            grid.step(DT);
        }
        for (const k of solidCells) {
            expect(grid.d[k]).toBe(0);
            expect(grid.t[k]).toBe(0);
            expect(grid.s[k]).toBe(0);
        }
        expect(grid.mass()).toBeGreaterThan(0); // the air above the floor is not wiped out
    });

    it('marking a cell solid clears what it held', () => {
        const grid = makeGrid();
        grid.d.fill(1); grid.t.fill(1); grid.s.fill(1);
        grid.markSolids([{ x: 100, y: 100, w: 50, h: 50 }]);
        grid.solid.forEach((s, k) => {
            if (s) { expect(grid.d[k]).toBe(0); expect(grid.t[k]).toBe(0); expect(grid.s[k]).toBe(0); }
        });
        grid.markSolids([]); // cover gone: the cells open up again, empty
        expect(grid.solid.every(s => s === 0)).toBe(true);
    });

    it('heat cools', () => {
        const grid = makeGrid();
        grid.t.fill(1);
        for (let n = 0; n < 60; n++) grid.step(DT);
        expect(Math.max(...grid.t)).toBeLessThan(0.1);
    });

    it('stir adds heat and soot with caps, and carves density out', () => {
        const grid = makeGrid();
        grid.d.fill(1);
        grid.stir({ x: 160, y: 160, r: 40, vx: 0, vy: 0, rate: 1e6, heat: 1e6, soot: 1e6, carve: 1e6 }, DT);
        const k = 16 + 16 * 32;
        expect(grid.t[k]).toBe(1.5);
        expect(grid.s[k]).toBe(1);
        expect(grid.d[k]).toBe(0);
        expect(grid.d[2 + 2 * 32]).toBe(1); // far corner untouched
    });

    it('heat, soot and carve are per second with only the falloff, not scaled by rate', () => {
        const grid = makeGrid();
        grid.d.fill(1);
        const centre = 15 + 15 * 32, edge = 15 + 17 * 32;      // cell (15, 15) is centred at (155, 155)
        // rate 0: the air is not pushed at all, yet 10 /s for 0.1 s adds 1.0 at the centre cell
        grid.stir({ x: 155, y: 155, r: 40, vx: 300, vy: 0, rate: 0, heat: 10, soot: 5, carve: 2 }, 0.1);
        expect(grid.t[centre]).toBeCloseTo(1.0, 5);
        expect(grid.s[centre]).toBeCloseTo(0.5, 5);
        expect(grid.d[centre]).toBeCloseTo(0.8, 5);            // 1 - 2 /s * 0.1 s
        expect(grid.u[centre]).toBe(0);
        // 20 px away (half the reach): half the amount
        expect(grid.t[edge]).toBeCloseTo(0.5, 5);
        expect(grid.d[edge]).toBeCloseTo(0.9, 5);
        // a fast rate changes the push, not the heat
        const fast = makeGrid();
        fast.stir({ x: 155, y: 155, r: 40, vx: 300, vy: 0, rate: 1e6, heat: 10 }, 0.1);
        expect(fast.t[centre]).toBeCloseTo(1.0, 5);
        expect(fast.u[centre]).toBeCloseTo(300, 3);
    });

    it('a radial stir pushes the air outward', () => {
        const grid = makeGrid();
        const row = 16 * 32;
        grid.stir({ x: 160, y: 160, r: 80, vx: 400, vy: 0, radial: true, rate: 60 }, DT);
        expect(grid.u[22 + row]).toBeGreaterThan(0);
        expect(grid.u[10 + row]).toBeLessThan(0);
    });

    it('no NaN after extreme stirs', () => {
        const grid = makeGrid();
        grid.d.fill(1);
        grid.stir({ x: 160, y: 160, r: 80, vx: 1e6, vy: -1e6, rate: 1e6, heat: 1e6, soot: 1e6, carve: 1e6 }, DT);
        grid.stir({ x: 160, y: 160, r: 80, vx: 1e6, vy: 1e6, radial: true, rate: 1e6, carve: 1e6 }, DT);
        grid.stir({ x: 160, y: 160, r: 0, vx: 1, vy: 1, rate: 1 }, DT);   // zero reach: nothing to stir
        for (let n = 0; n < 10; n++) grid.step(DT);
        grid.step(0);
        for (const f of [grid.d, grid.t, grid.s, grid.u, grid.v]) expect(isFinite32(f)).toBe(true);
    });

    it('a stir with a non-finite or negative number is ignored', () => {
        const grid = makeGrid();
        const base = { x: 160, y: 160, r: 60, vx: 300, vy: 100, rate: 60, heat: 5, soot: 5, carve: 1 };
        const bad = [{ x: NaN }, { y: Infinity }, { r: Infinity }, { r: -60 }, { vx: NaN }, { vy: -Infinity }, { rate: NaN }, { rate: Infinity }, { rate: -5 }];
        grid.d.fill(1);
        for (const patch of bad) grid.stir({ ...base, ...patch }, DT);
        for (const f of [grid.u, grid.v, grid.t, grid.s]) expect(f.every(x => x === 0)).toBe(true);
        expect(grid.mass()).toBe(grid.d.length);
    });

    it('step ignores the velocity stored inside solid cells', () => {
        const grid = makeGrid();
        grid.markSolids([{ x: 100, y: 100, w: 60, h: 60 }]);
        const k = grid.solid.indexOf(1);
        grid.u[k] = 800; grid.v[k] = -800;     // an outside write: no air may come out of a wall
        grid.step(DT);
        expect(grid.u[k]).toBe(0); expect(grid.v[k]).toBe(0);
        expect(Math.max(...grid.u.map(Math.abs), ...grid.v.map(Math.abs))).toBeLessThan(1e-3);
    });

    it('pressure: a push onto a solid floor keeps the smoke, the same push toward the open edge loses it', () => {
        const run = (floor: boolean) => {
            const grid = makeGrid();
            if (floor) grid.markSolids([{ x: 0, y: 280, w: 320, h: 40 }]);
            for (let j = 20; j <= 22; j++) for (let i = 10; i <= 21; i++) grid.d[i + j * grid.n] = 1;
            const before = grid.mass();
            for (let n = 0; n < 60; n++) {
                if (n < 10) grid.stir({ x: 160, y: 205, r: 200, vx: 0, vy: 300, rate: 60 }, DT);
                grid.step(DT);
            }
            return grid.mass() / before;
        };
        expect(run(true)).toBeGreaterThan(0.55);     // the air turns sideways along the floor
        expect(run(false)).toBeLessThan(0.3);        // the air leaves through the open box edge
    });

    it('mass() sums the density', () => {
        const grid = makeGrid();
        fillCentreBlock(grid, grid.d, 2);
        expect(grid.mass()).toBeCloseTo(18);
    });
});
