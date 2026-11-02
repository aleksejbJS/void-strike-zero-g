import { describe, it, expect } from 'vitest';
import { WeaponType } from '../../types';
import { DamageSource, DeathKind, GIB_OVERKILL, SHOTGUN_POINT_BLANK, deathKind } from './deathKind';

const cases: [string, DamageSource, number, DeathKind][] = [
    ['no weapon (zone, fall) falls', {}, 50, 'fall'],
    ['machine gun falls even with huge overkill', { weapon: WeaponType.MACHINE_GUN }, 90, 'fall'],
    ['plasma falls even with huge overkill', { weapon: WeaponType.PLASMA_GUN }, 90, 'fall'],
    ['shotgun at close range throws', { weapon: WeaponType.SHOTGUN, shooterDist: 100 }, 5, 'thrown'],
    ['shotgun far away falls', { weapon: WeaponType.SHOTGUN, shooterDist: 300 }, 5, 'fall'],
    ['shotgun without a distance counts as far', { weapon: WeaponType.SHOTGUN }, 5, 'fall'],
    ['shotgun exactly at the point-blank limit throws', { weapon: WeaponType.SHOTGUN, shooterDist: SHOTGUN_POINT_BLANK }, 5, 'thrown'],
    ['shotgun just past the point-blank limit falls', { weapon: WeaponType.SHOTGUN, shooterDist: SHOTGUN_POINT_BLANK + 1 }, 5, 'fall'],
    ['rocket direct hit gibs', { weapon: WeaponType.ROCKET_LAUNCHER, direct: true }, 1, 'gib'],
    ['rocket blast with big overkill gibs', { weapon: WeaponType.ROCKET_LAUNCHER }, 55, 'gib'],
    ['rocket blast edge throws', { weapon: WeaponType.ROCKET_LAUNCHER }, 1, 'thrown'],
    ['grenade blast with small overkill throws', { weapon: WeaponType.GRENADE_LAUNCHER }, 20, 'thrown'],
    ['grenade blast with big overkill gibs', { weapon: WeaponType.GRENADE_LAUNCHER }, 35, 'gib'],
    ['grenade direct hit gibs', { weapon: WeaponType.GRENADE_LAUNCHER, direct: true }, 0, 'gib'],
    ['overkill just under the gib limit throws', { weapon: WeaponType.ROCKET_LAUNCHER }, GIB_OVERKILL - 1, 'thrown'],
    ['overkill exactly at the gib limit gibs', { weapon: WeaponType.ROCKET_LAUNCHER }, GIB_OVERKILL, 'gib'],
    ['railgun cuts', { weapon: WeaponType.RAILGUN }, 0, 'cut'],
    ['railgun cuts regardless of overkill', { weapon: WeaponType.RAILGUN }, 200, 'cut'],
    ['chainsaw gibs', { weapon: WeaponType.CHAINSAW }, 0, 'gib'],
];

describe('deathKind', () => {
    it.each(cases)('%s', (_name, source, overkill, expected) => {
        expect(deathKind(source, overkill)).toBe(expected);
    });
});
