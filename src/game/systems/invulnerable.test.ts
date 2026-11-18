import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameMode, Team, WeaponType, Entity } from '../../types';
import { createMockState, createMockPlayer } from '../../test/mocks';
import { applyDamage } from './combat';
import { TANK_FUSE_MS } from './flameConstants';

const NOW = 1_000_000;
const PUSH = { x: 1, y: 0 };
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW); });
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

const fighter = (invulnerable: boolean, weapon = WeaponType.MACHINE_GUN): Entity =>
    Object.assign(createMockPlayer('target', Team.NONE, weapon), { invulnerable, armor: 50, isGrounded: true });

const hit = (target: Entity, amount: number, weapon: WeaponType) => {
    const state = createMockState(GameMode.DEATHMATCH);
    state.players.push(target);
    applyDamage(state, target, 'shooter', amount, PUSH, 5, { weapon, direct: true });
    return state;
};

describe('an invulnerable fighter', () => {
    it('keeps health and armour under a 9999 hit, is not dead, and still takes the knockback', () => {
        const target = fighter(true);
        hit(target, 9999, WeaponType.ROCKET_LAUNCHER);
        expect(target.health).toBe(100);
        expect(target.armor).toBe(50);
        expect(target.dead).toBe(false);
        expect(target.vel.x).toBeGreaterThan(0);
    });

    it('is not wounded by a railgun beam through its armour, and still takes the knockback', () => {
        const target = fighter(true);
        hit(target, 100, WeaponType.RAILGUN);
        expect(target.health).toBe(100);
        expect(target.armor).toBe(50);
        expect(target.wound).toBeUndefined();
        expect(target.dead).toBe(false);
        expect(target.vel.x).toBeGreaterThan(0);
    });

    it('never has its fuel tank lit by a hit', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0); // every ignition roll succeeds
        const target = fighter(true, WeaponType.FLAMETHROWER);
        hit(target, 10, WeaponType.PLASMA_GUN); // not lethal: a dead carrier drops its tank
        expect(target.tankFuseAt).toBeUndefined();
        expect(target.burnUntil).toBeUndefined();
    });

    it('takes knockback only from the same hit that hurts an ordinary fighter', () => {
        const hurt = fighter(false);
        const safe = fighter(true);
        hit(hurt, 5, WeaponType.MACHINE_GUN);
        hit(safe, 5, WeaponType.MACHINE_GUN);
        expect(safe.vel).toEqual(hurt.vel);
    });
});

describe('an ordinary fighter (regression)', () => {
    it('still dies to a 9999 hit', () => {
        const target = fighter(false);
        hit(target, 9999, WeaponType.ROCKET_LAUNCHER);
        expect(target.dead).toBe(true);
        expect(target.health).toBeLessThanOrEqual(0);
    });

    it('is still wounded by a railgun beam through its armour', () => {
        const target = fighter(false);
        hit(target, 100, WeaponType.RAILGUN);
        expect(target.wound).toEqual({ by: 'shooter' });
        expect(target.armor).toBe(0);
        expect(target.dead).toBe(false);
    });

    it('still takes damage and knockback from a plain hit', () => {
        const target = fighter(false);
        hit(target, 10, WeaponType.MACHINE_GUN);
        expect(target.health).toBeLessThan(100);
        expect(target.armor).toBeLessThan(50);
        expect(target.vel.x).toBeGreaterThan(0);
    });

    it('still has its fuel tank lit by a hit that rolls an ignition', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0);
        const target = fighter(false, WeaponType.FLAMETHROWER);
        hit(target, 10, WeaponType.PLASMA_GUN);
        expect(target.tankFuseAt).toBe(NOW + TANK_FUSE_MS);
    });
});
