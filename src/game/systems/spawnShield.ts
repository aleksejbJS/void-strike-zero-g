// Spawn protection (spec 2026-11-04-spawn-shield): a fighter that comes back after a death
// cannot be hurt for a moment, so nobody is killed on the spawn point before they can react.
// Firing ends it early: the shield is for getting away, not for free shots.

import { Entity } from '../../types';

export const SPAWN_SHIELD_MS = 2000;

/** Milliseconds of spawn protection left (0 when there is none). */
export const spawnShieldLeft = (p: Pick<Entity, 'spawnShieldUntil'>, now: number) =>
    p.spawnShieldUntil ? Math.max(0, p.spawnShieldUntil - now) : 0;

/** Called on a respawn after a death (never on a first spawn or a round restart). */
export const grantSpawnShield = (p: Entity, now: number) => {
    p.spawnShieldUntil = now + SPAWN_SHIELD_MS;
};

/** The holder fired: the protection is over. */
export const dropSpawnShield = (p: Entity) => {
    p.spawnShieldUntil = undefined;
};
