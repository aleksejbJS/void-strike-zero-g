import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameMode, Team, WeaponType, Entity } from '../../types';
import { createMockState, createMockPlayer } from '../../test/mocks';
import { gameEvents, GameEvent } from './events';
import { applyDamage, fireWeapon } from './combat';
import { resetMatch, createBots } from '../net/roomSetup';
import { healWound } from './wound';

let events: GameEvent[] = [];
let unsubscribe: () => void;
beforeEach(() => { events = []; unsubscribe = gameEvents.on(e => events.push(e)); });
afterEach(() => unsubscribe());

const limbs = () => events.flatMap(e => (e.type === 'LIMB' ? [e] : []));

/** A railgun shooter at the origin and a victim 200 px away in the open. */
const duel = (health: number, armor: number, shooterId = 'shooter') => {
    const state = createMockState(GameMode.DEATHMATCH);
    const shooter = createMockPlayer(shooterId, Team.NONE, WeaponType.RAILGUN);
    const target: Entity = Object.assign(createMockPlayer('target', Team.NONE), { health, armor, pos: { x: 200, y: 0 } });
    state.players.push(shooter, target);
    return { state, shooter, target };
};

const beam = (state: ReturnType<typeof duel>['state'], shooter: Entity) => {
    shooter.weapon.ammo = 5;
    fireWeapon(state, shooter, { x: 400, y: -50 });
};

describe('railgun wound', () => {
    it('wounds an armored target', () => {
        const { state, shooter, target } = duel(100, 100);
        beam(state, shooter);
        expect(target.dead).toBe(false);
        expect(target.armor).toBe(0);
        expect(target.health).toBe(10);
        expect(target.wound?.by).toBe('shooter');
    });

    it('keeps lower health', () => {
        const { state, shooter, target } = duel(4, 5);
        beam(state, shooter);
        expect(target.dead).toBe(false);
        expect(target.armor).toBe(0);
        expect(target.health).toBe(4);
        expect(target.wound).toBeDefined();
    });

    it('kills an unarmored target as before', () => {
        const { state, shooter, target } = duel(100, 0);
        beam(state, shooter);
        expect(target.dead).toBe(true);
        expect(target.wound).toBeUndefined();
    });

    it('second beam without armor kills', () => {
        const { state, shooter, target } = duel(100, 100);
        beam(state, shooter);
        expect(target.dead).toBe(false);
        shooter.lastFired = 0;
        beam(state, shooter);
        expect(target.dead).toBe(true);
    });

    it('re-wound credits the newest shooter', () => {
        const { state, shooter, target } = duel(100, 100, 'a');
        // The second shooter stands behind the victim and fires back along the same line
        const other = Object.assign(createMockPlayer('b', Team.NONE, WeaponType.RAILGUN), { pos: { x: 600, y: 0 } });
        state.players.push(other);
        beam(state, shooter);
        expect(target.wound?.by).toBe('a');

        target.armor = 50;
        other.weapon.ammo = 5;
        fireWeapon(state, other, { x: 0, y: -50 });
        expect(target.dead).toBe(false);
        expect(target.armor).toBe(0);
        expect(target.health).toBe(10);
        expect(target.wound?.by).toBe('b');
    });

    it('only the railgun wounds', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const target = Object.assign(createMockPlayer('target', Team.NONE), { armor: 100 });
        state.players.push(target);
        applyDamage(state, target, 'shooter', 20, { x: 1, y: 0 }, 0.3, { weapon: WeaponType.MACHINE_GUN });
        expect(target.wound).toBeUndefined();
        expect(target.armor).toBeLessThan(100);
        expect(target.armor).toBeGreaterThan(0);
    });

    it('a bleed source never wounds', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const target = Object.assign(createMockPlayer('target', Team.NONE), { armor: 100 });
        state.players.push(target);
        applyDamage(state, target, 'shooter', 1, { x: 0, y: 0 }, 0, { weapon: WeaponType.RAILGUN, bleed: true });
        expect(target.wound).toBeUndefined();
    });

    it('pushes the wounded fighter along the beam', () => {
        const { state, shooter, target } = duel(100, 100);
        beam(state, shooter);
        expect(target.vel.x).toBeGreaterThan(0);
    });

    it('announces the lost health as a damage number', () => {
        const { state, shooter } = duel(100, 100);
        beam(state, shooter);
        const damage = events.flatMap(e => (e.type === 'DAMAGE' ? [e] : []));
        expect(damage).toHaveLength(1);
        expect(damage[0].amount).toBe(90);
    });

    it('emits LIMB on wound', () => {
        const { state, shooter, target } = duel(100, 100);
        target.facingRight = false;
        beam(state, shooter);
        expect(limbs()).toHaveLength(1);
        expect(limbs()[0]).toMatchObject({ x: 200, y: 0, facing: -1, from: { x: 0, y: -50 } });
        expect(limbs()[0].parts?.leg).toBe('#475569');
        expect(events.some(e => e.type === 'DEATH')).toBe(false);
    });

    it('emits no LIMB when the beam kills', () => {
        const { state, shooter } = duel(100, 0);
        beam(state, shooter);
        expect(limbs()).toHaveLength(0);
    });

    it('the round-start shield still blocks the beam', () => {
        const { state, shooter, target } = duel(100, 100);
        state.mode = GameMode.HUNGER_GAMES;
        state.hungerRoundStartedAt = Date.now();
        beam(state, shooter);
        expect(target.wound).toBeUndefined();
        expect(target.armor).toBe(100);
        expect(limbs()).toHaveLength(0);
    });
});

describe('healWound', () => {
    it('gives the leg back', () => {
        const p = createMockPlayer('p', Team.NONE);
        p.wound = { by: 'shooter' };
        healWound(p);
        expect(p.wound).toBeUndefined();
    });
});

describe('baseEntity', () => {
    it('has no wound after resetMatch', () => {
        const state = createMockState(GameMode.DEATHMATCH);
        const [bot] = createBots(GameMode.DEATHMATCH);
        bot.wound = { by: 'shooter' };
        state.players.push(bot);
        resetMatch(state);
        expect(state.players[0].wound).toBeUndefined();
    });
});
