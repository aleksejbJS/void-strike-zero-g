import { describe, expect, it } from 'vitest';
import { WeaponType } from '../../../types';
import { flashStrength, isBigFlash } from './muzzleEnvelope';

describe('flashStrength', () => {
    it('is full on the shot and fades out linearly', () => {
        expect(flashStrength(0)).toBe(1);
        expect(flashStrength(60)).toBe(0.5);
    });

    it('is gone from 120 ms on', () => {
        expect(flashStrength(120)).toBe(0);
        expect(flashStrength(500)).toBe(0);
    });

    it('is zero before any shot (negative or infinite time since the shot)', () => {
        expect(flashStrength(-5)).toBe(0);
        expect(flashStrength(Infinity)).toBe(0);
    });
});

describe('isBigFlash', () => {
    it('flashes big for shotgun, rocket launcher and railgun', () => {
        for (const w of [WeaponType.SHOTGUN, WeaponType.ROCKET_LAUNCHER, WeaponType.RAILGUN]) expect(isBigFlash(w)).toBe(true);
    });

    it('keeps the small flash for the other weapons', () => {
        for (const w of [WeaponType.MACHINE_GUN, WeaponType.PLASMA_GUN, WeaponType.GRENADE_LAUNCHER, WeaponType.CHAINSAW]) {
            expect(isBigFlash(w)).toBe(false);
        }
    });
});
