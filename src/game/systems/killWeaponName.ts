// What the kill feed names as the weapon of a kill

import { WeaponType } from '../../types';
import type { Entity } from '../../types';
import { WEAPONS_DATA } from '../../constants';
import { BARREL_KILL_NAME } from '../cover/coverTypes';
import type { DamageSource } from './deathKind';

/** A barrel kill says Barrel, a burn death Flamethrower, a kill with no killer in the match says Environment, otherwise the credited weapon or the one in hand. */
export const killWeaponName = (killer: Entity | undefined, creditWeapon: WeaponType | undefined, source: DamageSource): string => {
    if (source.barrel) return BARREL_KILL_NAME;
    if (source.burn) return WEAPONS_DATA[WeaponType.FLAMETHROWER].name; // credited even if the arsonist has left
    if (!killer) return 'Environment';
    return creditWeapon ? WEAPONS_DATA[creditWeapon].name : killer.weapon.name;
};
