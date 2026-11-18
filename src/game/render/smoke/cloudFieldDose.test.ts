import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { CloudField } from './cloudField';
import type { AirGrid, Stir } from './airGrid';
import { T0, cloud, frameOf, runner, stateOf, syncFed, watchGrids } from './cloudField.testkit';
import { projectile } from './smokeStirs.testkit';

// A stir must push the air by the same amount per second of play on a 60, 120 or 144 Hz screen, at full rate and at half rate.
describe('CloudField stir dose by frame rate', () => {
    beforeAll(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null); });
    afterAll(() => { vi.restoreAllMocks(); });
    const cleanups: (() => void)[] = [];
    afterEach(() => { for (const c of cleanups.splice(0)) c(); });

    type Role = 'full' | 'half';
    /** Five clouds on one spot: the first four step every frame, the fifth every second step period. */
    const setup = (role: Role) => {
        const w = watchGrids();
        const field = new CloudField();
        cleanups.push(w.restore, () => field.destroy());
        const smokes = [0, 1, 2, 3, 4].map(i => cloud(`c${i}`, 800, 450));
        syncFed(field, smokes, T0, frameOf());
        const grid = field.gridOf(role === 'full' ? 'c0' : 'c4') as AirGrid;
        return { field, smokes, grid, calls: () => w.stirs.get(grid) ?? [] };
    };
    /** Seconds the stirs of reach `r` were applied for in all, as AirGrid.stir was asked. */
    const sum = (calls: { st: Stir; dt: number }[], r: number) => calls.filter(c => c.st.r === r).reduce((t, c) => t + c.dt, 0);

    /** The time a standing runner's stir is applied for in `seconds` of frames at `hz`, and the air speed at the runner afterwards. */
    const standing = (role: Role, hz: number, seconds: number) => {
        const { field, smokes, grid, calls } = setup(role);
        const state = stateOf({ players: [runner(800, 476)] });
        let now = T0;
        for (let i = 0; i < Math.round(seconds * hz); i++) { now += 1000 / hz; syncFed(field, smokes, now, frameOf(state)); }
        const k = Math.floor((800 - grid.x0) / grid.cell) + Math.floor((450 - grid.y0) / grid.cell) * grid.n;
        return { applied: sum(calls(), 26), speed: grid.u[k] };
    };

    for (const role of ['full', 'half'] as Role[]) {
        it(`a standing stir is applied for one second per second of frames, ${role} rate`, () => {
            for (const hz of [60, 120, 144]) {
                const { applied } = standing(role, hz, 1);
                expect(applied, `${hz} Hz`).toBeGreaterThan(0.95);
                expect(applied, `${hz} Hz`).toBeLessThan(1.05);
            }
        });

        it(`a standing stir speeds the air up by the same amount at 60 and 120 Hz, ${role} rate`, () => {
            // 0.2 s: still climbing towards the stir's speed (about 60 px/s of it at this spot), so a doubled dose would show
            const at60 = standing(role, 60, 0.2).speed, at120 = standing(role, 120, 0.2).speed;
            expect(at60).toBeGreaterThan(5);
            expect(Math.abs(at120 - at60) / at60).toBeLessThan(0.05);
        });

        it(`a rocket crossing the cloud gives the same dose at 60 and 120 Hz, ${role} rate`, () => {
            const cross = (hz: number) => {
                const { field, smokes, calls } = setup(role);
                let now = T0, x = 450;
                for (let i = 0; x < 1150; i++) {                          // 840 px/s: 14 px per 60 Hz frame, 7 px per 120 Hz frame
                    now += 1000 / hz; x += 840 / hz;
                    syncFed(field, smokes, now, frameOf(stateOf({ projectiles: [projectile('r1', x, 450, 14, 0)] })));
                }
                for (let i = 0; i < 8; i++) { now += 1000 / hz; syncFed(field, smokes, now, frameOf()); }   // let a half-rate cloud use its queue
                return sum(calls(), 16);
            };
            const at60 = cross(60), at120 = cross(120);
            expect(at60).toBeGreaterThan(0.5);
            expect(Math.abs(at120 - at60) / at60).toBeLessThan(0.05);
        });
    }
});
