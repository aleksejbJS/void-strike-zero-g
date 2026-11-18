import { describe, it } from 'vitest';
import { AirGrid } from './airGrid';
import { GRID_N } from './smokeTuning';

// Run with SMOKE_BENCH=1 npx vitest run src/game/render/smoke/airGrid.bench.test.ts
const RUN = process.env.SMOKE_BENCH === '1';
const CLOUDS = 4, WARMUP_STEPS = 60, TIMED_STEPS = 240, DT = 1 / 60;

describe.skipIf(!RUN)('AirGrid bench', () => {
    it('times four high-quality grids stepping together', () => {
        const n = GRID_N.high;
        const grids = Array.from({ length: CLOUDS }, (_, c) => {
            const grid = new AirGrid(n, 0, 0, 330);
            grid.markSolids([{ x: 0, y: 250, w: 330, h: 80 }]);    // a floor, as in a real match
            grid.d.fill(0.6);
            grid.stir({ x: 165, y: 120, r: 60, vx: 200 * (c + 1), vy: -80, rate: 40, heat: 30, soot: 8 }, DT);
            return grid;
        });
        const run = (steps: number) => {
            for (let s = 0; s < steps; s++) {
                for (const grid of grids) {
                    if (s % 20 === 0) grid.stir({ x: 120 + (s % 80), y: 140, r: 30, vx: 300, vy: -100, rate: 40, heat: 20 }, DT);
                    grid.step(DT);
                }
            }
        };
        run(WARMUP_STEPS);                                          // let the JIT settle first
        const start = performance.now();
        run(TIMED_STEPS);
        const perStep = (performance.now() - start) / TIMED_STEPS;
        console.log(`smoke bench: ${perStep.toFixed(3)} ms per step for ${CLOUDS} grids of ${n}x${n}`);
    });
});
