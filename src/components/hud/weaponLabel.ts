// Translated weapon name for the HUD (game data and kill messages carry the English name).

import { WEAPONS_DATA } from '../../constants';
import { WeaponType } from '../../types';
import type { Translate } from '../menu/types';
import type { TranslationKeys } from '../../i18n/locales';
import { BARREL_KILL_NAME } from '../../game/cover/coverTypes';

const KEYS: Record<WeaponType, keyof TranslationKeys> = {
    [WeaponType.MACHINE_GUN]: 'weapon.machineGun',
    [WeaponType.SHOTGUN]: 'weapon.shotgun',
    [WeaponType.PLASMA_GUN]: 'weapon.plasmaGun',
    [WeaponType.ROCKET_LAUNCHER]: 'weapon.rocketLauncher',
    [WeaponType.RAILGUN]: 'weapon.railgun',
    [WeaponType.GRENADE_LAUNCHER]: 'weapon.grenadeLauncher',
    [WeaponType.SMOKE_LAUNCHER]: 'weapon.smokeLauncher',
    [WeaponType.CHAINSAW]: 'weapon.chainsaw',
};

const BY_NAME = new Map<string, keyof TranslationKeys>([
    ...Object.values(WEAPONS_DATA).map(w => [w.name, KEYS[w.type]] as const),
    [BARREL_KILL_NAME, 'weapon.barrel'], // a barrel kill in the feed: the barrel is no weapon, so no WeaponType
]);

/** Unknown names (e.g. "Environment") are shown as they are. */
export const weaponLabel = (t: Translate, name: string) => {
    const key = BY_NAME.get(name);
    return key ? t(key) : name;
};
