import { describe, it, expect } from 'vitest';
import { applyMovement, MovementInput } from './movement';
import { Entity, Team, WeaponType } from '../../types';

const makePlayer = (overrides: Partial<Entity> = {}): Entity => ({
    id: 'p1', type: 'player', team: Team.NONE,
    pos: { x: 100, y: 300 }, vel: { x: 0, y: 0 },
    width: 30, height: 72, color: '#fff',
    health: 100, maxHealth: 100, armor: 0, maxArmor: 100,
    jetpackFuel: 100, maxFuel: 100, jetpackColor: '#fff',
    dead: false, respawnTimer: 0, facingRight: true,
    weapon: { type: WeaponType.MACHINE_GUN, name: 'MG', damage: 6, fireRate: 100, speed: 18, color: '#fff', ammo: 99, maxAmmo: 99, recoil: 0, knockbackForce: 0.3 },
    inventory: [], lastFired: 0, skinId: 'classic', name: 'Test',
    score: 0, isCrouching: false, isGrounded: true,
    grapple: { active: false, pos: { x: 0, y: 0 }, length: 0 },
    hasFlag: Team.NONE, lastDash: 0, lastProcessedInput: 0,
    ...overrides,
});

const noInput: MovementInput = {
    inputX: 0,
    isFlying: false,
    wantsJump: false,
    wantsDown: false,
    wantsReel: false,
    wantsExtend: false,
};

describe('Force Pipeline — movement.ts', () => {
    it('should apply gravity when not grounded', () => {
        const p = makePlayer({ isGrounded: false, vel: { x: 0, y: 0 } });
        applyMovement(p, noInput);
        expect(p.vel.y).toBeGreaterThan(0);
    });

    it('should NOT apply gravity when grounded', () => {
        const p = makePlayer({ isGrounded: true, vel: { x: 0, y: 0 } });
        applyMovement(p, noInput);
        expect(p.vel.y).toBe(0);
    });

    it('should accelerate horizontally on ground with input', () => {
        const p = makePlayer({ isGrounded: true });
        applyMovement(p, { ...noInput, inputX: 1 });
        expect(p.vel.x).toBeGreaterThan(0);
    });

    it('should apply air strafe (weaker) when airborne', () => {
        const p = makePlayer({ isGrounded: false });
        applyMovement(p, { ...noInput, inputX: 1 });
        const airVelX = p.vel.x;

        const p2 = makePlayer({ isGrounded: true });
        applyMovement(p2, { ...noInput, inputX: 1 });
        expect(airVelX).toBeLessThan(p2.vel.x);
    });

    it('should apply upward jetpack thrust', () => {
        const p = makePlayer({ isGrounded: false, vel: { x: 0, y: 2 } });
        applyMovement(p, { ...noInput, isFlying: true, wantsJump: true });
        expect(p.vel.y).toBeLessThan(2);
        expect(p.jetpackFuel).toBeLessThan(100);
    });

    it('should apply diagonal jetpack thrust with side input', () => {
        const p = makePlayer({ isGrounded: false, vel: { x: 0, y: 0 } });
        applyMovement(p, { ...noInput, isFlying: true, wantsJump: true, inputX: 1 });
        expect(p.vel.x).toBeGreaterThan(0);
        expect(p.vel.y).toBeLessThan(0);
    });

    it('should recharge fuel only on ground', () => {
        const p = makePlayer({ isGrounded: true, jetpackFuel: 50 });
        applyMovement(p, noInput);
        expect(p.jetpackFuel).toBeGreaterThan(50);

        const p2 = makePlayer({ isGrounded: false, jetpackFuel: 50 });
        applyMovement(p2, noInput);
        expect(p2.jetpackFuel).toBe(50);
    });

    it('should apply ground friction', () => {
        const p = makePlayer({ isGrounded: true, vel: { x: 5, y: 0 } });
        applyMovement(p, noInput);
        expect(Math.abs(p.vel.x)).toBeLessThan(5);
    });

    it('should soft-cap speed above SOFT_SPEED_CAP', () => {
        const p = makePlayer({ vel: { x: 6, y: 0 } });
        applyMovement(p, noInput);
        expect(Math.abs(p.vel.x)).toBeLessThan(6);
    });

    it('should hard-cap speed at HARD_SPEED_CAP', () => {
        const p = makePlayer({ vel: { x: 20, y: 0 } });
        applyMovement(p, noInput);
        expect(Math.abs(p.vel.x)).toBeLessThanOrEqual(8.0);
    });
});
