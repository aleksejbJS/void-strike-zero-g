// A living carrier blown up by their own tank: no "9999" damage number over them, extra blood, burning fuel, a gib and a
// "Fuel Tank" kill for whoever lit the tank (spec 2026-11-07-flamethrower, section 4).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameMode, Team, WeaponType } from '../../types';
import { createMockState, createMockPlayer } from '../../test/mocks';
import { gameEvents, GameEvent } from './events';
import { applyDamage } from './combat';
import { updatePhysics } from './physics';
import { tankPos } from './fuelTankBlast';
import { TANK_BLOOD, TANK_FUSE_MS, TANK_KILL_NAME } from './flameConstants';
import { NOW } from './flameTestKit';

let events: GameEvent[] = [];
let unsubscribe: () => void;
beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] }); // applyDamage and updatePhysics read Date.now() themselves
    vi.setSystemTime(NOW);
    events = [];
    unsubscribe = gameEvents.on(e => events.push(e));
});
afterEach(() => { unsubscribe(); vi.restoreAllMocks(); vi.useRealTimers(); });

const of = <T extends GameEvent['type']>(type: T) => events.filter(e => e.type === type) as Extract<GameEvent, { type: T }>[];

describe('the carrier\'s own tank blast', () => {
    it('shows no damage number and does not push the carrier', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const carrier = createMockPlayer('carrier', Team.NONE, WeaponType.FLAMETHROWER);
        state.players.push(carrier);
        applyDamage(state, carrier, 'igniter', 9999, { x: 1, y: -1 }, 0, { tank: true, direct: true, from: tankPos(carrier) });
        expect(carrier.dead).toBe(true);
        expect(of('DAMAGE')).toEqual([]);
        expect(carrier.vel).toEqual({ x: 0, y: 0 });
    });

    it('end to end: a hit lights the tank, the fuse runs out in the game loop, the carrier is gibbed with extra blood', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const carrier = createMockPlayer('carrier', Team.NONE, WeaponType.FLAMETHROWER);
        carrier.pos = { x: 400, y: 300 };
        const igniter = createMockPlayer('igniter', Team.NONE);
        igniter.pos = { x: 4000, y: 300 }; // far out of the blast
        state.players.push(carrier, igniter);

        // The igniter's rocket lights the tank (the roll is forced), and the carrier survives the hit
        const roll = vi.spyOn(Math, 'random').mockReturnValue(0);
        applyDamage(state, carrier, 'igniter', 10, { x: 1, y: 0 }, 0, { weapon: WeaponType.ROCKET_LAUNCHER, direct: true });
        roll.mockRestore();
        expect(carrier.tankFuseAt).toBe(NOW + TANK_FUSE_MS);
        expect(carrier.dead).toBe(false);

        events = [];
        vi.setSystemTime(NOW + TANK_FUSE_MS);
        updatePhysics(state, {}, { x: 0, y: 0 }, false, false, 800, 600, () => ({ x: 2000, y: 0 }), 'nobody');

        expect(carrier.dead).toBe(true);
        expect(of('DAMAGE')).toEqual([]);
        expect(of('DEATH')).toEqual([expect.objectContaining({ kind: 'gib' })]);
        expect(of('KILL')).toEqual([expect.objectContaining({ killer: 'igniter', weapon: TANK_KILL_NAME, victim: 'carrier' })]);
        expect(of('EFFECT')).toContainEqual(expect.objectContaining({ effect: 'blood', count: TANK_BLOOD }));
        expect(of('TANK_BLAST')).toHaveLength(1); // clients throw the burning fuel
    });
});
