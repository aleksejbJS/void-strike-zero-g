import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameMode, Team, WeaponType } from '../../types';
import type { Entity, GameState } from '../../types';
import { createMockState, createMockPlayer } from '../../test/mocks';
import { resetHungerRound, resetMatch } from '../net/roomSetup';
import { gameEvents, GameEvent } from './events';
import { applyDamage } from './combat';
import { updatePhysics } from './physics';
import { igniteBurn } from './burning';
import { tankPos, tickFuelTanks } from './fuelTankBlast';
import { TANK_DAMAGE, TANK_FUSE_MS, TANK_KILL_NAME, TANK_RADIUS } from './flameConstants';
import { NOW } from './flameTestKit';

let events: GameEvent[] = [];
let unsubscribe: () => void;
beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] }); // applyDamage and updatePhysics read Date.now() themselves
    vi.setSystemTime(NOW);
    events = [];
    unsubscribe = gameEvents.on(e => events.push(e));
});
afterEach(() => { unsubscribe(); vi.restoreAllMocks(); vi.useRealTimers(); });

const FUSE_END = NOW + TANK_FUSE_MS;
const of = <T extends GameEvent['type']>(type: T) => events.filter(e => e.type === type) as Extract<GameEvent, { type: T }>[];

/** A state with a flamethrower carrier at (0, 0) whose tank `igniter` lit at NOW, and the igniter far away. */
const scene = (mode = GameMode.DEATHMATCH, team = Team.NONE): { state: GameState; carrier: Entity; igniter: Entity } => {
    const state = createMockState(mode);
    const carrier = createMockPlayer('carrier', team, WeaponType.FLAMETHROWER);
    carrier.tankFuseAt = FUSE_END;
    carrier.tankBy = 'igniter';
    const igniter = createMockPlayer('igniter', team === Team.NONE ? Team.NONE : Team.RED);
    igniter.pos = { x: 5000, y: 0 };
    state.players.push(carrier, igniter);
    return { state, carrier, igniter };
};

/** A fighter standing `dist` px right of where the blast happens (the carrier's tank at (0, 0)). */
const near = (state: GameState, id: string, dist: number, team = Team.NONE, weapon = WeaponType.MACHINE_GUN): Entity => {
    const at = tankPos(createMockPlayer('probe', Team.NONE));
    const p = createMockPlayer(id, team, weapon);
    p.pos = { x: at.x + dist, y: at.y };
    state.players.push(p);
    return p;
};

/** The fuse ends: the clock moves on and the tanks tick. */
const fuseEnds = (state: GameState) => { vi.setSystemTime(FUSE_END); tickFuelTanks(state, FUSE_END); };

describe('a lit tank on a living carrier', () => {
    it('kills and gibs the carrier at the fuse end, credited to the igniter as "Fuel Tank"', () => {
        const { state, carrier } = scene();
        carrier.armor = 100;
        tickFuelTanks(state, FUSE_END - 1);
        expect(carrier.dead).toBe(false);
        fuseEnds(state);
        expect(carrier.dead).toBe(true);
        expect(carrier).toMatchObject({ tankFuseAt: undefined, tankBy: undefined });
        expect(of('DEATH')[0].kind).toBe('gib');
        expect(of('DEATH')[0].tank).toBeUndefined();
        expect(of('KILL')[0]).toMatchObject({ killer: 'igniter', weapon: TANK_KILL_NAME, victim: 'carrier' });
        expect(of('TANK_BLAST')).toEqual([]);
        expect(state.litTanks ?? []).toEqual([]);
    });

    it('hurts everyone in reach with falloff: a neighbour, a teammate of the igniter, the igniter itself', () => {
        const { state, igniter } = scene(GameMode.CTF, Team.BLUE);
        const neighbour = near(state, 'neighbour', 50, Team.BLUE);
        const mate = near(state, 'mate', 50, Team.RED);
        igniter.pos = { ...neighbour.pos };
        const far = near(state, 'far', TANK_RADIUS + 1, Team.BLUE);
        fuseEnds(state);
        const lost = TANK_DAMAGE * (1 - 50 / TANK_RADIUS);
        expect(100 - neighbour.health).toBeCloseTo(lost, 5);
        expect(100 - mate.health).toBeCloseTo(lost, 5);
        expect(100 - igniter.health).toBeCloseTo(lost, 5); // not halved as self-damage
        expect(far.health).toBe(100);
    });
});

describe('a carrier dying with a lit tank', () => {
    it('a rocket kill that lights the tank drops the body and leaves the tank to blast at the death spot', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const carrier = createMockPlayer('carrier', Team.NONE, WeaponType.FLAMETHROWER);
        carrier.pos = { x: 300, y: 100 };
        state.players.push(carrier);
        vi.spyOn(Math, 'random').mockReturnValue(0);
        applyDamage(state, carrier, 'rocketeer', 200, { x: 1, y: 0 }, 0, { weapon: WeaponType.ROCKET_LAUNCHER, direct: true, from: { x: 0, y: 100 } });
        const death = of('DEATH')[0];
        expect(death).toMatchObject({ kind: 'fall', blast: false });
        expect(death.tank).toBeDefined();
        const spot = tankPos(carrier);
        expect(state.litTanks).toEqual([{ id: death.tank, pos: spot, fuseAt: FUSE_END, by: 'rocketeer' }]);
        expect(carrier).toMatchObject({ tankFuseAt: undefined, tankBy: undefined });

        events = [];
        fuseEnds(state);
        expect(of('TANK_BLAST')).toEqual([{ type: 'TANK_BLAST', id: death.tank, x: spot.x, y: spot.y }]);
        expect(of('EFFECT')).toContainEqual(expect.objectContaining({ effect: 'explosion', x: spot.x, y: spot.y }));
        expect(state.litTanks).toEqual([]);
    });

    it('a finisher keeps the carrier\'s kill; the blast\'s other kills go to the igniter', () => {
        const { state, carrier } = scene();
        const finisher = createMockPlayer('finisher', Team.NONE);
        finisher.pos = { x: -5000, y: 0 };
        state.players.push(finisher);
        const bystander = near(state, 'bystander', 20);
        bystander.health = 10;
        vi.spyOn(Math, 'random').mockReturnValue(0.99);
        applyDamage(state, carrier, 'finisher', 200, { x: 1, y: 0 }, 0, { weapon: WeaponType.MACHINE_GUN, direct: true });
        expect(of('KILL')[0]).toMatchObject({ killer: 'finisher', victim: 'carrier' });
        fuseEnds(state);
        expect(of('KILL')[1]).toMatchObject({ killer: 'igniter', weapon: TANK_KILL_NAME, victim: 'bystander' });
        expect(of('KILL')).toHaveLength(2);
    });

    it('respawns clean while the tank still blasts at the death spot, not at the spawn', () => {
        const { state, carrier } = scene();
        igniteBurn(carrier, 'igniter', NOW);
        vi.spyOn(Math, 'random').mockReturnValue(0.99);
        applyDamage(state, carrier, 'igniter', 200, { x: 1, y: 0 }, 0, { weapon: WeaponType.MACHINE_GUN, direct: true });
        const spot = tankPos(carrier);
        events = [];
        vi.setSystemTime(FUSE_END + 1); // the respawn is due strictly after RESPAWN_DELAY, the same 3 s
        updatePhysics(state, {}, { x: 0, y: 0 }, false, false, 800, 600, () => ({ x: 2000, y: 0 }), 'nobody');
        expect(carrier.dead).toBe(false);
        expect(carrier).toMatchObject({ tankFuseAt: undefined, tankBy: undefined, burnUntil: undefined });
        expect(carrier.health).toBe(100);
        expect(of('TANK_BLAST')).toEqual([expect.objectContaining({ x: spot.x, y: spot.y })]);
    });
});

describe('lit tanks and the rest of the game', () => {
    it('a new Hunger round or match clears every lit tank and every burning fuse', () => {
        for (const reset of [(s: GameState) => resetHungerRound(s, NOW), resetMatch]) {
            const { state, carrier } = scene(GameMode.HUNGER_GAMES);
            state.litTanks = [{ id: 'tank_x', pos: { x: 0, y: 0 }, fuseAt: FUSE_END, by: 'igniter' }];
            reset(state);
            expect(state.litTanks).toEqual([]);
            expect(carrier).toMatchObject({ tankFuseAt: undefined, tankBy: undefined });
        }
    });

    it('a tank blast lights another carrier\'s tank at 15%', () => {
        for (const [roll, lit] of [[0.14, true], [0.16, false]] as const) {
            const { state } = scene();
            const other = near(state, 'other', 100, Team.NONE, WeaponType.FLAMETHROWER);
            other.armor = 100;
            vi.spyOn(Math, 'random').mockReturnValue(roll);
            fuseEnds(state);
            expect(other.dead).toBe(false);
            expect(other.tankFuseAt).toBe(lit ? FUSE_END + TANK_FUSE_MS : undefined);
            expect(other.tankBy).toBe(lit ? 'igniter' : undefined);
            vi.restoreAllMocks();
        }
    });

    it('still blasts when the igniter has left: the world kills with the Fuel Tank', () => {
        const { state, igniter } = scene();
        state.players.splice(state.players.indexOf(igniter), 1);
        const bystander = near(state, 'bystander', 20);
        bystander.health = 10;
        fuseEnds(state);
        expect(bystander.dead).toBe(true);
        expect(of('KILL').map(k => [k.killer, k.weapon])).toEqual([['World', TANK_KILL_NAME], ['World', TANK_KILL_NAME]]);
    });

    it('a tank kill scores but does not move the Gun Game ladder', () => {
        const { state, igniter } = scene(GameMode.GUN_GAME);
        igniter.gunProgress = 0;
        fuseEnds(state);
        expect(igniter.score).toBe(1);
        expect(igniter.gunProgress).toBe(0);
    });
});
