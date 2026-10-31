import { describe, it, expect } from 'vitest';
import { GameMode, Team, WeaponType, ItemType } from '../../types';
import { PROJECTILE_MAX_LIFE } from '../../constants';
import { createMockState, createMockPlayer } from '../../test/mocks';
import { updatePhysics } from './physics';
import { fireWeapon } from './combat';

const spawn = () => ({ x: 0, y: 0 });
const tick = (state: ReturnType<typeof createMockState>, keys: Record<string, boolean> = {}, hook = false) =>
    updatePhysics(state, keys, { x: 0, y: 0 }, hook, false, 800, 600, spawn, 'p1');

describe('Projectiles', () => {
    it('expire after PROJECTILE_MAX_LIFE ticks when they hit nothing', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const p = createMockPlayer('p1', Team.NONE);
        state.players.push(p);
        fireWeapon(state, p, { x: 0, y: -1000 });
        expect(state.projectiles.length).toBe(1);

        for (let i = 0; i <= PROJECTILE_MAX_LIFE; i++) tick(state);

        expect(state.projectiles.length).toBe(0);
    });
});

describe('Hunger Games zone', () => {
    it('shrinks when the timer runs out, without waiting for another death', () => {
        const state = createMockState(GameMode.HUNGER_GAMES);
        state.hungerZone = { x: -2000, y: -2000, w: 4000, h: 4000, pendingShrink: true, nextShrinkAt: Date.now() - 1, pendingCount: 1 };

        tick(state);

        expect(state.hungerZone.w).toBe(3500);
        expect(state.hungerZone.pendingShrink).toBe(false);
    });
});

describe('Respawn', () => {
    it('resets the fuel-tank bonus', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const p = createMockPlayer('p1', Team.NONE);
        p.dead = true;
        p.respawnTimer = 0;
        p.maxFuel = 150;
        state.players.push(p);

        tick(state);

        expect(p.dead).toBe(false);
        expect(p.maxFuel).toBe(100);
    });
});

describe('Team balance', () => {
    it.each([GameMode.CTF, GameMode.HOLD_THE_FLAG])('respawning in unbalanced %s gives no free points', mode => {
        const state = createMockState(mode);
        const dead = createMockPlayer('p1', Team.BLUE);
        dead.dead = true;
        dead.respawnTimer = 0;
        state.players.push(dead, createMockPlayer('r1', Team.RED), createMockPlayer('r2', Team.RED), createMockPlayer('r3', Team.RED));

        tick(state);

        expect(dead.dead).toBe(false);
        expect(state.scores[Team.BLUE]).toBe(0);
        expect(state.scores[Team.RED]).toBe(0);
    });
});

describe('Grapple', () => {
    it('reels in even with an empty jetpack', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const p = createMockPlayer('p1', Team.NONE);
        p.jetpackFuel = 0;
        p.pos = { x: 0, y: 0 };
        p.grapple = { active: true, pos: { x: 0, y: -200 }, length: 200 };
        state.players.push(p);

        tick(state, { KeyW: true }, true);

        expect(p.grapple.length).toBeLessThan(200);
    });
});

describe('Weapon pickup', () => {
    it('does not overfill ammo beyond maxAmmo', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const p = createMockPlayer('p1', Team.NONE);
        p.pos = { x: 0, y: 0 };
        p.isGrounded = true;
        p.inventory = [{ ...p.weapon }];
        p.weapon = p.inventory[0];
        state.players.push(p);
        state.pickups.push({
            id: 'w1', type: ItemType.WEAPON, subtype: WeaponType.MACHINE_GUN,
            pos: { x: 0, y: 0 }, active: true, respawnTime: 0, value: 0,
        });

        tick(state);

        expect(p.inventory[0].ammo).toBeLessThanOrEqual(p.inventory[0].maxAmmo);
    });
});
