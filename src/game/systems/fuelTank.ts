// The flamethrower's fuel tank: a hit on its carrier can set the tank on fire, and 3 s later it blasts
// (spec 2026-11-07-flamethrower). This file decides the ignition; the fuse and the blast live elsewhere.

import type { Entity } from '../../types';
import { WeaponType } from '../../types';
import type { DamageSource } from './deathKind';
import { gameEvents } from './events';
import { TANK_BLAST_CHANCE, TANK_FUSE_MS, TANK_IGNITE_CHANCE } from './flameConstants';

/** Chance that one hit with this source sets a carrier's tank on fire (0 to 1). */
export const ignitionChance = (source: DamageSource): number => {
    // Not hits: bleeding and burning are health loss over time. A tank's own blast killing its carrier
    // (direct) must never light the tank that just blew up.
    if (source.bleed || source.burn || (source.tank && source.direct)) return 0;
    if (source.barrel || source.tank) return TANK_BLAST_CHANCE;
    if (source.weapon === undefined) return 0; // zone, fall
    // A rocket or grenade lights the tank by its blast, whether it hit directly or only splashed
    if (source.weapon === WeaponType.ROCKET_LAUNCHER || source.weapon === WeaponType.GRENADE_LAUNCHER) return TANK_BLAST_CHANCE;
    return TANK_IGNITE_CHANCE[source.weapon] ?? 0;
};

/**
 * Rolls whether this hit lights the target's fuel tank; on success the tank blasts at `now + TANK_FUSE_MS` and
 * `attackerId` takes the credit. Only a fighter holding the flamethrower has a tank, and a burning tank keeps its first
 * fuse and arsonist. Your own shots never light your tank, but a blast does, even one you set off yourself (a barrel).
 * Call it before the death check, so the killing hit can light the tank too.
 */
export const rollTankIgnition = (
    target: Entity, attackerId: string, source: DamageSource, now: number, rand: () => number = Math.random,
): boolean => {
    if (target.weapon.type !== WeaponType.FLAMETHROWER || target.tankFuseAt !== undefined) return false;
    const blast = !!source.barrel || !!source.tank;
    if (attackerId === target.id && !blast) return false;
    const chance = ignitionChance(source);
    if (chance <= 0 || rand() >= chance) return false;
    target.tankFuseAt = now + TANK_FUSE_MS;
    target.tankBy = attackerId;
    gameEvents.emit({ type: 'SOUND', sound: 'flame', subtype: 'ignite' });
    return true;
};
