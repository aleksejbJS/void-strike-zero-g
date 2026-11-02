import { describe, expect, it } from 'vitest';
import { Graphics, Sprite } from 'pixi.js';
import { WeaponType } from '../../../types';
import { drawMuzzle } from './muzzleFlash';
import { flashStrength, hasMuzzleFlash, isBigFlash } from './muzzleEnvelope';

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

describe('hasMuzzleFlash', () => {
    it('gives the chainsaw no flash', () => {
        expect(hasMuzzleFlash(WeaponType.CHAINSAW)).toBe(false);
    });

    it('flashes for the machine gun and every other firearm', () => {
        for (const w of [WeaponType.MACHINE_GUN, WeaponType.PLASMA_GUN, WeaponType.GRENADE_LAUNCHER, WeaponType.SHOTGUN, WeaponType.ROCKET_LAUNCHER, WeaponType.RAILGUN]) {
            expect(hasMuzzleFlash(w)).toBe(true);
        }
    });
});

describe('drawMuzzle', () => {
    const draw = (weapon: WeaponType) => {
        const front = new Graphics(), light = new Sprite();
        drawMuzzle(front, light, { x: 10, y: 0 }, 0, 1, weapon);
        return { front, light };
    };

    it('draws the star, core and light for the machine gun', () => {
        const { front, light } = draw(WeaponType.MACHINE_GUN);
        expect(front.context.instructions.length).toBeGreaterThan(0);
        expect(light.visible).toBe(true);
    });

    it('draws nothing for the chainsaw even at full strength', () => {
        const { front, light } = draw(WeaponType.CHAINSAW);
        expect(front.context.instructions).toHaveLength(0);
        expect(light.visible).toBe(false);
    });
});
