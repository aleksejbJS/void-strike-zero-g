// How a fighter dies, decided from what killed them (pure logic, no rendering).
// The kind picks which ragdoll launch the corpse gets: see launchCorpse.

import { Vector2, WeaponType } from '../../types';

/** fall: slumps where it stands; thrown: flung away from the blast; gib: torn into pieces; cut: sliced in half. */
export type DeathKind = 'fall' | 'thrown' | 'gib' | 'cut';

const DEATH_KINDS: ReadonlySet<unknown> = new Set<DeathKind>(['fall', 'thrown', 'gib', 'cut']);

/** True for one of the four kinds; a kind from the network may be anything (a newer or hostile host). */
export const isDeathKind = (kind: unknown): kind is DeathKind => DEATH_KINDS.has(kind);

export interface DamageSource {
    weapon?: WeaponType;
    /** The projectile itself hit the victim (not its blast). */
    direct?: boolean;
    /** Blast centre, shooter muzzle or beam origin. */
    from?: Vector2;
    /** World units from the shooter to the victim. */
    shooterDist?: number;
}

/** Damage beyond the victim's remaining health that turns an explosion into gibs. */
export const GIB_OVERKILL = 30;
/** A shotgun blast from this close (world units) throws the victim. */
export const SHOTGUN_POINT_BLANK = 120;

/** An explosion's splash (rocket or grenade blast that did not hit the victim itself), not a shot. */
export const isSplash = (source: DamageSource): boolean =>
    (source.weapon === WeaponType.ROCKET_LAUNCHER || source.weapon === WeaponType.GRENADE_LAUNCHER) && !source.direct;

/** `overkill` = the killing hit's damage after armor minus the victim's health right before it. */
export const deathKind = (source: DamageSource, overkill: number): DeathKind => {
    switch (source.weapon) {
        case WeaponType.SHOTGUN:
            // No distance known: treat as far, so a missing value never launches a body.
            return (source.shooterDist ?? Infinity) <= SHOTGUN_POINT_BLANK ? 'thrown' : 'fall';
        case WeaponType.ROCKET_LAUNCHER:
        case WeaponType.GRENADE_LAUNCHER:
            return source.direct || overkill >= GIB_OVERKILL ? 'gib' : 'thrown';
        case WeaponType.RAILGUN:
            return 'cut';
        case WeaponType.CHAINSAW:
            return 'gib';
        default:
            // Machine gun, plasma, zone, fall: the body just drops.
            return 'fall';
    }
};
