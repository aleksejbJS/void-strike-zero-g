import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
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
    const make = () => { const p = new SootPlumes(); made.push(p); return p; };
    afterEach(() => { for (const p of made.splice(0)) p.destroy(); });

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

    it('with the cap full, puts the soot of a point no plume holds into the nearest plume instead of dropping it', () => {
        const row = (n: number): Point[] => Array.from({ length: n }, (_, k) => ({ x: 100 + k * 200, y: 450 }));
        const sootAt = (n: number) => {
            const plumes = make();
            runFrames(plumes, sootFrame(row(n)), 10, T0);
            expect(plumes.count).toBe(PLUME_CAP.high);
            return [...Array(plumes.count).keys()].map(i => sootTotal(plumes.gridAt(i)!));
        };
        const six = sootAt(6), eight = sootAt(8);
        expect(eight[5]).toBeGreaterThan(six[5] * 1.5);                     // the last plume (x 1100) also takes x 1300 and 1500
        for (let i = 0; i < 5; i++) expect(eight[i]).toBeCloseTo(six[i], 5);
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
