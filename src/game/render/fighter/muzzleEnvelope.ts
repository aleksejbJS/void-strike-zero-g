// Pure rules of the muzzle flash (no Pixi): how strong it is after a shot and which weapons flash big.

import { WeaponType } from '../../../types';

export const MUZZLE_FLASH_MS = 120;

const BIG_WEAPONS: ReadonlySet<WeaponType> = new Set([WeaponType.SHOTGUN, WeaponType.ROCKET_LAUNCHER, WeaponType.RAILGUN]);

// Melee: `fireWeapon` stamps lastFired on every swing, but there is no muzzle to flash
const NO_FLASH: ReadonlySet<WeaponType> = new Set([WeaponType.CHAINSAW]);

/** Flash strength (0..1) this long after a shot: full on the shot, fading out linearly, gone after 120 ms. */
export const flashStrength = (sinceMs: number): number =>
    sinceMs >= 0 && sinceMs < MUZZLE_FLASH_MS ? 1 - sinceMs / MUZZLE_FLASH_MS : 0;

/** Heavy weapons get a longer star and a wider light. */
export const isBigFlash = (weapon: WeaponType): boolean => BIG_WEAPONS.has(weapon);

/** False for weapons that have no muzzle flash at all (the chainsaw). */
export const hasMuzzleFlash = (weapon: WeaponType): boolean => !NO_FLASH.has(weapon);
