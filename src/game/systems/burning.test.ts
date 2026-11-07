import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameMode, ItemType, Team, WeaponType } from '../../types';
import type { Entity, GameState } from '../../types';
import { createMockState, createMockPlayer } from '../../test/mocks';
import { WEAPONS_DATA } from '../../constants';
import { resetHungerRound } from '../net/roomSetup';
import { toLocalClock } from '../net/clock';
import { gameEvents, GameEvent } from './events';
import { updatePhysics } from './physics';
import { igniteBurn, extinguish, isBurning, tickBurning } from './burning';
import { BURN_MS, BURN_TICK_MS } from './flameConstants';
import { NOW } from './flameTestKit';

let events: GameEvent[] = [];
let unsubscribe: () => void;
beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] }); // applyDamage and updatePhysics read Date.now() themselves
    vi.setSystemTime(NOW);
    events = [];
    unsubscribe = gameEvents.on(e => events.push(e));
});
afterEach(() => { unsubscribe(); vi.useRealTimers(); });

/** A Deathmatch state with a bystander 'foe' (health, armor given) and an arsonist 'arsonist' who is not hurt. */
const scene = (health = 100, armor = 0): { state: GameState; foe: Entity } => {
    const state = createMockState(GameMode.DEATHMATCH);
    state.players.push(createMockPlayer('arsonist', Team.NONE, WeaponType.FLAMETHROWER));
    const foe: Entity = Object.assign(createMockPlayer('foe', Team.NONE), { health, armor });
    state.players.push(foe);
    return { state, foe };
};

/** Runs the burn clock from `from` to `to` (inclusive) in 10 ms steps, like many physics ticks. */
const runClock = (state: GameState, from: number, to: number): void => {
    for (let t = from; t <= to; t += 10) tickBurning(state, t);
};

describe('igniteBurn', () => {
    it('burns for BURN_MS and ticks first after BURN_TICK_MS', () => {
        const { foe } = scene();
        igniteBurn(foe, 'arsonist', NOW);
        expect(foe).toMatchObject({ burnUntil: NOW + BURN_MS, burnTickAt: NOW + BURN_TICK_MS, burnBy: 'arsonist' });
        expect(isBurning(foe, NOW)).toBe(true);
        expect(isBurning(foe, NOW + BURN_MS)).toBe(false);
    });

    it('a refresh restarts the 5 s and the new arsonist takes the credit, but does not delay the next tick', () => {
        const { foe } = scene();
        igniteBurn(foe, 'arsonist', NOW);
        igniteBurn(foe, 'other', NOW + 300);
        expect(foe).toMatchObject({ burnUntil: NOW + 300 + BURN_MS, burnTickAt: NOW + BURN_TICK_MS, burnBy: 'other' });
    });

    it('extinguish clears all three fields', () => {
        const { foe } = scene();
        igniteBurn(foe, 'arsonist', NOW);
        extinguish(foe);
        expect(foe).toMatchObject({ burnUntil: undefined, burnTickAt: undefined, burnBy: undefined });
        expect(isBurning(foe, NOW)).toBe(false);
    });
});

describe('tickBurning', () => {
    it('a full burn costs exactly 10 HP over 5000 ms, then the fire is out', () => {
        const { state, foe } = scene();
        igniteBurn(foe, 'arsonist', NOW);
        runClock(state, NOW, NOW + BURN_MS - 10);
        expect(foe.health).toBe(91); // ticks at 500..4500 are in: the last one is due at 5000
        runClock(state, NOW + BURN_MS, NOW + BURN_MS + 3000);
        expect(foe.health).toBe(90);
        expect(foe.burnUntil).toBeUndefined();
    });

    it('a refresh at 2500 ms extends the burn to 7500 ms without an extra tick', () => {
        const { state, foe } = scene();
        igniteBurn(foe, 'arsonist', NOW);
        runClock(state, NOW, NOW + 2500);
        igniteBurn(foe, 'arsonist', NOW + 2500);
        expect(foe.burnUntil).toBe(NOW + 7500);
        runClock(state, NOW + 2510, NOW + 9000);
        expect(foe.health).toBe(100 - 15); // one tick per 500 ms over 7500 ms, never two at once
    });

    it('catches up the ticks of a stalled loop instead of dropping them', () => {
        const { state, foe } = scene();
        igniteBurn(foe, 'arsonist', NOW);
        tickBurning(state, NOW + 8000); // one call long after the fire was due to end
        expect(foe.health).toBe(90);
        expect(foe.burnUntil).toBeUndefined();
    });

    it('leaves armor untouched: burn is plain health loss with no damage number', () => {
        const { state, foe } = scene(100, 50);
        igniteBurn(foe, 'arsonist', NOW);
        runClock(state, NOW, NOW + BURN_MS);
        expect(foe.armor).toBe(50);
        expect(foe.health).toBe(90);
        expect(events.filter(e => e.type === 'DAMAGE')).toHaveLength(0);
    });

    it('a burn death credits the arsonist with the Flamethrower in the kill feed', () => {
        const { state, foe } = scene(1);
        const arsonist = state.players[0];
        arsonist.weapon = { ...WEAPONS_DATA[WeaponType.SHOTGUN] }; // holds another gun now: the feed still says Flamethrower
        igniteBurn(foe, 'arsonist', NOW);
        runClock(state, NOW, NOW + BURN_TICK_MS);
        expect(foe.dead).toBe(true);
        expect(arsonist.score).toBe(1);
        const kills = events.flatMap(e => (e.type === 'KILL' ? [e] : []));
        expect(kills).toHaveLength(1);
        expect(kills[0]).toMatchObject({ killer: 'arsonist', weapon: 'Flamethrower', victim: 'foe' });
    });

    it('a dead fighter is extinguished and takes no more ticks after respawn', () => {
        const { state, foe } = scene(1);
        igniteBurn(foe, 'arsonist', NOW);
        runClock(state, NOW, NOW + BURN_TICK_MS);
        expect(foe.dead).toBe(true);
        expect(foe).toMatchObject({ burnUntil: undefined, burnTickAt: undefined, burnBy: undefined });
        foe.dead = false; // respawned
        foe.health = 100;
        runClock(state, NOW + BURN_TICK_MS + 10, NOW + 2 * BURN_MS);
        expect(foe.health).toBe(100);
    });

    it('does not burn a corpse that is still marked burning', () => {
        const { state, foe } = scene();
        igniteBurn(foe, 'arsonist', NOW);
        foe.dead = true;
        runClock(state, NOW, NOW + BURN_MS);
        expect(foe.health).toBe(100);
    });

    it('pauses once the Hunger round is decided', () => {
        const { state, foe } = scene();
        state.mode = GameMode.HUNGER_GAMES;
        state.hungerRoundEndsAt = NOW + 5000;
        igniteBurn(foe, 'arsonist', NOW);
        runClock(state, NOW, NOW + BURN_MS);
        expect(foe.health).toBe(100);
        expect(foe.burnUntil).toBeDefined();
    });
});

describe('burn and the rest of the game', () => {
    it('a medkit heals but does not put the fire out', () => {
        const { state, foe } = scene(50);
        foe.pos = { x: 0, y: 0 };
        igniteBurn(foe, 'arsonist', NOW);
        state.pickups.push({ id: 'h1', type: ItemType.HEALTH, pos: { x: 0, y: 0 }, active: true, respawnTime: 0, value: 25 });
        updatePhysics(state, {}, { x: 0, y: 0 }, false, false, 800, 600, () => ({ x: 0, y: 0 }), 'foe');
        expect(foe.health).toBe(75);
        expect(foe.burnUntil).toBeDefined();
    });

    it('a new Hunger round puts out every fire', () => {
        const { state, foe } = scene();
        state.mode = GameMode.HUNGER_GAMES;
        igniteBurn(foe, 'arsonist', NOW);
        resetHungerRound(state, NOW);
        expect(foe).toMatchObject({ burnUntil: undefined, burnTickAt: undefined, burnBy: undefined });
    });

    it('a snapshot shifts the burn timestamps to the local clock, leaving an unlit fighter alone', () => {
        const { foe } = scene();
        const calm = createMockPlayer('calm', Team.NONE);
        igniteBurn(foe, 'arsonist', 1000);
        const snap: any = { serverTime: 1000, players: [foe, calm] };
        toLocalClock(snap, 300);
        expect(foe).toMatchObject({ burnUntil: 1000 + BURN_MS + 300, burnTickAt: 1000 + BURN_TICK_MS + 300 });
        expect(calm.burnUntil).toBeUndefined();
    });
});
