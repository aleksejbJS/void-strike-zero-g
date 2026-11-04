// Rules of the 1v1 duel (tournament matches on The Pit): a fixed loadout and spawns that
// keep the two fighters apart. The score limit and sudden death live in matchRound.ts.

import { GameState, Vector2, Weapon, WeaponType } from '../../types';
import { WEAPONS_DATA } from '../../constants';
import { PIT_SPAWNS } from '../data/pitMap';
import { distance } from '../utils/math';

// Everything except plasma, in number-key order (1..7)
const DUEL_WEAPONS: readonly WeaponType[] = [
    WeaponType.MACHINE_GUN, WeaponType.SHOTGUN, WeaponType.RAILGUN, WeaponType.ROCKET_LAUNCHER,
    WeaponType.GRENADE_LAUNCHER, WeaponType.SMOKE_LAUNCHER, WeaponType.CHAINSAW,
];

/** Fresh weapons for one fighter's life; ammo is never shared between calls. */
export const duelLoadout = (): Weapon[] => DUEL_WEAPONS.map(type => ({ ...WEAPONS_DATA[type] }));

/** A copy of the spawn for the n-th fighter: left, right, left... */
export const duelSpawnByIndex = (index: number): Vector2 => ({ ...PIT_SPAWNS[index % PIT_SPAWNS.length] });

/**
 * Where a fighter (re)spawns: the spawn farther from the nearest living opponent.
 * With nobody to avoid, fighters alternate by their place in the player list
 * (someone not listed yet counts as the next one in line).
 */
export const duelSpawnPoint = (state: GameState, playerId: string): Vector2 => {
    const foes = state.players.filter(p => p.id !== playerId && !p.dead);
    if (foes.length === 0) {
        const index = state.players.findIndex(p => p.id === playerId);
        return duelSpawnByIndex(index === -1 ? state.players.length : index);
    }
    const nearestFoe = (spawn: Vector2) => Math.min(...foes.map(f => distance(spawn, f.pos)));
    const [left, right] = PIT_SPAWNS;
    return { ...(nearestFoe(right) > nearestFoe(left) ? right : left) };
};
