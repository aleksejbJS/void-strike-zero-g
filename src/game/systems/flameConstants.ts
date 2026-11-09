// Tuning values of the flamethrower: the flame stream, the burning status and the fuel tank.
// The stream's own stats (damage per tick, fire rate, ammo) live in WEAPONS_DATA.

import { WeaponType } from '../../types';
import type { CoverKind } from '../cover/coverTypes';

/** How far the flame reaches, in world px. */
export const FLAME_RANGE = 300;
/** Half of the flame cone's opening angle, in radians (8 degrees). */
export const FLAME_HALF_ANGLE = (8 * Math.PI) / 180;

/** How close a bot with a flamethrower walks up to its enemy, in world px (well inside FLAME_RANGE). */
export const BOT_FLAME_PREFERRED_RANGE = 150;

/** A burning fighter keeps burning for this long after the last ignition. */
export const BURN_MS = 5000;
/** Time between burn damage ticks. */
export const BURN_TICK_MS = 500;
/** Damage of one burn tick (armor does not stop it). */
export const BURN_DAMAGE = 1;

/** Time between a fuel tank catching fire and its blast. */
export const TANK_FUSE_MS = 3000;
/** Blast radius of a fuel tank, in world px. */
export const TANK_RADIUS = 170;
/** Blast damage at the centre of a fuel tank explosion. */
export const TANK_DAMAGE = 90;
/** Weapon name in the kill feed for a death caused by a tank blast. */
export const TANK_KILL_NAME = 'Fuel Tank';

/** Extra blood droplets when a tank blast tears its carrier (alive or a corpse) apart; an ordinary death throws 40. */
export const TANK_BLOOD = 60;
export const TANK_BLOOD_COLOR = '#dc2626';

/** Chance that one hit from this weapon sets a fuel tank on fire (rocket and grenade: direct or splash). */
export const TANK_IGNITE_CHANCE: Record<WeaponType, number> = {
    [WeaponType.MACHINE_GUN]: 0.02,
    [WeaponType.SHOTGUN]: 0.01, // per pellet
    [WeaponType.PLASMA_GUN]: 0.05,
    [WeaponType.RAILGUN]: 0.05,
    [WeaponType.CHAINSAW]: 0.02, // per tick
    [WeaponType.FLAMETHROWER]: 0.015, // per tick
    [WeaponType.SMOKE_LAUNCHER]: 0,
    [WeaponType.ROCKET_LAUNCHER]: 0.15,
    [WeaponType.GRENADE_LAUNCHER]: 0.15,
};

/** Chance that a barrel blast or another tank's blast sets a tank on fire. */
export const TANK_BLAST_CHANCE = 0.15;

/** How much the flame stream multiplies its damage against each kind of cover. */
export const FLAME_COVER_MULT: Record<CoverKind, number> = {
    wood: 2,
    glass: 1,
    barrel: 1,
    metal: 0.25,
};
