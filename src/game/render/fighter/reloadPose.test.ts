import { describe, it, expect } from 'vitest';
import { reloadDip } from './reloadPose';
import { solvePose } from './fighterPose';
import { gripPoints } from './weaponGrips';
import { WeaponType } from '../../../types';

const grip = gripPoints(WeaponType.MACHINE_GUN, 55 / 240);
const gunAngle = (reload?: number, state: 'idle' | 'prone' = 'idle') =>
    solvePose({ state, aim: -0.3, t: 0, phase: 0, moveDir: 1, recoil: 0, grip, reload }).gunAngle;

describe('reloadDip', () => {
    it('is 0 without a reload and at both ends, 1 through the middle', () => {
        expect(reloadDip(undefined)).toBe(0);
        expect(reloadDip(0)).toBe(0);
        expect(reloadDip(1)).toBe(0);
        expect(reloadDip(0.25)).toBe(1);
        expect(reloadDip(0.5)).toBe(1);
        expect(reloadDip(0.75)).toBe(1);
    });

    it('rises and falls smoothly', () => {
        expect(reloadDip(0.1)).toBeGreaterThan(0);
        expect(reloadDip(0.1)).toBeLessThan(reloadDip(0.2));
        expect(reloadDip(0.9)).toBeLessThan(reloadDip(0.8));
    });
});

describe('the gun while reloading', () => {
    it('keeps the aim before and after, and points down-forward in the middle', () => {
        expect(gunAngle()).toBeCloseTo(-0.3);
        expect(gunAngle(0)).toBeCloseTo(-0.3);
        expect(gunAngle(1)).toBeCloseTo(-0.3);
        expect(gunAngle(0.5)).toBeGreaterThan(0.8);
    });

    it('barely dips lying down, so the barrel stays out of the deck', () => {
        expect(gunAngle(0.5, 'prone')).toBeLessThan(0.3);
    });
});
