import { describe, it, expect } from 'vitest';
import { Entity, GameMode, ItemType, MapId, Pickup, Team, WeaponType } from '../../types';
import { makeBot, makeState } from '../../test/botFixtures';
import { getInitialPickups, getPlatforms } from './level';
import { findWeaponPickup, pickupReachable } from '../systems/botWeapons';

const FLAME_LAYOUTS: [GameMode, MapId][] = [
    [GameMode.DEATHMATCH, MapId.DEFAULT],
    [GameMode.DEATHMATCH, MapId.TUNNELS],
    [GameMode.CTF, MapId.DEFAULT],
    [GameMode.HOLD_THE_FLAG, MapId.DEFAULT],
    [GameMode.INFILTRATION, MapId.DEFAULT],
    [GameMode.HUNGER_GAMES, MapId.HUNGER],
];

const MIN_GAP = 50; // px between the flamethrower and any other pickup

const flamePickups = (mode: GameMode, map: MapId): Pickup[] =>
    getInitialPickups(mode, map).filter(p => p.type === ItemType.WEAPON && p.subtype === WeaponType.FLAMETHROWER);

const stateWith = (mode: GameMode, map: MapId, pickups: Pickup[]) =>
    ({ ...makeState(), mode, currentMap: map, platforms: getPlatforms(mode, map), pickups });

describe('flamethrower pickups', () => {
    it.each(FLAME_LAYOUTS)('%s on %s has exactly one flamethrower', (mode, map) => {
        const flames = flamePickups(mode, map);
        expect(flames).toHaveLength(1);
        expect(flames[0]).toMatchObject({ active: true, respawnTime: 0, value: 0 });
        expect(flames[0].id.endsWith('_flame')).toBe(true);
    });

    it.each(FLAME_LAYOUTS)('%s on %s: a bot can reach the flamethrower', (mode, map) => {
        const [flame] = flamePickups(mode, map);
        const state = stateWith(mode, map, [flame]);
        expect(pickupReachable(state, flame)).toBe(true);
        // A bot standing on the main floor has a route to it and goes for it
        const floor = state.platforms[0];
        const bot = makeBot('bot1', Team.NONE, 1000, floor.y) as unknown as Entity;
        expect(findWeaponPickup(state, bot)?.id).toBe(flame.id);
    });

    it.each(FLAME_LAYOUTS)('%s on %s: the flamethrower hangs just above a surface', (mode, map) => {
        const { x, y } = flamePickups(mode, map)[0].pos;
        const standsOn = getPlatforms(mode, map).some(p => x >= p.x && x <= p.x + p.w && p.y - y >= 0 && p.y - y <= 60);
        expect(standsOn).toBe(true);
    });

    // Older pickups already overlap in places (a medkit on a fuel can); the flamethrower must not add to that
    it.each(FLAME_LAYOUTS)('%s on %s: the flamethrower does not sit on another pickup', (mode, map) => {
        const [flame] = flamePickups(mode, map);
        const crowding = getInitialPickups(mode, map)
            .filter(p => p.id !== flame.id && Math.hypot(p.pos.x - flame.pos.x, p.pos.y - flame.pos.y) < MIN_GAP)
            .map(p => p.id);
        expect(crowding).toEqual([]);
    });

    it('Gun Game and Duel have none', () => {
        expect(flamePickups(GameMode.GUN_GAME, MapId.DEFAULT)).toEqual([]);
        expect(flamePickups(GameMode.DUEL, MapId.PIT)).toEqual([]);
    });
});
