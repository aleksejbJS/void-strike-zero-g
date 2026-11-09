// What the kill feed names as the weapon of a kill, and which weapon's achievements the kill counts for

import { WeaponType } from '../../types';
import type { Entity } from '../../types';
import { WEAPONS_DATA } from '../../constants';
import { BARREL_KILL_NAME } from '../cover/coverTypes';
import { isHazardBlast, type DamageSource } from './deathKind';
import { TANK_KILL_NAME } from './flameConstants';

/** A barrel kill says Barrel, a tank blast Fuel Tank, a burn death Flamethrower, a kill with no killer in the match says Environment, otherwise the credited weapon or the one in hand. */
export const killWeaponName = (killer: Entity | undefined, creditWeapon: WeaponType | undefined, source: DamageSource): string => {
    if (source.barrel) return BARREL_KILL_NAME;
    if (source.tank) return TANK_KILL_NAME; // credited even if the igniter has left
    if (source.burn) return WEAPONS_DATA[WeaponType.FLAMETHROWER].name; // credited even if the arsonist has left
    if (!killer) return 'Environment';
    return creditWeapon ? WEAPONS_DATA[creditWeapon].name : killer.weapon.name;
};

/** The weapon a kill counts for in the achievements: none for a barrel or tank, the flamethrower for a burn death
 *  (whatever the arsonist holds now), otherwise the credited weapon or the one in hand. */
export const killAchievementWeapon = (killer: Entity, creditWeapon: WeaponType | undefined, source: DamageSource): WeaponType | undefined => {
    if (isHazardBlast(source)) return undefined;
    if (source.burn) return WeaponType.FLAMETHROWER;
    return creditWeapon ?? killer.weapon.type;
};
