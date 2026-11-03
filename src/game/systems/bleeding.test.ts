import { describe, it, expect } from 'vitest';
import { GameMode, Team, ItemType, Entity } from '../../types';
import { createMockState, createMockPlayer } from '../../test/mocks';
import { updatePhysics } from './physics';
import { resetHungerRound } from '../net/roomSetup';
import { tickBleeding } from './bleeding';

/** A fighter wounded by 'shooter' with the given health and armor, alone in a fresh state. */
const wounded = (health = 10, armor = 0, mode = GameMode.DEATHMATCH) => {
    const state = createMockState(mode);
    const p: Entity = Object.assign(createMockPlayer('p1', Team.NONE), { health, armor, wound: { by: 'shooter' } });
    state.players.push(p);
    return { state, p };
};

const bleed = (state: ReturnType<typeof createMockState>, ticks: number) => {
    for (let i = 0; i < ticks; i++) tickBleeding(state);
};

describe('tickBleeding', () => {
    it('drains 1 HP per second', () => {
        const { state, p } = wounded();
        bleed(state, 120);
        expect(p.health).toBeCloseTo(9, 5);
    });

    it('bleeds out in about 10 s', () => {
        const alive = wounded();
        bleed(alive.state, 1180);
        expect(alive.p.dead).toBe(false);

        // A few ticks of slack: the float sum of 1/120 may leave ~1e-13 HP at tick 1200
        const dead = wounded();
        bleed(dead.state, 1210);
        expect(dead.p.dead).toBe(true);
        expect(dead.p.wound).toBeUndefined();
    });

    it('ignores armor', () => {
        const { state, p } = wounded(10, 50);
        bleed(state, 120);
        expect(p.armor).toBe(50);
        expect(p.health).toBeCloseTo(9, 5);
    });

    it('leaves an unwounded fighter alone', () => {
        const { state, p } = wounded();
        p.wound = undefined;
        bleed(state, 120);
        expect(p.health).toBe(10);
    });

    it('pauses when the round is decided', () => {
        const { state, p } = wounded(10, 0, GameMode.HUNGER_GAMES);
        state.hungerRoundEndsAt = Date.now() + 5000;
        bleed(state, 120);
        expect(p.health).toBe(10);
        expect(p.wound).toBeDefined();
    });

    it('does not bleed a dead fighter', () => {
        const { state, p } = wounded();
        p.dead = true;
        bleed(state, 120);
        expect(p.health).toBe(10);
    });
});

describe('medkit', () => {
    it('heals the wound', () => {
        const { state, p } = wounded();
        state.pickups.push({ id: 'h1', type: ItemType.HEALTH, pos: { x: 0, y: 0 }, active: true, respawnTime: 0, value: 25 });

        updatePhysics(state, {}, { x: 0, y: 0 }, false, false, 800, 600, () => ({ x: 0, y: 0 }), 'p1');

        expect(p.wound).toBeUndefined();
        expect(p.health).toBe(35);
    });
});

describe('round reset', () => {
    it('clears the wound', () => {
        const { state, p } = wounded(10, 0, GameMode.HUNGER_GAMES);
        resetHungerRound(state, Date.now());
        expect(p.wound).toBeUndefined();
    });
});
