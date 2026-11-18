import { describe, it, expect, beforeAll, afterAll, afterEach, vi, type MockInstance } from 'vitest';
import { BufferImageSource } from 'pixi.js';
import { CloudField } from './cloudField';
import { SootPlumes } from './sootPlumes';
import { T0, cloud, frameOf, stepCount, watchGrids } from './cloudField.testkit';
import { type Point, runFrames as runPlumeFrames, sootFrame } from './sootPlumes.testkit';

const FRAME_120 = 1000 / 120;

describe('grid uploads', () => {
    // Pixi probes the shader precision through a canvas context; jsdom has none and logs a "not implemented" error
    beforeAll(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null); });
    afterAll(() => { vi.restoreAllMocks(); });
    let uploads: MockInstance;
    const done: { destroy: () => void }[] = [];
    const watchers: { restore: () => void }[] = [];
    afterEach(() => {
        for (const d of done.splice(0)) d.destroy();
        for (const w of watchers.splice(0)) w.restore();
        uploads?.mockRestore();
    });
    const watch = () => { const w = watchGrids(); watchers.push(w); uploads = vi.spyOn(BufferImageSource.prototype, 'update'); return w; };

    it('a cloud uploads its grid only on the frames it stepped (120 frames a second, 60 steps)', () => {
        const field = new CloudField();
        done.push(field);
        const smokes = [cloud('a', 800, 450)];
        field.sync(smokes, T0, frameOf());
        const w = watch();
        let now = T0;
        for (let i = 0; i < 20; i++) { now += FRAME_120; field.sync(smokes, now, frameOf()); }
        const steps = stepCount(w.steps, field.gridOf('a'));
        expect(steps).toBe(10);
        expect(uploads).toHaveBeenCalledTimes(steps);
    });

    it('a plume uploads on the frames it stepped or was fed, not on the others', () => {
        const plumes = new SootPlumes();
        done.push(plumes);
        const pts: Point[] = [{ x: 800, y: 500 }];
        let now = runPlumeFrames(plumes, sootFrame(pts), 3, T0);
        const w = watch();
        now = runPlumeFrames(plumes, sootFrame(pts), 10, now, FRAME_120);    // fed every frame: uploaded every frame
        expect(uploads).toHaveBeenCalledTimes(10);
        uploads.mockClear();
        w.steps.clear();
        pts.length = 0;                                                     // the fire is out: only the steps change the grid
        runPlumeFrames(plumes, sootFrame(pts), 20, now, FRAME_120);
        expect(stepCount(w.steps, plumes.gridAt(0))).toBe(10);
        expect(uploads).toHaveBeenCalledTimes(10);
    });
});
