import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameMode, Team, WeaponType, Entity } from '../../types';
import { createMockState, createMockPlayer } from '../../test/mocks';
import { gameEvents, GameEvent, DeathEvent } from './events';
import { applyDamage, createExplosion, fireWeapon } from './combat';
import { deathEvent } from './effects';
import { updatePhysics } from './physics';

let events: GameEvent[] = [];
let unsubscribe: () => void;
beforeEach(() => { events = []; unsubscribe = gameEvents.on(e => events.push(e)); });
afterEach(() => unsubscribe());

const deaths = () => events.flatMap(e => (e.type === 'DEATH' ? [e] : []));
const onlyDeath = (): DeathEvent => {
    expect(deaths()).toHaveLength(1);
    return deaths()[0];
};

/** A victim standing at `x` with the given health (the arena has no platforms, so blasts are never blocked). */
const victim = (id: string, health: number, x = 0, armor = 0): Entity =>
    Object.assign(createMockPlayer(id, Team.NONE), { health, armor, pos: { x, y: 0 } });

const NO_PUSH = { x: 0, y: 0 };

describe('the cause of death travels with the DEATH event', () => {
    it('a machine-gun kill sends fall', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const p = victim('v', 10);
        state.players.push(p);
        applyDamage(state, p, 's', 10, { x: 1, y: 0 }, 0.3, { weapon: WeaponType.MACHINE_GUN, direct: true });
        expect(onlyDeath().kind).toBe('fall');
    });

    it('a direct rocket kill sends gib, whatever the overkill', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const p = victim('v', 40);
        state.players.push(p);
        applyDamage(state, p, 's', 65, { x: 1, y: 0 }, 4, { weapon: WeaponType.ROCKET_LAUNCHER, direct: true });
        expect(onlyDeath().kind).toBe('gib');
    });

    it('the edge of a blast sends thrown, with the blast centre as the origin', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const p = victim('v', 3, 140);
        state.players.push(p);
        createExplosion(state, { x: 0, y: 0 }, 's', 150, WeaponType.ROCKET_LAUNCHER);
        const death = onlyDeath();
        expect(death.kind).toBe('thrown');
        expect(death.from).toEqual({ x: 0, y: 0 });
        expect(death.blast).toBe(true); // a splash: thrown by the blast, not shoved like a shot
    });

    it('shots and direct hits are not splashes', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const hits = [{ weapon: WeaponType.SHOTGUN, direct: true, shooterDist: 50 }, { weapon: WeaponType.ROCKET_LAUNCHER, direct: true }];
        hits.forEach((source, i) => applyDamage(state, victim(`v${i}`, 5), 's', 65, { x: 1, y: 0 }, 1, source));
        expect(deaths()).toHaveLength(2);
        expect(deaths().every(d => !d.blast)).toBe(true);
    });

    it('a near blast on a low fighter sends gib', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const p = victim('v', 5, 10);
        state.players.push(p);
        createExplosion(state, { x: 0, y: 0 }, 's', 150, WeaponType.ROCKET_LAUNCHER);
        expect(onlyDeath().kind).toBe('gib');
    });

    it('armor counts before overkill: a blast the armor absorbs kills nobody', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const p = victim('v', 30, 10, 100);
        state.players.push(p);
        createExplosion(state, { x: 0, y: 0 }, 's', 150, WeaponType.ROCKET_LAUNCHER);
        expect(p.dead).toBe(false);
        expect(deaths()).toHaveLength(0);
    });

    it('overkill is what is left after armor: armor can turn a gib into a throw', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        // Blast 60.7 at 10 units: armor takes 66%, so 20.6 lands on a 5 HP fighter = overkill 15.6
        const p = victim('v', 5, 10, 100);
        state.players.push(p);
        createExplosion(state, { x: 0, y: 0 }, 's', 150, WeaponType.ROCKET_LAUNCHER);
        expect(onlyDeath().kind).toBe('thrown');
    });

    it('a railgun kill sends cut and the beam origin', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const shooter = createMockPlayer('s', Team.NONE, WeaponType.RAILGUN);
        const p = victim('v', 100, 200);
        state.players.push(shooter, p);
        fireWeapon(state, shooter, { x: 400, y: -50 });
        const death = onlyDeath();
        expect(death.kind).toBe('cut');
        expect(death.from).toEqual({ x: 0, y: -50 });
    });

    it('a chainsaw kill sends gib and the saw origin', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const shooter = createMockPlayer('s', Team.NONE, WeaponType.CHAINSAW);
        const p = victim('v', 10, 70);
        state.players.push(shooter, p);
        fireWeapon(state, shooter, { x: 400, y: -50 });
        const death = onlyDeath();
        expect(death.kind).toBe('gib');
        expect(death.from).toEqual({ x: 0, y: -50 });
    });

    it('zone damage (no source) sends fall', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const p = victim('v', 5);
        state.players.push(p);
        applyDamage(state, p, '', 6, NO_PUSH);
        const death = onlyDeath();
        expect(death.kind).toBe('fall');
        expect(death.from).toBeUndefined();
    });

    it('a self-inflicted rocket death still follows overkill (self damage is halved)', () => {
        // Blast at the feet = 65 * 0.5 = 32.5 damage
        const low = createMockState(GameMode.DEATHMATCH);
        const weak = victim('me', 1);
        low.players.push(weak);
        createExplosion(low, { x: 0, y: 0 }, 'me', 150, WeaponType.ROCKET_LAUNCHER);
        expect(onlyDeath().kind).toBe('gib'); // overkill 31.5

        events = [];
        const sturdy = createMockState(GameMode.DEATHMATCH);
        const tougher = victim('me', 30);
        sturdy.players.push(tougher);
        createExplosion(sturdy, { x: 0, y: 0 }, 'me', 150, WeaponType.ROCKET_LAUNCHER);
        expect(onlyDeath().kind).toBe('thrown'); // overkill 2.5
    });
});

describe('a projectile hit reports the shooter distance and the path start', () => {
    const tick = (state: ReturnType<typeof createMockState>) =>
        updatePhysics(state, {}, { x: 0, y: 0 }, false, false, 800, 600, () => ({ x: 0, y: 0 }), 'nobody');

    // A shotgun pellet flying right at a 1 HP victim whose chest is at y = -36
    const pelletKill = (shooterX: number, victimX: number) => {
        const state = createMockState(GameMode.DEATHMATCH);
        const shooter = createMockPlayer('s', Team.NONE, WeaponType.SHOTGUN);
        shooter.pos = { x: shooterX, y: 0 };
        const p = victim('v', 1, victimX);
        state.players.push(shooter, p);
        state.projectiles.push({
            id: 'pellet', ownerId: 's', type: WeaponType.SHOTGUN, active: true, radius: 4,
            pos: { x: victimX - 40, y: -36 }, vel: { x: 60, y: 0 },
        });
        tick(state);
        return onlyDeath();
    };

    it('point blank throws the victim, far away it only drops', () => {
        expect(pelletKill(0, 80).kind).toBe('thrown');
        events = [];
        expect(pelletKill(0, 600).kind).toBe('fall');
    });

    it('the origin is where the projectile came from', () => {
        const death = pelletKill(0, 80);
        expect(death.from?.x).toBeCloseTo(40, 0);
        expect(death.from?.y).toBeCloseTo(-36, 0);
    });
});

describe('the event describes the body', () => {
    it('carries the velocity, facing, held weapon and jetpack colour', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const p = Object.assign(victim('v', 5), {
            vel: { x: 3, y: -2 }, facingRight: false, jetpackColor: '#abcdef',
            weapon: createMockPlayer('w', Team.NONE, WeaponType.SHOTGUN).weapon,
        });
        state.players.push(p);
        applyDamage(state, p, '', 50, NO_PUSH);
        const death = onlyDeath();
        expect(death.vel).toEqual({ x: 3, y: -2 });
        expect(death.facing).toBe(-1);
        expect(death.weapon).toBe(WeaponType.SHOTGUN);
        expect(death.parts?.jet).toBe('#abcdef');
        // A snapshot: later movement of the entity must not change a sent event
        p.vel.x = 99;
        expect(death.vel.x).toBe(3);
    });

    it('faces right when the fighter does', () => {
        expect(deathEvent(victim('v', 1)).facing).toBe(1);
    });

    it('the menu preview call without a kind means fall', () => {
        const event = deathEvent(victim('v', 1));
        expect(event.kind).toBe('fall');
        expect(event.from).toBeUndefined();
    });
});
