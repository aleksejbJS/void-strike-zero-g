import { describe, it, expect } from 'vitest';
import { Projectile, WeaponType } from '../../types';
import { PROJECTILE_MAX_LIFE, ROCKET_MOTOR_TICKS } from '../../constants';
import { moveProjectile } from './physics';

const rocket = (): Projectile => ({
    id: 'r1', ownerId: 'p1', type: WeaponType.ROCKET_LAUNCHER, radius: 4, active: true,
    pos: { x: 0, y: 0 }, vel: { x: 12, y: 0 }, life: PROJECTILE_MAX_LIFE,
});

// Same per-tick order as updatePhysics: move, then one tick of life is gone
const fly = (proj: Projectile, ticks: number) => {
    for (let i = 0; i < ticks; i++) {
        moveProjectile(proj);
        proj.life = (proj.life ?? PROJECTILE_MAX_LIFE) - 1;
    }
};

describe('rocket flight', () => {
    it('flies straight while the motor burns', () => {
        const proj = rocket();
        fly(proj, ROCKET_MOTOR_TICKS);
        expect(proj.pos.y).toBe(0);
        expect(proj.vel.y).toBe(0);
        expect(proj.pos.x).toBe(12 * ROCKET_MOTOR_TICKS);
    });

    it('starts to drop once the motor is out', () => {
        const proj = rocket();
        fly(proj, ROCKET_MOTOR_TICKS + 10);
        expect(proj.vel.y).toBeCloseTo(1);
        expect(proj.pos.y).toBeGreaterThan(0);
    });
});
