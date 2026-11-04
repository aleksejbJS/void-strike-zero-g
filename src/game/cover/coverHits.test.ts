import { describe, it, expect } from 'vitest';
import { Team, WeaponType } from '../../types';
import { createMockPlayer } from '../../test/mocks';
import { fireWeapon } from '../systems/combat';
import { isIntact } from './coverGeometry';
import { COVER_SPECS, CoverKind } from './coverTypes';
import { piece, stateWithCover, tick } from './coverTestKit';

const KINDS: CoverKind[] = ['wood', 'metal', 'glass', 'barrel'];
const MUZZLE = { x: 0, y: -50 }; // a standing fighter at (0, 0) fires from 50 px up

/**
 * Fire at a fresh piece of cover until it breaks, one shot (or saw tick) at a time, and say how many it took.
 * Point blank: the face is 30 px ahead of the muzzle and the piece is centred on it, so all six pellets land.
 */
const shotsToBreak = (weapon: WeaponType, kind: CoverKind): number => {
    const { w, h } = COVER_SPECS[kind];
    const cover = piece('c1', kind, MUZZLE.x + 30 + w / 2, MUZZLE.y + h / 2);
    const state = stateWithCover(cover);
    const shooter = createMockPlayer('shooter', Team.NONE, weapon); // not in the state: only the cover matters here
    for (let shots = 1; shots <= 200; shots++) {
        shooter.pos = { x: 0, y: 0 };
        shooter.weapon.ammo = 999;
        fireWeapon(state, shooter, { x: cover.pos.x, y: MUZZLE.y });
        for (let i = 0; i < 20 && state.projectiles.length > 0; i++) tick(state);
        if (!isIntact(cover)) return shots;
    }
    return Infinity;
};

describe('shots to break match the mockup', () => {
    //                          wood metal glass barrel
    const TABLE: [string, WeaponType, number[]][] = [
        ['machine gun', WeaponType.MACHINE_GUN, [25, 84, 10, 14]],
        ['shotgun (6 pellets)', WeaponType.SHOTGUN, [5, 17, 2, 3]],
        ['plasma gun', WeaponType.PLASMA_GUN, [11, 36, 5, 6]],
        ['rocket launcher', WeaponType.ROCKET_LAUNCHER, [1, 3, 1, 1]],
        ['grenade launcher', WeaponType.GRENADE_LAUNCHER, [1, 3, 1, 1]],
        ['railgun', WeaponType.RAILGUN, [1, 3, 1, 1]],
        ['chainsaw ticks', WeaponType.CHAINSAW, [5, 17, 2, 3]],
    ];

    it.each(TABLE)('%s', (_name, weapon, counts) => {
        expect(KINDS.map(kind => shotsToBreak(weapon, kind))).toEqual(counts);
    });

    it('the smoke launcher never breaks anything', () => {
        for (const kind of KINDS) {
            const { w, h } = COVER_SPECS[kind];
            const cover = piece('c1', kind, MUZZLE.x + 30 + w / 2, MUZZLE.y + h / 2);
            const state = stateWithCover(cover);
            const shooter = createMockPlayer('shooter', Team.NONE, WeaponType.SMOKE_LAUNCHER);
            for (let i = 0; i < 40; i++) {
                shooter.pos = { x: 0, y: 0 };
                shooter.weapon.ammo = 999;
                fireWeapon(state, shooter, { x: cover.pos.x, y: MUZZLE.y });
                for (let t = 0; t < 5; t++) tick(state);
            }
            expect(cover.hp).toBe(COVER_SPECS[kind].hp);
        }
    });
});
