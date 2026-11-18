import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { CloudField } from './cloudField';
import { StepBudget } from './stepBudget';
import { FRAME_STEP_CELLS, GRID_N } from './smokeTuning';
import { T0, VIEW, cloud, frameOf, stateOf, stepCount, watchGrids } from './cloudField.testkit';

const FRAME_120 = 1000 / 120;

describe('smoke step budget', () => {
    // Pixi probes the shader precision through a canvas context; jsdom has none and logs a "not implemented" error
    beforeAll(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null); });
    afterAll(() => { vi.restoreAllMocks(); });
    const done: { destroy: () => void }[] = [];
    const watchers: { restore: () => void }[] = [];
    afterEach(() => {
        for (const d of done.splice(0)) d.destroy();
        for (const w of watchers.splice(0)) w.restore();
    });

    /** Six clouds made on the same frame, run for 1 s at 120 fps; the cell steps of each frame and each cloud's steps. */
    const run = (budget: StepBudget | undefined) => {
        const w = watchGrids();
        watchers.push(w);
        const field = new CloudField();
        done.push(field);
        const smokes = [0, 1, 2, 3, 4, 5].map(i => cloud(`c${i}`, 500 + 120 * i, 450));
        const frame = frameOf(stateOf(), VIEW, 'high');
        field.sync(smokes, T0, frame, [], budget);
        const perFrame: number[] = [];
        let total = 0;
        for (let f = 1; f <= 120; f++) {
            budget?.refill();
            field.sync(smokes, T0 + f * FRAME_120, frame, [], budget);
            let now = 0;
            for (const s of w.steps.values()) now += s.length;
            perFrame.push((now - total) * GRID_N.high ** 2);
            total = now;
        }
        return { perFrame, steps: smokes.map(c => stepCount(w.steps, field.gridOf(c.id))) };
    };

    it('spreads the steps of grids that fell into step over both frames, without losing any', () => {
        const free = run(undefined), spread = run(new StepBudget(FRAME_STEP_CELLS));
        expect(Math.max(...free.perFrame)).toBeGreaterThan(FRAME_STEP_CELLS + GRID_N.high ** 2);    // all at once, then none
        expect(Math.max(...spread.perFrame)).toBeLessThanOrEqual(FRAME_STEP_CELLS + GRID_N.high ** 2);
        for (let i = 0; i < 6; i++) expect(Math.abs(spread.steps[i] - free.steps[i])).toBeLessThanOrEqual(1);
        expect(spread.steps.slice(1, 5).every(n => n >= 59)).toBe(true);                         // the four nearest the centre: 60 a second
    });
});
