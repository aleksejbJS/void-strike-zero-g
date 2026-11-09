// The flame stream setting fighters on fire: who catches fire and who does not.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameMode } from '../../types';
import { BURN_MS } from './flameConstants';
import { SPAWN_SHIELD_MS } from './spawnShield';
import { HUNGER_SHIELD_MS } from './hungerRound';
import { arena, enemyAt, spray, NOW } from './flameTestKit';

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] }); // applyDamage reads Date.now() for the shields
    vi.setSystemTime(NOW);
});
afterEach(() => { vi.useRealTimers(); });

describe('flame stream ignites', () => {
    it('one hit sets the target on fire, credited to the shooter', () => {
        const { state, shooter } = arena();
        const foe = enemyAt(state, 'foe', 200);
        spray(state, shooter);
        expect(foe).toMatchObject({ burnUntil: NOW + BURN_MS, burnBy: 'shooter' });
    });

    it('a miss and a hit that kills leave nothing burning', () => {
        const { state, shooter } = arena();
        const far = enemyAt(state, 'far', 320);
        const weak = enemyAt(state, 'weak', 100);
        weak.health = 1;
        spray(state, shooter);
        expect(far.burnUntil).toBeUndefined();
        expect(weak.dead).toBe(true);
        expect(weak.burnUntil).toBeUndefined();
    });

    it('a fighter under spawn protection takes no damage and catches no fire', () => {
        const { state, shooter } = arena();
        const foe = enemyAt(state, 'foe', 200);
        foe.spawnShieldUntil = NOW + SPAWN_SHIELD_MS;
        spray(state, shooter);
        expect(foe.health).toBe(100);
        expect(foe.burnUntil).toBeUndefined();
        expect(foe.burnTickAt).toBeUndefined();
    });

    it('a fighter under the Hunger round-start shield takes no damage and catches no fire', () => {
        const { state, shooter } = arena();
        state.mode = GameMode.HUNGER_GAMES;
        state.hungerRoundStartedAt = NOW;
        const foe = enemyAt(state, 'foe', 200);
        spray(state, shooter);
        expect(foe.health).toBe(100);
        expect(foe.burnUntil).toBeUndefined();
    });

    it('catches fire again once the shields are over', () => {
        const { state, shooter } = arena();
        state.mode = GameMode.HUNGER_GAMES;
        state.hungerRoundStartedAt = NOW - HUNGER_SHIELD_MS; // the round-start shield ended just now
        const foe = enemyAt(state, 'foe', 200);
        foe.spawnShieldUntil = NOW; // the spawn shield ended just now
        spray(state, shooter);
        expect(foe.burnUntil).toBe(NOW + BURN_MS);
    });
});
