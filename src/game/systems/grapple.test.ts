import { describe, it, expect } from 'vitest';
import { applyGrapplePhysics, applyGrappleRelease } from './grapple';
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
    score: 0, isCrouching: false, isGrounded: false,
    grapple: { active: false, pos: { x: 0, y: 0 }, length: 0 },
    hasFlag: Team.NONE, lastDash: 0, lastProcessedInput: 0,
    ...overrides,
});

describe('grapple pendulum physics', () => {
    it('should constrain player to rope length when overshooting', () => {
        const p = makePlayer({
            pos: { x: 200, y: 300 },
            vel: { x: 5, y: 0 },
            grapple: { active: true, pos: { x: 100, y: 100 }, length: 100 },
        });

        applyGrapplePhysics(p, { wantsReel: false, wantsExtend: false });

        const dist = Math.sqrt((p.pos.x - 100) ** 2 + (p.pos.y - 100) ** 2);
        expect(dist).toBeLessThanOrEqual(101); // within tolerance
    });

    it('should allow free movement when inside rope length', () => {
        const p = makePlayer({
            pos: { x: 120, y: 120 },
            vel: { x: 2, y: 1 },
            grapple: { active: true, pos: { x: 100, y: 100 }, length: 300 },
        });
        const origVelX = p.vel.x;
        const origVelY = p.vel.y;

        applyGrapplePhysics(p, { wantsReel: false, wantsExtend: false });

        expect(p.vel.x).toBe(origVelX);
        expect(p.vel.y).toBe(origVelY);
    });

    it('should shorten rope when reeling in', () => {
        const p = makePlayer({
            pos: { x: 200, y: 200 },
            grapple: { active: true, pos: { x: 100, y: 100 }, length: 200 },
        });

        applyGrapplePhysics(p, { wantsReel: true, wantsExtend: false });

        expect(p.grapple.length).toBeLessThan(200);
    });

    it('should extend rope when extending', () => {
        const p = makePlayer({
            pos: { x: 150, y: 150 },
            grapple: { active: true, pos: { x: 100, y: 100 }, length: 100 },
        });

        applyGrapplePhysics(p, { wantsReel: false, wantsExtend: true });

        expect(p.grapple.length).toBeGreaterThan(100);
    });

    it('should not shorten below HOOK_MIN_LENGTH', () => {
        const p = makePlayer({
            pos: { x: 110, y: 110 },
            grapple: { active: true, pos: { x: 100, y: 100 }, length: 42 },
        });

        applyGrapplePhysics(p, { wantsReel: true, wantsExtend: false });

        expect(p.grapple.length).toBeGreaterThanOrEqual(40);
    });

    it('should boost velocity on release', () => {
        const p = makePlayer({ vel: { x: 3, y: -2 } });
        const origSpeed = Math.sqrt(p.vel.x ** 2 + p.vel.y ** 2);

        applyGrappleRelease(p);

        const newSpeed = Math.sqrt(p.vel.x ** 2 + p.vel.y ** 2);
        expect(newSpeed).toBeGreaterThan(origSpeed);
    });
});
