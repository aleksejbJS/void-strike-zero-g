import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { CloudEntry } from './cloudEntry';
import { SootPlume } from './sootPlume';
import { SmokeQuad } from './smokeQuad';
import { cloud } from './cloudField.testkit';

const N = 16;
const MS_PER_MILLION = 1e6;

// The billows' phase must run on from the cloud's (or plume's) own start, not from the wall clock: a clock-based time
// that wraps (every 1000 s, when ms % 1e6 restarts) would make a cloud on screen jump.
describe('shader time', () => {
    // Pixi probes the shader precision through a canvas context; jsdom has none and logs a "not implemented" error
    beforeAll(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null); });
    afterAll(() => { vi.restoreAllMocks(); });
    const quads: SmokeQuad[] = [];
    afterEach(() => { for (const q of quads.splice(0)) q.destroy(); });
    const timeOf = (quad: SmokeQuad): number => {
        quads.push(quad);
        return (quad.mesh.shader!.resources.smokeUniforms.uniforms as { uTime: number }).uTime;
    };

    it('a cloud\'s time is the seconds since it was born, and does not jump when the clock passes a multiple of 1e6 ms', () => {
        const born = 999_990_000, c = cloud('a', 800, 450, born, born + 60_000);
        const entry = new CloudEntry(c, N, born, null);
        entry.show(999_999_000);
        expect(timeOf(entry.quad)).toBeCloseTo(9, 6);
        entry.show(1_000_001_000);                          // the old (now % 1e6) / 1000 went from 999.999 back to 1.001 here
        expect(timeOf(entry.quad)).toBeCloseTo(11, 6);
        entry.destroy();
    });

    it('a cloud\'s time runs at one second per second from its birth, however late the wall clock is', () => {
        const born = 7 * MS_PER_MILLION + 123, c = cloud('a', 800, 450, born, born + 60_000);
        const entry = new CloudEntry(c, N, born, null);
        for (const dt of [1000, 2500, 4000]) {
            entry.show(born + dt);
            expect(timeOf(entry.quad)).toBeCloseTo(dt / 1000, 6);
        }
        entry.destroy();
    });

    it('a plume\'s time is the seconds since it was made, and does not jump when the clock passes a multiple of 1e6 ms', () => {
        const made = 999_999_000;
        const plume = new SootPlume(800, 500, N, made, null);
        plume.show(999_999_500);
        expect(timeOf(plume.quad)).toBeCloseTo(0.5, 6);
        plume.show(1_000_001_000);
        expect(timeOf(plume.quad)).toBeCloseTo(2, 6);
        plume.destroy();
    });
});
