// The test range as GameCanvas runs it: the offline level setup, the Matter step and the range hooks around
// updatePhysics, for 600 fixed steps of the player firing rockets at their own feet.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameMode, MapId, Team, WeaponType } from '../../types';
import type { GameState } from '../../types';
import { createMockPlayer, createMockState } from '../../test/mocks';
import { getPlatforms } from '../data/level';
import { offlineBotCount } from '../data/offlineBots';
import { getCoverLayout } from '../cover/coverLayout';
import { liftOutOfCover } from '../cover/coverSpawn';
import { spawnPointFor } from '../net/roomSetup';
import { MatterPhysicsEngine } from '../physics/MatterEngine';
import { VIEW_HEIGHT, VIEW_WIDTH } from '../render/viewport';
import { gameEvents } from '../systems/events';
import { FIXED_STEP_MS } from '../systems/fixedStep';
import { updatePhysics } from '../systems/physics';
import { RANGE_CAMERA } from './rangeMap';
import { RangeLoop } from './rangeLoop';

const LOCAL = 'player';
const T = 1_000_000;
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(T); });
afterEach(() => { vi.useRealTimers(); gameEvents.clear(); });

/** An offline match as initLevel builds it: platforms, cover, the local fighter, the range or the bots, Matter bodies. */
const buildOffline = (mode: GameMode) => {
    const state: GameState = createMockState(mode);
    state.platforms = getPlatforms(mode, MapId.DEFAULT);
    state.cover = getCoverLayout(mode, MapId.DEFAULT);
    const engine = new MatterPhysicsEngine();
    state.platforms.forEach(p => engine.addPlatform(p));
    const spawn = spawnPointFor(mode);
    const local = Object.assign(createMockPlayer(LOCAL, Team.NONE), { pos: spawn(Team.NONE) });
    state.players.push(local);
    const loop = new RangeLoop();
    const legend = loop.setup(state, LOCAL);
    for (let i = 0; i < offlineBotCount(mode); i++) {
        state.players.push(Object.assign(createMockPlayer(`bot_${i}`, Team.NONE), { type: 'bot' as const, pos: spawn(Team.NONE) }));
    }
    state.players.forEach(p => { liftOutOfCover(state, p); engine.addPlayer(p); });
    return { state, engine, loop, local, legend };
};
type Offline = ReturnType<typeof buildOffline>;

/** One fixed step in GameCanvas's order, the mouse held on the local fighter's feet. */
const step = ({ state, engine, loop, local }: Offline, at: number) => {
    vi.setSystemTime(at);
    engine.step(FIXED_STEP_MS);
    engine.syncGameState(state);
    loop.beforePhysics(state, LOCAL, Date.now());
    const feet = { x: local.pos.x - state.camera.x + VIEW_WIDTH / 2, y: local.pos.y - state.camera.y + VIEW_HEIGHT / 2 };
    updatePhysics(state, {}, feet, false, true, VIEW_WIDTH, VIEW_HEIGHT, spawnPointFor(state.mode), LOCAL);
    loop.afterPhysics(state, Date.now());
    engine.syncFromGameState(state);
};

/** 600 steps of rockets at the fighter's own feet; returns the lowest health seen and the explosions counted. */
const rocketOwnFeet = (fx: Offline) => {
    fx.local.weapon = fx.local.inventory.find(w => w.type === WeaponType.ROCKET_LAUNCHER) ?? fx.local.weapon;
    let explosions = 0;
    const off = gameEvents.on(e => { if (e.type === 'EFFECT' && e.effect === 'explosion') explosions++; });
    let lowest = fx.local.health;
    const cameras: { x: number; y: number }[] = [];
    for (let i = 0; i < 600; i++) {
        step(fx, T + i * FIXED_STEP_MS);
        lowest = Math.min(lowest, fx.local.dead ? 0 : fx.local.health);
        cameras.push({ x: fx.state.camera.x, y: fx.state.camera.y });
    }
    off();
    return { lowest, explosions, cameras };
};

describe('the test range in the offline loop', () => {
    it('keeps the player alive at full health through 600 steps of rockets at their own feet, the camera pinned', () => {
        const fx = buildOffline(GameMode.RANGE);
        const { lowest, explosions, cameras } = rocketOwnFeet(fx);

        expect(explosions).toBeGreaterThanOrEqual(3); // the rockets really went off
        expect(lowest).toBe(100);
        expect(fx.local).toMatchObject({ dead: false, health: 100 });
        cameras.forEach(c => expect(c).toEqual({ x: RANGE_CAMERA.x, y: RANGE_CAMERA.y }));
    });

    it('hurts a fighter that is not invulnerable with the same rockets (the run above is no empty check)', () => {
        const fx = buildOffline(GameMode.RANGE);
        fx.local.invulnerable = false;
        expect(rocketOwnFeet(fx).lowest).toBeLessThan(100);
    });

    it('has the five dummies and no bots, and starts the legend from the range settings', () => {
        const { state, legend } = buildOffline(GameMode.RANGE);
        expect(state.players.filter(p => p.id.startsWith('bot_'))).toEqual([]);
        expect(state.players.filter(p => p.dummy)).toHaveLength(5);
        expect(legend).toEqual(state.range);
        expect(legend).not.toBe(state.range);
    });
});

describe('a Deathmatch built the same way', () => {
    it('has its bots, no dummy, no invulnerable fighter and no range settings', () => {
        const { state, legend } = buildOffline(GameMode.DEATHMATCH);
        expect(state.players.filter(p => p.id.startsWith('bot_'))).toHaveLength(3);
        expect(state.players.some(p => p.dummy)).toBe(false);
        expect(state.players.some(p => p.invulnerable)).toBe(false);
        expect(state.range).toBeUndefined();
        expect(legend).toBeNull();
    });

    it('is left alone by the range hooks: the camera follows the fighter and ammo is not refilled', () => {
        const fx = buildOffline(GameMode.DEATHMATCH);
        fx.local.weapon.ammo = 0;
        for (let i = 0; i < 30; i++) step(fx, T + i * FIXED_STEP_MS);
        expect(fx.local.weapon.ammo).toBe(0);
        expect(fx.state.camera).not.toMatchObject({ x: RANGE_CAMERA.x, y: RANGE_CAMERA.y });
    });
});
