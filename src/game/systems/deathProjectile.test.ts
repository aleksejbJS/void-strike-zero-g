import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameMode, Team, WeaponType, Entity, Platform } from '../../types';
import { createMockState, createMockPlayer } from '../../test/mocks';
import { gameEvents, GameEvent, DeathEvent } from './events';
import { updatePhysics } from './physics';
import { addCorpse } from './ragdoll/corpses';
import { createCorpse } from './ragdoll/corpseBody';
import { launchCorpse } from './ragdoll/corpseLaunch';

// A real projectile flies through updatePhysics and kills: the DEATH event says how

let events: GameEvent[] = [];
let unsubscribe: () => void;
beforeEach(() => { events = []; unsubscribe = gameEvents.on(e => events.push(e)); });
afterEach(() => { unsubscribe(); vi.restoreAllMocks(); });

const onlyDeath = (): DeathEvent => {
    const deaths = events.flatMap(e => (e.type === 'DEATH' ? [e] : []));
    expect(deaths).toHaveLength(1);
    return deaths[0];
};

const tick = (state: ReturnType<typeof createMockState>) =>
    updatePhysics(state, {}, { x: 0, y: 0 }, false, false, 800, 600, () => ({ x: 0, y: 0 }), 'nobody');

/** A victim standing at `x` with the given health (no platforms unless the test adds some). */
const victim = (health: number, x: number): Entity =>
    Object.assign(createMockPlayer('v', Team.NONE), { health, armor: 0, pos: { x, y: 0 } });

/** `type` fired by a shooter at x = 0, flying right at chest height from `startX` this tick. */
const fire = (type: WeaponType, startX: number, victimHealth: number, victimX: number, platforms: Platform[] = []) => {
    const state = createMockState(GameMode.DEATHMATCH);
    state.platforms = platforms;
    const shooter = createMockPlayer('s', Team.NONE, type);
    shooter.pos = { x: 0, y: 0 };
    state.players.push(shooter, victim(victimHealth, victimX));
    state.projectiles.push({
        id: 'shot', ownerId: 's', type, active: true, radius: 4, pos: { x: startX, y: -36 }, vel: { x: 30, y: 0 },
    });
    tick(state);
    return onlyDeath();
};

describe('a projectile kill through updatePhysics', () => {
    it('a rocket hitting a full-health fighter tears them apart, as a direct hit, not a splash', () => {
        // 65 from the hit does not kill 100 HP; the rocket's own blast finishes them
        const death = fire(WeaponType.ROCKET_LAUNCHER, 180, 100, 200);
        expect(death.kind).toBe('gib');
        expect(death.blast).toBe(false);
    });

    it('a point-blank shotgun pellet throws the victim, as a shot', () => {
        const death = fire(WeaponType.SHOTGUN, 40, 1, 80);
        expect(death.kind).toBe('thrown');
        expect(death.blast).toBe(false);
    });

    it('a rocket bursting on a wall beside the victim kills by splash', () => {
        const wall: Platform = { id: 'wall', x: 300, y: -200, w: 40, h: 200, color: '#000' };
        const death = fire(WeaponType.ROCKET_LAUNCHER, 280, 5, 250, [wall]);
        expect(death.blast).toBe(true);
        expect(death.from).toEqual({ x: 280, y: -36 });
    });

    it('a machine-gun kill sends blast false (every new host says shot or splash)', () => {
        expect(fire(WeaponType.MACHINE_GUN, 40, 1, 80).blast).toBe(false);
    });

    it('a point-blank shotgun corpse launches as a shot, not by the distance rule', () => {
        const death = fire(WeaponType.SHOTGUN, 40, 1, 80);
        vi.spyOn(Math, 'random').mockReturnValue(0.5); // no scatter: the launches are comparable
        const launched = (blast: boolean | undefined) => {
            const c = createCorpse(death);
            launchCorpse(c, death.from, death.vel, blast);
            return JSON.stringify(c.points);
        };
        const corpse = addCorpse(createMockState(GameMode.DEATHMATCH), death);
        expect(JSON.stringify(corpse.points)).toBe(launched(false));
        // The pellet came from close by, so the old distance rule would blend toward a blast
        expect(launched(false)).not.toBe(launched(undefined));
    });
});
