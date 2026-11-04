import { describe, it, expect } from 'vitest';
import { Team, WeaponType } from '../../types';
import { createMockPlayer } from '../../test/mocks';
import { killWeaponName } from './killWeaponName';

describe('killWeaponName', () => {
    const killer = createMockPlayer('k', Team.NONE, WeaponType.SHOTGUN);

    it('names the weapon in hand, or the credited one', () => {
        expect(killWeaponName(killer, undefined, {})).toBe('Shotgun');
        expect(killWeaponName(killer, WeaponType.RAILGUN, {})).toBe('Railgun');
    });

    it('a barrel kill says Barrel whatever the breaker holds, even if the breaker has left', () => {
        expect(killWeaponName(killer, undefined, { barrel: true })).toBe('Barrel');
        expect(killWeaponName(undefined, undefined, { barrel: true })).toBe('Barrel');
    });

    it('no killer in the match says Environment', () => {
        expect(killWeaponName(undefined, undefined, {})).toBe('Environment');
    });
});
