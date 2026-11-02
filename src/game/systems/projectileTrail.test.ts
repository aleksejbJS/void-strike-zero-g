import { describe, it, expect, afterEach, vi } from 'vitest';
import { GameMode, WeaponType } from '../../types';
import { createMockState } from '../../test/mocks';
import { projectileTrail } from './effects';

describe('projectileTrail', () => {
    afterEach(() => { vi.restoreAllMocks(); });
    const rocket = (vel: { x: number; y: number }) => ({
        id: 'r', ownerId: 'o', pos: { x: 100, y: 50 }, vel, type: WeaponType.ROCKET_LAUNCHER, radius: 4, active: true,
    });

    it('rocket smoke is born 10 px behind the rocket, small', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.25);
        const state = createMockState(GameMode.DEATHMATCH);
        projectileTrail(state, rocket({ x: 0, y: 12 }));
        expect(state.particles).toHaveLength(1);
        const puff = state.particles[0];
        expect(puff.type).toBe('smoke');
        expect(puff.pos.x).toBeCloseTo(100);
        expect(puff.pos.y).toBeCloseTo(40);
        expect(puff.size).toBeGreaterThanOrEqual(3);
        expect(puff.size).toBeLessThanOrEqual(5);
    });

    it('a rocket without velocity smokes on the spot, other weapons not at all', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.25);
        const state = createMockState(GameMode.DEATHMATCH);
        projectileTrail(state, rocket({ x: 0, y: 0 }));
        expect(state.particles[0].pos).toEqual({ x: 100, y: 50 });
        state.particles = [];
        projectileTrail(state, { ...rocket({ x: 5, y: 0 }), type: WeaponType.PLASMA_GUN });
        expect(state.particles).toHaveLength(0);
    });
});
