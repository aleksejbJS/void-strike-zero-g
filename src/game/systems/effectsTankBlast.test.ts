import { describe, expect, it } from 'vitest';
import { GameMode } from '../../types';
import { createMockState } from '../../test/mocks';
import type { GameEvent } from './events';
import { applyEffectEvent } from './effects';

const deathWithTank = (tank: unknown): GameEvent =>
    ({ type: 'DEATH', x: 10, y: 500, color: '#ff0000', height: 72, vel: { x: 0, y: 0 }, facing: 1, tank }) as GameEvent;

describe('a corpse with a lit fuel tank (DEATH.tank, TANK_BLAST)', () => {
    it('keeps the tank from the DEATH event and is torn apart by the TANK_BLAST with that id', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        applyEffectEvent(state, deathWithTank('tank_7'));
        expect(state.corpses[0].tankId).toBe('tank_7');
        applyEffectEvent(state, { type: 'TANK_BLAST', id: 'tank_7', x: 0, y: 480 });
        expect(state.corpses).toHaveLength(1);
        expect(state.corpses[0].kind).toBe('gib');
    });

    it('a blast for another tank, or a malformed one from a hostile host, leaves the corpse alone', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        applyEffectEvent(state, deathWithTank('tank_7'));
        const corpse = state.corpses[0];
        applyEffectEvent(state, { type: 'TANK_BLAST', id: 'tank_8', x: 0, y: 480 });
        expect(() => applyEffectEvent(state, { type: 'TANK_BLAST', id: 7, x: 'a', y: null } as unknown as GameEvent)).not.toThrow();
        expect(state.corpses).toEqual([corpse]);
    });

    it('a DEATH with a tank that is not a string leaves an ordinary corpse', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        applyEffectEvent(state, deathWithTank(42));
        expect(state.corpses[0].tankId).toBeUndefined();
    });

    it('every tank blast throws a ball of burning fuel in every direction, a corpse there or not', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        applyEffectEvent(state, { type: 'TANK_BLAST', id: 'tank_9', x: 0, y: 480 });
        const flames = state.particles.filter(p => p.type === 'flame');
        expect(flames.length).toBeGreaterThanOrEqual(30);
        expect(flames.some(p => p.vel.x < -2)).toBe(true);
        expect(flames.some(p => p.vel.x > 2)).toBe(true);
        expect(flames.some(p => p.vel.y < -2)).toBe(true);
        expect(state.particles.some(p => p.type === 'flash')).toBe(true);
    });
});
