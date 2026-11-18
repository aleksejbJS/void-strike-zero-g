import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import type { SmokeFrame } from './cloudField';
import { SootPlume } from './sootPlume';
import { SootPlumes } from './sootPlumes';
import { PLUME_CAP, PLUME_GONE_PEAK, PLUME_IDLE_S } from './smokeTuning';
import { T0 } from './cloudField.testkit';
import { type Point, runFrames, sootFrame, sootTotal } from './sootPlumes.testkit';

const peakOf = (d: Float32Array): number => { let top = 0; for (const x of d) if (x > top) top = x; return top; };

describe('SootPlumes, spending and the cap', () => {
    // Pixi probes the shader precision through a canvas context; jsdom has none and logs a "not implemented" error
    beforeAll(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null); });
    afterAll(() => { vi.restoreAllMocks(); });
    const made: SootPlumes[] = [];
    const spies: { mockRestore: () => void }[] = [];
    const make = () => { const p = new SootPlumes(); made.push(p); return p; };
    afterEach(() => {
        for (const p of made.splice(0)) p.destroy();
        for (const s of spies.splice(0)) s.mockRestore();
    });

    it('is never freed while its smoke can be seen, and is freed within a few frames once it cannot', () => {
        const plumes = make(), pts: Point[] = [{ x: 800, y: 500 }, { x: 806, y: 496 }];
        let now = runFrames(plumes, sootFrame(pts), 60, T0);
        pts.length = 0;
        const stop = now;
        let lastSeenPeak = Infinity, unseenAlive = 0;
        for (let i = 0; i < 900; i++) {
            now = runFrames(plumes, sootFrame(pts), 1, now);
            if (plumes.count === 0) break;
            lastSeenPeak = peakOf(plumes.gridAt(0)!.d);                     // what this frame drew
            if (now - stop > PLUME_IDLE_S * 1000 + 20 && lastSeenPeak < PLUME_GONE_PEAK) unseenAlive++;
        }
        expect(plumes.count).toBe(0);
        expect(lastSeenPeak).toBeLessThan(PLUME_GONE_PEAK * 1.05);          // the last frame drawn was at the edge of unseen
        expect(unseenAlive).toBe(0);                                        // and it was not kept a frame longer
    });

    it('leaves a thin plume alone while the fire still feeds it', () => {
        const plumes = make(), pts: Point[] = [{ x: 800, y: 500 }];
        runFrames(plumes, sootFrame(pts), 5, T0);
        plumes.gridAt(0)!.d.fill(0);                                        // nothing to see yet, but soot keeps coming
        runFrames(plumes, sootFrame(pts), 30, T0 + 100);
        expect(plumes.count).toBe(1);
    });

    // Six plumes in a row (the high cap): plume k has its box centred on x = 100 + 200 k, 126 px above y = 450 + 90 -> centre y 414
    const row = (n: number): Point[] => Array.from({ length: n }, (_, k) => ({ x: 100 + k * 200, y: 450 }));
    const full = () => {
        const plumes = make();
        runFrames(plumes, sootFrame(row(PLUME_CAP.high)), 3, T0);
        expect(plumes.count).toBe(PLUME_CAP.high);
        return plumes;
    };
    const totals = (plumes: SootPlumes) => [...Array(plumes.count).keys()].map(i => sootTotal(plumes.gridAt(i)!));
    const spyAdd = () => { const add = vi.spyOn(SootPlume.prototype, 'add'); spies.push(add); return add; };

    it('with the cap full, puts the soot of a point no plume holds into a plume within one box of it instead of dropping it', () => {
        const sootAt = (extra: Point[]) => {
            const plumes = make();
            runFrames(plumes, sootFrame([...row(PLUME_CAP.high), ...extra]), 10, T0);
            expect(plumes.count).toBe(PLUME_CAP.high);
            return totals(plumes);
        };
        const six = sootAt([]), seven = sootAt([{ x: 1250, y: 450 }]);      // 154 px from the last plume's centre, outside its box
        expect(seven[5]).toBeGreaterThan(six[5] * 1.5);
        for (let i = 0; i < 5; i++) expect(seven[i]).toBeCloseTo(six[i], 5);
    });

    it('with the cap full, drops the soot of a point farther than one box from every plume', () => {
        const plumes = full(), add = spyAdd();
        runFrames(plumes, sootFrame([{ x: 100, y: 800 }]), 3, T0 + 100);     // 386 px below the first plume's centre
        runFrames(plumes, sootFrame([{ x: 1500, y: 450 }]), 3, T0 + 200);    // 403 px right of the last plume's centre
        expect(add).not.toHaveBeenCalled();
        expect(plumes.count).toBe(PLUME_CAP.high);
    });

    it('with the cap full, the reach is one box: a point 146 px away is taken, one 206 px away is not', () => {
        const plumes = full(), add = spyAdd();
        runFrames(plumes, sootFrame([{ x: 100, y: 560 }]), 1, T0 + 100);     // below the first plume's box (it holds y up to 479)
        expect(add).toHaveBeenCalledTimes(1);
        add.mockClear();
        runFrames(plumes, sootFrame([{ x: 100, y: 620 }]), 1, T0 + 200);
        expect(add).not.toHaveBeenCalled();
    });

    it('with the cap full, never gives soot to a plume that is out of view, even when it is the nearest', () => {
        const plumes = make();
        const wide = (x: number): SmokeFrame => ({ ...sootFrame([]), view: { x, y: 0, w: 1600, h: 900 } });
        // Plume 0 at x 200 (box 110..290) and five more far to the right, all in view and its margin
        const at = [200, 700, 900, 1100, 1300, 1500].map(x => ({ x, y: 450 }));
        runFrames(plumes, { ...wide(0), flame: sootFrame(at).flame }, 3, T0);
        expect(plumes.count).toBe(PLUME_CAP.high);
        const add = spyAdd(), before = totals(plumes)[0];
        // The view moves right: plume 0 is now left of the margin (x < 300) and asleep. The point is 105 px from its centre
        const point = sootFrame([{ x: 305, y: 450 }]);
        runFrames(plumes, { ...point, view: { x: 500, y: 0, w: 1600, h: 900 } }, 2, T0 + 100);
        expect(add).not.toHaveBeenCalled();                                  // not to the sleeper, and the others are 395 px or more away
        expect(totals(plumes)[0]).toBe(before);
    });

    it('reads nothing of the frame while no plume lives and the flame has no soot', () => {
        const plumes = make(), frame = sootFrame([]);
        let reads = 0;
        const view = frame.view;
        Object.defineProperty(frame, 'view', { get: () => { reads++; return view; } });
        runFrames(plumes, frame, 20, T0);
        expect(reads).toBe(0);
        expect(plumes.count).toBe(0);
    });
});
