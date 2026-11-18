import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { CloudField } from './cloudField';
import { FRAME_MS, T0, VIEW, cloud, frameOf, runFrames, stateOf } from './cloudField.testkit';

describe('CloudField wake', () => {
    // Pixi probes the shader precision through a canvas context; jsdom has none and logs a "not implemented" error
    beforeAll(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null); });
    afterAll(() => { vi.restoreAllMocks(); });
    const fields: CloudField[] = [];
    const makeField = () => { const f = new CloudField(); fields.push(f); return f; };
    afterEach(() => { for (const f of fields.splice(0)) f.destroy(); });

    const away = frameOf(stateOf(), VIEW);                                   // the view is far from x 5000
    const there = frameOf(stateOf(), { ...VIEW, x: 4200 });                  // the view holds x 5000

    it('a cloud born out of view and seen within a second, past its burst, comes in settled, not empty', () => {
        const settled = makeField();
        settled.sync([cloud('ref', 5000, 450, T0)], T0 + 800, there);         // first seen at 0.8 s: filled as a settled cloud
        const full = settled.gridOf('ref')!.mass();

        const field = makeField(), smokes = [cloud('c', 5000, 450, T0)];
        const now = runFrames(field, smokes, 48, away, T0 - FRAME_MS);       // born and kept out of view for 0.8 s
        expect(field.gridOf('c')!.mass()).toBe(0);
        runFrames(field, smokes, 1, there, now);
        expect(field.gridOf('c')!.mass()).toBeGreaterThan(0.7 * full);
    });

    it('a young cloud that wakes empty is left to grow with its burst', () => {
        const field = makeField(), smokes = [cloud('c', 5000, 450, T0)];
        const now = runFrames(field, smokes, 12, away, T0 - FRAME_MS);       // out of view for 0.2 s
        runFrames(field, smokes, 1, there, now);
        expect(field.gridOf('c')!.mass()).toBeLessThan(20);
    });
});
