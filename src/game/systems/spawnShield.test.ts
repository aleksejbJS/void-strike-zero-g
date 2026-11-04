import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameMode, Team, WeaponType, Entity } from '../../types';
import { createMockState, createMockPlayer } from '../../test/mocks';
import { makeState, makeBot } from '../../test/botFixtures';
import { applyDamage, fireWeapon } from './combat';
import { updatePhysics } from './physics';
import { SPAWN_SHIELD_MS, spawnShieldLeft } from './spawnShield';
import { clearBotMemory, getBotMemory } from './botMemory';
import { aimAndFire } from './botAim';
import { senseTarget } from './botSenses';
import { toLocalClock } from '../net/clock';
import { Snapshot } from '../net/protocol';

const NOW = 1_000_000;
const NO_PUSH = { x: 0, y: 0 };
const SPAWN = { x: 500, y: 0 };

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); clearBotMemory(); });
afterEach(() => { vi.useRealTimers(); });

const tick = (state: ReturnType<typeof createMockState>) =>
    updatePhysics(state, {}, { x: 0, y: 0 }, false, false, 800, 600, () => ({ ...SPAWN }), 'nobody');

/** A fighter whose respawn timer just ran out: the next physics tick brings it back. */
const deadFighter = (state: ReturnType<typeof createMockState>): Entity => {
    const p = Object.assign(createMockPlayer('v', Team.NONE), { dead: true, respawnTimer: NOW - 1 });
    state.players.push(p);
    return p;
};

const shielded = (): Entity =>
    Object.assign(createMockPlayer('v', Team.NONE), { spawnShieldUntil: NOW + SPAWN_SHIELD_MS });

describe('spawn shield', () => {
    it('is granted for 2 seconds when a dead fighter respawns', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const p = deadFighter(state);
        tick(state);
        expect(p.dead).toBe(false);
        expect(SPAWN_SHIELD_MS).toBe(2000);
        expect(spawnShieldLeft(p, NOW)).toBe(SPAWN_SHIELD_MS);
        expect(spawnShieldLeft(p, NOW + SPAWN_SHIELD_MS)).toBe(0);
    });

    it('is not granted to a fighter that has never died (match start)', () => {
        expect(spawnShieldLeft(createMockPlayer('v', Team.NONE), NOW)).toBe(0);
    });

    it('blocks damage, knockback and the railgun wound', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const p = Object.assign(shielded(), { armor: 50 });
        state.players.push(p);
        applyDamage(state, p, 's', 60, { x: 1, y: 0 }, 5, { weapon: WeaponType.ROCKET_LAUNCHER, direct: true });
        applyDamage(state, p, 's', 100, { x: 1, y: 0 }, 5, { weapon: WeaponType.RAILGUN, direct: true });
        expect(p.health).toBe(100);
        expect(p.armor).toBe(50);
        expect(p.vel).toEqual({ x: 0, y: 0 });
        expect(p.wound).toBeUndefined();
    });

    it('does not save a fighter falling out of the map', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const p = shielded();
        state.players.push(p);
        applyDamage(state, p, '', 9999, NO_PUSH);
        expect(p.dead).toBe(true);
    });

    it('ends when the time is up', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const p = shielded();
        state.players.push(p);
        vi.setSystemTime(NOW + SPAWN_SHIELD_MS + 1);
        applyDamage(state, p, 's', 10, NO_PUSH, 0);
        expect(p.health).toBe(90);
    });

    it('ends the moment its holder fires', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const p = shielded();
        state.players.push(p);
        fireWeapon(state, p, { x: 300, y: -30 });
        expect(spawnShieldLeft(p, NOW)).toBe(0);
        applyDamage(state, p, 's', 10, NO_PUSH, 0);
        expect(p.health).toBe(90);
    });

    it('survives an empty trigger pull (no ammo, no shot)', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const p = shielded();
        p.weapon.ammo = 0;
        state.players.push(p);
        fireWeapon(state, p, { x: 300, y: -30 });
        expect(spawnShieldLeft(p, NOW)).toBe(SPAWN_SHIELD_MS);
    });
});

describe('bots and the spawn shield', () => {
    it('hold fire until the target\'s shield is over', () => {
        const state = makeState();
        const bot = makeBot('bot1', Team.RED, 0, 0) as Entity;
        const enemy = Object.assign(makeBot('enemy', Team.BLUE, 300, 0), { spawnShieldUntil: NOW + SPAWN_SHIELD_MS }) as Entity;
        state.players = [bot, enemy];
        const mem = getBotMemory(bot);
        const shots: unknown[] = [];
        aimAndFire(state, bot, enemy, mem, NOW, (_b, t) => shots.push(t));
        expect(shots).toHaveLength(0);
        expect(mem.fireAllowedAt).toBeGreaterThan(NOW); // the reaction time runs meanwhile
    });

    it('answer soon after a shielded target fires (the wait is not tied to the planned end)', () => {
        const state = makeState();
        const bot = makeBot('bot1', Team.RED, 0, 0) as Entity;
        const enemy = Object.assign(makeBot('enemy', Team.BLUE, 300, 0), { spawnShieldUntil: NOW + SPAWN_SHIELD_MS }) as Entity;
        state.players = [bot, enemy];
        const mem = getBotMemory(bot);
        aimAndFire(state, bot, enemy, mem, NOW, () => {});
        expect(mem.fireAllowedAt).toBeLessThan(NOW + SPAWN_SHIELD_MS);
    });
});

describe('bot target choice', () => {
    it('prefers a visible enemy that can be hurt over a nearer shielded one', () => {
        const state = makeState();
        const bot = makeBot('bot1', Team.RED, 0, 0) as Entity;
        const near = Object.assign(makeBot('near', Team.BLUE, 200, 0), { spawnShieldUntil: NOW + SPAWN_SHIELD_MS }) as Entity;
        const far = makeBot('far', Team.BLUE, 400, 0) as Entity;
        state.players = [bot, near, far];
        expect(senseTarget(state, bot, getBotMemory(bot), NOW)?.id).toBe('far');
    });

    it('still faces a shielded enemy when it is the only one', () => {
        const state = makeState();
        const bot = makeBot('bot1', Team.RED, 0, 0) as Entity;
        const near = Object.assign(makeBot('near', Team.BLUE, 200, 0), { spawnShieldUntil: NOW + SPAWN_SHIELD_MS }) as Entity;
        state.players = [bot, near];
        expect(senseTarget(state, bot, getBotMemory(bot), NOW)?.id).toBe('near');
    });
});

describe('spawn shield online', () => {
    it('is moved to the local clock like other timestamps', () => {
        const p = Object.assign(createMockPlayer('v', Team.NONE), { spawnShieldUntil: 5000 });
        const snap = { players: [p] } as unknown as Snapshot;
        toLocalClock(snap, 300);
        expect(p.spawnShieldUntil).toBe(5300);
    });
});
