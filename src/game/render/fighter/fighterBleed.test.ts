import { describe, expect, it } from 'vitest';
import { BleedDrips, DRIP_MS } from './fighterBleed';
import { createMockState } from '../../../test/mocks';
import { GameMode } from '../../../types';

const FRAME_MS = 1000 / 60;

describe('BleedDrips', () => {
    it('drops one blood particle at the given spot at once', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        new BleedDrips().spawn(state, 10, 20, 0);
        expect(state.particles).toHaveLength(1);
        expect(state.particles[0]).toMatchObject({ type: 'blood', pos: { x: 10, y: 20 } });
    });

    it('is rate-limited: a call every frame for a second adds at most 8 drops', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const drips = new BleedDrips();
        for (let t = 0; t < 1000; t += FRAME_MS) drips.spawn(state, 0, 0, t);
        expect(state.particles.length).toBeGreaterThanOrEqual(5);
        expect(state.particles.length).toBeLessThanOrEqual(8);
    });

    it('drops again once the pause has passed', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const drips = new BleedDrips();
        drips.spawn(state, 0, 0, 1000);
        drips.spawn(state, 0, 0, 1000 + DRIP_MS - 1);
        expect(state.particles).toHaveLength(1);
        drips.spawn(state, 0, 0, 1000 + DRIP_MS);
        expect(state.particles).toHaveLength(2);
    });

    it('does not stall when the clock steps back', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const drips = new BleedDrips();
        drips.spawn(state, 0, 0, 5000);
        drips.spawn(state, 0, 0, 100);
        expect(state.particles).toHaveLength(2);
    });

    it('counts each fighter separately', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        new BleedDrips().spawn(state, 0, 0, 0);
        new BleedDrips().spawn(state, 0, 0, 0);
        expect(state.particles).toHaveLength(2);
    });
});
