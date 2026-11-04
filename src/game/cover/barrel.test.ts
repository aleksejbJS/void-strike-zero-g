import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameMode, Team } from '../../types';
import type { Entity } from '../../types';
import { createMockPlayer, createMockState } from '../../test/mocks';
import { gameEvents, GameEvent } from '../systems/events';
import { achievementManager } from '../systems/achievements';
import { applyDamage } from '../systems/combat';
import { BARREL_CHAIN_MS, BARREL_DAMAGE, BARREL_RADIUS, Cover } from './coverTypes';
import { damageCover } from './coverDamage';
import { tickCover } from './coverTick';
import { piece } from './coverTestKit';

const NOW = 1_000_000;

let events: GameEvent[];
let unsubscribe: () => void;
beforeEach(() => { events = []; unsubscribe = gameEvents.on(e => events.push(e)); });
afterEach(() => { unsubscribe(); vi.restoreAllMocks(); });

/** A state in `mode` holding the given cover. */
const arena = (mode: GameMode, ...cover: Cover[]) => Object.assign(createMockState(mode), { cover });
/** A barrel standing at x on the ground line: its blast centre is (x, -23). */
const barrelAt = (id: string, x: number) => piece(id, 'barrel', x, 0);
/** A fighter whose feet are `dy` below the blast line (y -23) of a barrel at x. */
const fighter = (id: string, team: Team, x: number, health = 100, dy = 0): Entity =>
    Object.assign(createMockPlayer(id, team), { pos: { x, y: -23 + dy }, health });

/** `who` shoots the barrel apart; its fuse is due at once, so the next tick sets it off. */
const breakBarrel = (state: ReturnType<typeof arena>, barrel: Cover, who: string) =>
    damageCover(state, barrel, 1000, who, NOW);

const explosions = () => events.filter(e => e.type === 'EFFECT' && e.effect === 'explosion');
const kills = () => events.flatMap(e => (e.type === 'KILL' ? [e] : []));

const FALLOFF_50PX = BARREL_DAMAGE * (1 - 50 / BARREL_RADIUS); // 50 px from the centre

describe('barrel blast', () => {
    it('blast hurts teammates and the breaker at full damage', () => {
        const barrel = barrelAt('b', 300);
        const state = arena(GameMode.CTF, barrel);
        const breaker = fighter('p1', Team.RED, 350);
        const mate = fighter('p2', Team.RED, 250);
        const foe = fighter('p3', Team.BLUE, 300, 100, -50); // 50 px straight above
        state.players.push(breaker, mate, foe);

        breakBarrel(state, barrel, 'p1');
        tickCover(state, NOW);

        for (const p of [breaker, mate, foe]) expect(p.health).toBeCloseTo(100 - FALLOFF_50PX, 5); // no halving for the breaker
        expect(breaker.vel.x).toBeGreaterThan(0);
        expect(breaker.vel.x).toBeCloseTo(-mate.vel.x, 5); // same shove at the same distance: no self-knockback boost
    });

    it('kill is credited to the breaker and shown as Barrel', () => {
        const barrel = barrelAt('b', 300);
        const state = arena(GameMode.DEATHMATCH, barrel);
        const breaker = fighter('p1', Team.NONE, 1500);
        const victim = fighter('v', Team.NONE, 300, 50);
        state.players.push(breaker, victim);

        breakBarrel(state, barrel, 'p1');
        tickCover(state, NOW);

        expect(victim.dead).toBe(true);
        expect(kills()).toEqual([expect.objectContaining({ killer: 'p1', weapon: 'Barrel', victim: 'v' })]);
        expect(breaker.score).toBe(1);
        expect(events).toContainEqual(expect.objectContaining({ type: 'DEATH', blast: true })); // thrown by the blast
    });

    it('chain of two barrels credits the first breaker, second explodes 150 ms later', () => {
        const first = barrelAt('a', 300);
        const second = barrelAt('b', 380); // 80 px away: inside the 170 px blast, 3x damage breaks it
        const state = arena(GameMode.DEATHMATCH, first, second);
        const breaker = fighter('p1', Team.NONE, 1500);
        const victim = fighter('v', Team.NONE, 450, 20); // out of reach of the first barrel, in reach of the second
        state.players.push(breaker, victim);

        breakBarrel(state, first, 'p1');
        tickCover(state, NOW);
        expect(explosions()).toHaveLength(1);
        expect(second.hp).toBe(0);
        expect(second.creditId).toBe('p1'); // the fighter, not the first barrel
        expect(second.fuseAt).toBe(NOW + BARREL_CHAIN_MS);
        expect(victim.dead).toBe(false);

        tickCover(state, NOW + BARREL_CHAIN_MS - 1);
        expect(explosions()).toHaveLength(1);

        tickCover(state, NOW + BARREL_CHAIN_MS);
        expect(explosions()).toHaveLength(2);
        expect(victim.dead).toBe(true);
        expect(kills()).toEqual([expect.objectContaining({ killer: 'p1', weapon: 'Barrel', victim: 'v' })]);
        expect(breaker.score).toBe(1);
    });

    it('explodes once when broken twice in one tick', () => {
        const barrel = barrelAt('b', 300);
        const state = arena(GameMode.DEATHMATCH, barrel);

        breakBarrel(state, barrel, 'p1');
        breakBarrel(state, barrel, 'p2'); // a second shot in the same tick finds nothing left to break
        expect(barrel.creditId).toBe('p1');

        tickCover(state, NOW);
        tickCover(state, NOW);
        tickCover(state, NOW + 1000);

        expect(explosions()).toHaveLength(1);
        expect(barrel.fuseAt).toBeUndefined();
    });

    it('two barrels lit in the same tick explode once each', () => {
        const a = barrelAt('a', 300);
        const b = barrelAt('b', 380);
        const state = arena(GameMode.DEATHMATCH, a, b);

        breakBarrel(state, a, 'p1');
        breakBarrel(state, b, 'p1'); // both lit in the same tick
        tickCover(state, NOW);
        tickCover(state, NOW + BARREL_CHAIN_MS);

        expect(explosions()).toHaveLength(2); // the first blast finds the second already broken
    });

    it('team kill and self kill by barrel give no score', () => {
        const mates = arena(GameMode.DEATHMATCH, barrelAt('b', 300));
        const breaker = fighter('p1', Team.RED, 1500);
        const mate = fighter('p2', Team.RED, 300, 50);
        mates.players.push(breaker, mate);
        breakBarrel(mates, mates.cover[0], 'p1');
        tickCover(mates, NOW);
        expect(mate.dead).toBe(true);
        expect(breaker.score).toBe(0);

        const alone = arena(GameMode.DEATHMATCH, barrelAt('b', 300));
        const suicide = fighter('p1', Team.NONE, 300, 50);
        alone.players.push(suicide);
        breakBarrel(alone, alone.cover[0], 'p1');
        tickCover(alone, NOW);
        expect(suicide.dead).toBe(true);
        expect(suicide.score).toBe(0);
    });

    it('gun game ladder does not advance on a barrel kill', () => {
        const state = arena(GameMode.GUN_GAME, barrelAt('b', 300));
        const breaker = fighter('p1', Team.NONE, 1500);
        const victim = fighter('v', Team.NONE, 300, 50);
        const other = fighter('o', Team.NONE, 900, 5);
        state.players.push(breaker, victim, other);

        breakBarrel(state, state.cover[0], 'p1');
        tickCover(state, NOW);
        expect(victim.dead).toBe(true);
        expect(breaker.score).toBe(1); // it still counts as a kill
        expect(breaker.gunProgress).toBe(0);

        applyDamage(state, other, 'p1', 50, { x: 1, y: 0 }); // an ordinary kill does advance it
        expect(breaker.gunProgress).toBe(1);
    });

    it('barrel kill does not count for weapon achievements', () => {
        const progress = vi.spyOn(achievementManager, 'updateProgress').mockReturnValue(false);
        const state = arena(GameMode.DEATHMATCH, barrelAt('b', 300));
        const breaker = fighter('p1', Team.NONE, 1500);
        const victim = fighter('v', Team.NONE, 300, 50);
        const other = fighter('o', Team.NONE, 900, 5);
        state.players.push(breaker, victim, other);

        breakBarrel(state, state.cover[0], 'p1');
        tickCover(state, NOW);
        expect(victim.dead).toBe(true);
        expect(progress).not.toHaveBeenCalled();

        applyDamage(state, other, 'p1', 50, { x: 1, y: 0 }); // an ordinary kill is tracked
        expect(progress).toHaveBeenCalledWith('first_blood');
    });
});
