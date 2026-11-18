import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { SootPlumes } from './sootPlumes';
import { GRID_N, PLUME_BOX, PLUME_CAP, type SmokeQuality } from './smokeTuning';
import { T0 } from './cloudField.testkit';
import { type Point, runFrames, sootFrame, sootMeanY, sootTotal } from './sootPlumes.testkit';

describe('SootPlumes', () => {
    // Pixi probes the shader precision through a canvas context; jsdom has none and logs a "not implemented" error
    beforeAll(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null); });
    afterAll(() => { vi.restoreAllMocks(); });
    const made: SootPlumes[] = [];
    const make = () => { const p = new SootPlumes(); made.push(p); return p; };
    afterEach(() => { for (const p of made.splice(0)) p.destroy(); });

    it('a soot point makes one plume, nearby points share it', () => {
        const plumes = make(), pts: Point[] = [{ x: 800, y: 500 }];
        runFrames(plumes, sootFrame(pts), 1, T0);
        expect(plumes.count).toBe(1);
        pts.push({ x: 850, y: 480 }, { x: 760, y: 520 });
        runFrames(plumes, sootFrame(pts), 5, T0);
        expect(plumes.count).toBe(1);
        pts.push({ x: 1400, y: 500 });
        runFrames(plumes, sootFrame(pts), 1, T0);
        expect(plumes.count).toBe(2);
    });

    it('makes a 180 px square box with the first soot point at 70 % of its height, on a half-size grid', () => {
        const plumes = make();
        runFrames(plumes, sootFrame([{ x: 800, y: 500 }], 'high'), 1, T0);
        const grid = plumes.gridAt(0)!;
        expect(PLUME_BOX).toBe(180);
        expect([grid.x0, grid.y0, grid.size]).toEqual([710, 500 - 126, 180]);
        expect(grid.n).toBe(Math.ceil(GRID_N.high / 2));
        const medium = make();
        runFrames(medium, sootFrame([{ x: 800, y: 500 }], 'medium'), 1, T0);
        expect(medium.gridAt(0)!.n).toBe(Math.ceil(GRID_N.medium / 2));
    });

    it('puts soot, heat and density where the soot point is', () => {
        const plumes = make();
        runFrames(plumes, sootFrame([{ x: 800, y: 500 }]), 20, T0);
        const grid = plumes.gridAt(0)!;
        const k = Math.floor((800 - grid.x0) / grid.cell) + Math.floor((500 - grid.y0) / grid.cell) * grid.n;
        expect(grid.s[k]).toBeGreaterThan(0.2);
        expect(grid.d[k]).toBeGreaterThan(0.05);
        expect(plumes.gridAt(0)!.t.some(t => t > 0)).toBe(true);
    });

    it('soot rises', () => {
        // Ten smoke particles bunched like a flame's: their heat lifts the air they leave their soot in
        const plumes = make(), pts: Point[] = Array.from({ length: 10 }, (_, i) => ({ x: 800 + (i % 3) * 5, y: 500 - Math.floor(i / 3) * 5 }));
        let now = runFrames(plumes, sootFrame(pts), 30, T0);
        const before = sootMeanY(plumes.gridAt(0)!);
        pts.length = 0;
        now = runFrames(plumes, sootFrame(pts), 60, now);
        expect(sootMeanY(plumes.gridAt(0)!)).toBeLessThan(before - 5);      // y points down: smaller y is higher
    });

    it('a plume dies about 3 s after the fire stops', () => {
        const plumes = make(), pts: Point[] = [{ x: 800, y: 500 }, { x: 806, y: 496 }];
        let now = runFrames(plumes, sootFrame(pts), 60, T0);
        pts.length = 0;
        const stop = now;
        now = runFrames(plumes, sootFrame(pts), 60, now);
        expect(plumes.count).toBe(1);                                       // alive 1 s after
        let diedAt = -1;
        for (let i = 0; i < 300 && diedAt < 0; i++) {
            now = runFrames(plumes, sootFrame(pts), 1, now);
            if (plumes.count === 0) diedAt = now - stop;
        }
        expect(diedAt).toBeGreaterThan(2000);
        expect(diedAt).toBeLessThan(4000);                                  // gone by 4 s
        expect(plumes.layer.children.length).toBe(0);
    });

    it('respects the cap per quality', () => {
        const row = (): Point[] => Array.from({ length: 8 }, (_, k) => ({ x: 100 + k * 200, y: 450 }));
        for (const quality of ['high', 'medium', 'low'] as SmokeQuality[]) {
            const plumes = make();
            runFrames(plumes, sootFrame(row(), quality), 3, T0);
            expect(plumes.count).toBe(PLUME_CAP[quality]);
        }
        expect([PLUME_CAP.high, PLUME_CAP.medium, PLUME_CAP.low]).toEqual([6, 3, 0]);
    });

    it('low quality makes no plumes, and no quad', () => {
        const plumes = make();
        runFrames(plumes, sootFrame([{ x: 800, y: 500 }], 'low'), 30, T0);
        expect(plumes.count).toBe(0);
        expect(plumes.layer.children.length).toBe(0);
    });

    it('deposits the same soot per second at 30, 60 and 120 frames per second', () => {
        const totals = [1000 / 30, 1000 / 60, 1000 / 120].map(ms => {
            const plumes = make();
            runFrames(plumes, sootFrame([{ x: 800, y: 500 }]), Math.round(0.4 / (ms / 1000)), T0, ms);
            return sootTotal(plumes.gridAt(0)!);
        });
        expect(totals[0]).toBeGreaterThan(0);
        expect(totals[1] / totals[0]).toBeCloseTo(1, 1);
        expect(totals[2] / totals[0]).toBeCloseTo(1, 1);
    });
});
