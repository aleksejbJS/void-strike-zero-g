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

    it('should apply ground contact velocity when grounded', () => {
        const p = makePlayer({ isGrounded: true, vel: { x: 0, y: 0 } });
        applyMovement(p, noInput);
        expect(p.vel.y).toBe(0.1); // maintains platform contact (Matter gravity=0)
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

    it('should recharge fuel on ground but not in free flight', () => {
        const p = makePlayer({ isGrounded: true, jetpackFuel: 50 });
        applyMovement(p, noInput);
        expect(p.jetpackFuel).toBeGreaterThan(50);

        const p2 = makePlayer({ isGrounded: false, jetpackFuel: 50 });
        applyMovement(p2, noInput);
        expect(p2.jetpackFuel).toBe(50);
    });

    it('should recharge fuel at the ground rate while hanging on the grapple', () => {
        const grapple = { active: true, pos: { x: 100, y: 100 }, length: 200 };
        const hanging = makePlayer({ isGrounded: false, jetpackFuel: 50, grapple });
        const grounded = makePlayer({ isGrounded: true, jetpackFuel: 50 });
        applyMovement(hanging, noInput);
        applyMovement(grounded, noInput);
        expect(hanging.jetpackFuel).toBeGreaterThan(50);
        expect(hanging.jetpackFuel).toBe(grounded.jetpackFuel);
    });

    it('on the hook W only reels: no thrust, no flame, fuel refills', () => {
        const grapple = { active: true, pos: { x: 100, y: 100 }, length: 200 };
        const hooked = makePlayer({ isGrounded: false, jetpackFuel: 50, grapple: { ...grapple } });
        const idle = makePlayer({ isGrounded: false, jetpackFuel: 50, grapple: { ...grapple } });
        const reel = { ...noInput, isFlying: true, wantsJump: true, wantsReel: true };
        applyMovement(hooked, reel);
        applyMovement(idle, { ...noInput, wantsReel: true });
        expect(hooked.jetpackOn).toBe(false);
        expect(hooked.jetpackFuel).toBeGreaterThan(50);
        expect(hooked.vel.y).toBeCloseTo(idle.vel.y, 10); // reel only, no jetpack thrust on top
        expect(hooked.grapple.length).toBeLessThan(200); // reeled in
    });

    it('the jetpack works again once the hook is released', () => {
        const p = makePlayer({ isGrounded: false, jetpackFuel: 50, grapple: { active: true, pos: { x: 100, y: 100 }, length: 200 } });
        const fly = { ...noInput, isFlying: true, wantsJump: true };
        applyMovement(p, { ...fly, wantsReel: true });
        p.grapple.active = false;
        p.vel = { x: 0, y: 2 };
        const fuel = p.jetpackFuel;
        applyMovement(p, fly);
        expect(p.jetpackOn).toBe(true);
        expect(p.vel.y).toBeLessThan(2);
        expect(p.jetpackFuel).toBeLessThan(fuel);
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

    it('wounded fighter hops at crawl speed', () => {
        const wounded = makePlayer({ isGrounded: true, wound: { by: 'railgun' } });
        const prone = makePlayer({ isGrounded: true, isProne: true });
        for (let i = 0; i < 200; i++) {
            applyMovement(wounded, { ...noInput, inputX: 1 });
            applyMovement(prone, { ...noInput, inputX: 1 });
        }
        expect(wounded.vel.x).toBeCloseTo(prone.vel.x, 10);
    });

    it('wounded fighter still flies', () => {
        const wounded = makePlayer({ isGrounded: false, wound: { by: 'railgun' } });
        const healthy = makePlayer({ isGrounded: false });
        const flyInput = { ...noInput, isFlying: true, wantsJump: true };
        applyMovement(wounded, flyInput);
        applyMovement(healthy, flyInput);
        expect(wounded.vel.y).toBeLessThan(0);
        expect(wounded.vel.y).toBeCloseTo(healthy.vel.y, 10);
    });
});
