import { describe, it, expect } from 'vitest';
import { GameMode, Team, WeaponType } from '../../types';
import { createMockState, createMockPlayer } from '../../test/mocks';
import { fireWeapon, createExplosion } from './combat';

describe('Railgun', () => {
    it('is blocked by a wall between shooter and target', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const shooter = createMockPlayer('shooter', Team.NONE, WeaponType.RAILGUN);
        const target = createMockPlayer('target', Team.NONE);
        shooter.pos = { x: 0, y: 100 };
        target.pos = { x: 400, y: 100 };
        // Tall wall whose top-left corner is far from the shooter
        state.platforms.push({ id: 'wall', x: 200, y: -2000, w: 20, h: 4000, color: '#000' });
        state.players.push(shooter, target);

        fireWeapon(state, shooter, { x: 400, y: 50 });

        expect(target.health).toBe(100);
        expect(state.beams![0].end.x).toBeCloseTo(200, 0);
    });

    it('hits a target in the open', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const shooter = createMockPlayer('shooter', Team.NONE, WeaponType.RAILGUN);
        const target = createMockPlayer('target', Team.NONE);
        shooter.pos = { x: 0, y: 100 };
        target.pos = { x: 400, y: 100 };
        state.players.push(shooter, target);

        fireWeapon(state, shooter, { x: 400, y: 50 });

        expect(target.health).toBeLessThan(100);
    });

    it('does not hurt teammates', () => {
        const state = createMockState(GameMode.CTF);
        const shooter = createMockPlayer('shooter', Team.BLUE, WeaponType.RAILGUN);
        const mate = createMockPlayer('mate', Team.BLUE);
        shooter.pos = { x: 0, y: 100 };
        mate.pos = { x: 400, y: 100 };
        state.players.push(shooter, mate);

        fireWeapon(state, shooter, { x: 400, y: 50 });

        expect(mate.health).toBe(100);
    });
});

describe('Friendly fire', () => {
    it('chainsaw does not hurt teammates', () => {
        const state = createMockState(GameMode.CTF);
        const shooter = createMockPlayer('shooter', Team.BLUE, WeaponType.CHAINSAW);
        const mate = createMockPlayer('mate', Team.BLUE);
        shooter.pos = { x: 0, y: 100 };
        mate.pos = { x: 70, y: 100 };
        state.players.push(shooter, mate);

        fireWeapon(state, shooter, { x: 200, y: 50 });

        expect(mate.health).toBe(100);
    });

    it('explosions skip teammates but still hit enemies and the owner', () => {
        const state = createMockState(GameMode.CTF);
        const owner = createMockPlayer('owner', Team.BLUE);
        const mate = createMockPlayer('mate', Team.BLUE);
        const enemy = createMockPlayer('enemy', Team.RED);
        owner.pos = { x: 0, y: 100 };
        mate.pos = { x: 50, y: 100 };
        enemy.pos = { x: -50, y: 100 };
        state.players.push(owner, mate, enemy);

        createExplosion(state, { x: 0, y: 100 }, owner.id, 150, WeaponType.ROCKET_LAUNCHER);

        expect(mate.health).toBe(100);
        expect(enemy.health).toBeLessThan(100);
        expect(owner.health).toBeLessThan(100);
    });
});

describe('Suicide', () => {
    it('does not award score for killing yourself', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const p = createMockPlayer('p1', Team.NONE);
        p.pos = { x: 0, y: 100 };
        p.health = 1;
        state.players.push(p);

        createExplosion(state, { x: 0, y: 100 }, p.id, 150, WeaponType.ROCKET_LAUNCHER);

        expect(p.dead).toBe(true);
        expect(p.score).toBe(0);
    });

    it('does not advance Gun Game progress', () => {
        const state = createMockState(GameMode.GUN_GAME);
        const p = createMockPlayer('p1', Team.NONE);
        p.pos = { x: 0, y: 100 };
        p.health = 1;
        p.gunLevel = 2;
        state.players.push(p);

        createExplosion(state, { x: 0, y: 100 }, p.id, 150, WeaponType.ROCKET_LAUNCHER);

        expect(p.gunLevel).toBe(1);
        expect(p.gunProgress).toBe(0);
    });
});
