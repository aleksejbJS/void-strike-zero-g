import { ITEMS_DATA } from '../../../constants';
import { ItemType, Pickup, WeaponType } from '../../../types';
import type { CoverEntry } from '../../cover/coverLayouts';
import { mapPoint } from './layout';

const weaponSpots: ReadonlyArray<[WeaponType, number, number]> = [
    [WeaponType.SHOTGUN, 291, 491],
    [WeaponType.SHOTGUN, 1510, 501],
    [WeaponType.CHAINSAW, 346, 765],
    [WeaponType.FLAMETHROWER, 1360, 738],
    [WeaponType.PLASMA_GUN, 465, 464],
    [WeaponType.ROCKET_LAUNCHER, 1396, 215],
    [WeaponType.GRENADE_LAUNCHER, 473, 246],
    [WeaponType.SMOKE_LAUNCHER, 786, 455],
    [WeaponType.RAILGUN, 1066, 364],
];

type Supply = ItemType.ARMOR | ItemType.HEALTH | ItemType.AMMO | ItemType.FUEL;
const supplies: ReadonlyArray<[Supply, number, number]> = [
    [ItemType.ARMOR, 652, 780],
    [ItemType.HEALTH, 73, 491], [ItemType.HEALTH, 984, 515],
    [ItemType.HEALTH, 1611, 755], [ItemType.HEALTH, 1707, 432],
    [ItemType.FUEL, 283, 246], [ItemType.FUEL, 272, 765],
    [ItemType.FUEL, 1274, 738], [ItemType.FUEL, 1506, 164],
    [ItemType.AMMO, 1142, 780], [ItemType.AMMO, 718, 280],
    [ItemType.AMMO, 1484, 501],
];

export const lastStopPickups = (): Pickup[] => [
    ...weaponSpots.map(([subtype, x, y], i) => ({
        id: `last_stop_weapon_${i}`, type: ItemType.WEAPON, subtype,
        pos: mapPoint(x, y - 14), value: 0, active: true, respawnTime: 0,
    })),
    ...supplies.map(([type, x, y], i) => ({
        id: `last_stop_supply_${i}`, type,
        pos: mapPoint(x, y - 14), value: ITEMS_DATA[type].value, active: true, respawnTime: 0,
    })),
];

const coverSpots: ReadonlyArray<[CoverEntry[0], number, number]> = [
    ['barrel', 719, 521],
    ['wood', 1006, 515], ['metal', 1225, 329], ['glass', 1464, 501],
    ['wood', 1525, 501], ['barrel', 1298, 738], ['metal', 293, 765],
];
export const LAST_STOP_COVER: CoverEntry[] = [
    ...coverSpots.map(([kind, x, y]): CoverEntry => {
        const pos = mapPoint(x, y);
        return [kind, pos.x, pos.y];
    }),
    ['fuel-pump', 902, 1133], ['fuel-pump', 1033, 1133],
];
