import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameMode, ItemType, Team, WeaponType } from '../../types';
import { WEAPONS_DATA } from '../../constants';
import { createMockState, createMockPlayer } from '../../test/mocks';
import { buildSnapshot } from '../net/protocol';
import { fireWeapon } from './combat';
import { gameEvents, GameEvent } from './events';
import { updatePhysics } from './physics';
import { insideSmoke, spawnSmoke, SMOKE_DURATION_MS } from './smoke';

let events: GameEvent[] = [];
let unsubscribe: () => void;
beforeEach(() => { events = []; unsubscribe = gameEvents.on(e => events.push(e)); });
afterEach(() => unsubscribe());

const effects = () => events.flatMap(e => (e.type === 'EFFECT' ? [e] : []));
const sounds = () => events.flatMap(e => (e.type === 'SOUND' ? [e.sound] : []));

const tick = (state: ReturnType<typeof createMockState>) =>
    updatePhysics(state, {}, { x: 0, y: 0 }, false, false, 800, 600, () => ({ x: 0, y: 0 }), 'nobody');

const wall = { id: 'wall', x: 200, y: -500, w: 40, h: 1000, color: '#000' };
const smokeRound = (x: number, y: number, vx = 14) =>
    ({ id: 's', ownerId: 'shooter', type: WeaponType.SMOKE_LAUNCHER, pos: { x, y }, vel: { x: vx, y: 0 }, active: true, radius: 4, life: 60 });

describe('Smoke round bursts', () => {
    it('on the near side of a wall, without a blast, sparks or damage', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const bystander = createMockPlayer('bystander', Team.NONE);
        bystander.pos = { x: 170, y: 100 };
        state.platforms.push(wall);
        state.players.push(bystander);
        state.projectiles.push(smokeRound(195, 70));

        tick(state);

        expect(state.projectiles).toHaveLength(0);
        expect(state.smokes).toHaveLength(1);
        expect(state.smokes![0].pos).toEqual({ x: 195, y: 70 }); // where the round was before the wall
        expect(bystander.health).toBe(100);
        expect(effects()).toEqual([]);
        expect(sounds()).not.toContain('explosion');
    });

    it('on a direct hit: 1 damage, no knockback, one cloud, blood but no sparks', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const victim = createMockPlayer('victim', Team.NONE);
        const control = createMockPlayer('control', Team.NONE); // not hit: shows what gravity alone does
        victim.pos = { x: 100, y: 100 };
        control.pos = { x: 500, y: 100 };
        state.players.push(victim, control);
        state.projectiles.push(smokeRound(80, 70));

        tick(state);

        expect(victim.health).toBe(100 - WEAPONS_DATA[WeaponType.SMOKE_LAUNCHER].damage);
        expect(victim.vel).toEqual(control.vel);
        expect(state.projectiles).toHaveLength(0);
        expect(state.smokes).toHaveLength(1);
        expect(effects().map(e => e.effect)).toEqual(['blood']);
    });

    it('in open air once the fuse runs out, not before', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        state.projectiles.push(smokeRound(0, 0));

        for (let i = 0; i < 59; i++) tick(state);
        expect(state.smokes ?? []).toHaveLength(0);
        expect(state.projectiles).toHaveLength(1);

        tick(state);
        expect(state.projectiles).toHaveLength(0);
        expect(state.smokes).toHaveLength(1);
        expect(effects()).toEqual([]); // no blast, no sparks
    });

    it('under the shooter: a round fired straight down puts the shooter in smoke', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const shooter = createMockPlayer('shooter', Team.NONE, WeaponType.SMOKE_LAUNCHER);
        shooter.pos = { x: 100, y: 100 };
        shooter.isGrounded = true;
        state.platforms.push({ id: 'floor', x: 0, y: 100, w: 400, h: 50, color: '#000' });
        state.players.push(shooter);

        fireWeapon(state, shooter, { x: 100, y: 500 });
        for (let i = 0; i < 3; i++) tick(state);

        expect(state.smokes).toHaveLength(1);
        const centre = { x: shooter.pos.x, y: shooter.pos.y - shooter.height / 2 };
        expect(insideSmoke(state, centre, Date.now())).toBe(true);
    });

    it('a launcher round falls like a grenade', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        state.projectiles.push(smokeRound(0, 0));
        tick(state);
        expect(state.projectiles[0].vel.y).toBeCloseTo(0.25);
    });
});

describe('Smoke clouds in the simulation', () => {
    it('a cloud past its end is removed, a live one stays', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const now = Date.now();
        const spent = spawnSmoke(state, { x: 0, y: 0 }, now - SMOKE_DURATION_MS - 1);
        const live = spawnSmoke(state, { x: 50, y: 0 }, now);

        tick(state);

        expect(state.smokes!.map(c => c.id)).toEqual([live.id]);
        expect(state.smokes).not.toContain(spent);
    });

    it('a machine-gun round fired through a cloud still hits the enemy behind it', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const enemy = createMockPlayer('enemy', Team.NONE);
        enemy.pos = { x: 200, y: 100 };
        state.players.push(enemy);
        spawnSmoke(state, { x: 150, y: 70 }, Date.now());
        state.projectiles.push({ id: 'b', ownerId: 'shooter', type: WeaponType.MACHINE_GUN, pos: { x: 140, y: 70 }, vel: { x: 60, y: 0 }, active: true, radius: 4 });

        tick(state);

        expect(enemy.health).toBe(100 - WEAPONS_DATA[WeaponType.MACHINE_GUN].damage);
        expect(state.smokes).toHaveLength(1);
    });

    it('the snapshot carries the clouds', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        spawnSmoke(state, { x: 10, y: 20 }, 1000);

        expect(buildSnapshot(state, 5).smokes).toEqual(state.smokes);
        expect(buildSnapshot(state, 5).smokes).toHaveLength(1);
    });
});

describe('Smoke launcher pickup', () => {
    const setup = (type: 'player' | 'bot') => {
        const state = createMockState(GameMode.DEATHMATCH);
        const fighter = { ...createMockPlayer('f', Team.NONE), type };
        fighter.inventory = [{ ...fighter.weapon }];
        state.players.push(fighter);
        const item = { id: 'w', type: ItemType.WEAPON, subtype: WeaponType.SMOKE_LAUNCHER, pos: { x: 0, y: 0 }, active: true, respawnTime: 0, value: 0 };
        state.pickups.push(item);
        tick(state);
        return { fighter, item };
    };

    it('is left alone by a bot walking over it', () => {
        const { fighter, item } = setup('bot');
        expect(fighter.inventory.map(w => w.type)).not.toContain(WeaponType.SMOKE_LAUNCHER);
        expect(item.active).toBe(true);
    });

    it('is picked up by a human', () => {
        const { fighter, item } = setup('player');
        expect(fighter.inventory.map(w => w.type)).toContain(WeaponType.SMOKE_LAUNCHER);
        expect(item.active).toBe(false);
    });
});
