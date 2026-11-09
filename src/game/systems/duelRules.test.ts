import { describe, it, expect } from 'vitest';
import { GameMode, Team, WeaponType } from '../../types';
import { WEAPONS_DATA } from '../../constants';
import { createMockState, createMockPlayer } from '../../test/mocks';
import { PIT_SPAWNS } from '../data/pitMap';
import { duelLoadout, duelSpawnPoint } from './duelRules';
import { updatePhysics } from './physics';

const ORDER = [
    WeaponType.MACHINE_GUN, WeaponType.SHOTGUN, WeaponType.RAILGUN, WeaponType.ROCKET_LAUNCHER,
    WeaponType.GRENADE_LAUNCHER, WeaponType.SMOKE_LAUNCHER, WeaponType.CHAINSAW,
];

describe('duelLoadout', () => {
    it('is the seven fixed weapons in order, without plasma', () => {
        const loadout = duelLoadout();
        expect(loadout.map(w => w.type)).toEqual(ORDER);
        expect(loadout.some(w => w.type === WeaponType.PLASMA_GUN)).toBe(false);
    });

    it('gives the machine gun a full 50-round magazine and every other weapon its normal ammo', () => {
        const loadout = duelLoadout();
        expect(loadout[0]).toMatchObject({ type: WeaponType.MACHINE_GUN, ammo: 50, reloadMs: 1000 });
        for (const w of loadout) expect(w.ammo).toBe(WEAPONS_DATA[w.type].ammo);
    });

    it('returns fresh copies, so ammo is never shared', () => {
        const [a, b] = [duelLoadout(), duelLoadout()];
        expect(a[1]).not.toBe(b[1]);
        a[1].ammo = 0;
        expect(b[1].ammo).toBe(WEAPONS_DATA[WeaponType.SHOTGUN].ammo);
        expect(WEAPONS_DATA[WeaponType.SHOTGUN].ammo).not.toBe(0);
    });
});

describe('duelSpawnPoint', () => {
    const duel = (opponentX: number | null, opponentDead = false) => {
        const state = createMockState(GameMode.DUEL);
        state.players.push(createMockPlayer('me', Team.NONE));
        if (opponentX !== null) {
            const foe = createMockPlayer('foe', Team.NONE);
            foe.pos = { x: opponentX, y: 1300 };
            foe.dead = opponentDead;
            state.players.push(foe);
        }
        return state;
    };

    it('picks the right spawn when the opponent stands on the left one', () => {
        expect(duelSpawnPoint(duel(300), 'me')).toEqual(PIT_SPAWNS[1]);
    });

    it('picks the left spawn when the opponent stands on the right one', () => {
        expect(duelSpawnPoint(duel(2300), 'me')).toEqual(PIT_SPAWNS[0]);
    });

    it('goes to the spawn farther from an opponent standing mid-way', () => {
        expect(duelSpawnPoint(duel(1000), 'me')).toEqual(PIT_SPAWNS[1]);
        expect(duelSpawnPoint(duel(1600), 'me')).toEqual(PIT_SPAWNS[0]);
    });

    it('ignores a dead opponent and alternates by player index', () => {
        expect(duelSpawnPoint(duel(300, true), 'me')).toEqual(PIT_SPAWNS[0]);
        const state = duel(300, true);
        expect(duelSpawnPoint(state, 'foe')).toEqual(PIT_SPAWNS[1]);
    });

    it('alternates by index when nobody else is in the room', () => {
        expect(duelSpawnPoint(duel(null), 'me')).toEqual(PIT_SPAWNS[0]);
    });

    it('treats a fighter who is not in the list yet as the next one in line', () => {
        expect(duelSpawnPoint(duel(null), 'newcomer')).toEqual(PIT_SPAWNS[1]);
    });

    it('returns a copy, so callers can move it freely', () => {
        const spawn = duelSpawnPoint(duel(300), 'me');
        expect(spawn).not.toBe(PIT_SPAWNS[1]);
        spawn.x = 0;
        expect(PIT_SPAWNS[1].x).toBe(2300);
    });
});

describe('duel respawn in updatePhysics', () => {
    const respawnNextTo = (opponentX: number, mode: GameMode) => {
        const state = createMockState(mode);
        const loser = createMockPlayer('loser', Team.NONE);
        loser.dead = true;
        loser.respawnTimer = 0;
        loser.inventory = [{ ...WEAPONS_DATA[WeaponType.PLASMA_GUN] }];
        const foe = createMockPlayer('foe', Team.NONE);
        foe.pos = { x: opponentX, y: 1300 };
        state.players.push(loser, foe);
        updatePhysics(state, {}, { x: 0, y: 0 }, false, false, 800, 600, () => ({ x: -1, y: -1 }), 'foe');
        return loser;
    };

    it('uses the duel spawn away from the opponent and the fixed loadout', () => {
        const loser = respawnNextTo(2300, GameMode.DUEL);
        expect(loser.dead).toBe(false);
        expect(loser.pos).toEqual(PIT_SPAWNS[0]);
        expect(loser.inventory.map(w => w.type)).toEqual(duelLoadout().map(w => w.type));
        expect(loser.weapon).toBe(loser.inventory[0]);
    });

    it('other modes still respawn on the given spawn with the machine gun only', () => {
        const loser = respawnNextTo(2300, GameMode.DEATHMATCH);
        expect(loser.pos).toEqual({ x: -1, y: -1 });
        expect(loser.inventory.map(w => w.type)).toEqual([WeaponType.MACHINE_GUN]);
    });
});
