// Who gets the frag when a wounded fighter dies (spec 2026-11-03-railgun-wound, "Bleeding").

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameMode, Team, WeaponType, Entity } from '../../types';
import { createMockState, createMockPlayer } from '../../test/mocks';
import { gameEvents, GameEvent } from './events';
import { applyDamage } from './combat';
import { killCredit } from './wound';

let events: GameEvent[] = [];
let unsubscribe: () => void;
beforeEach(() => { events = []; unsubscribe = gameEvents.on(e => events.push(e)); });
afterEach(() => unsubscribe());

const kills = () => events.flatMap(e => (e.type === 'KILL' ? [e] : []));
const deaths = () => events.flatMap(e => (e.type === 'DEATH' ? [e] : []));

/** Shooter `s` holds a machine gun now; `t` lost a leg to `s`'s railgun earlier (10 HP); `o` is a bystander. */
const scene = (woundedBy = 's') => {
    const state = createMockState(GameMode.DEATHMATCH);
    const s = createMockPlayer('s', Team.NONE, WeaponType.MACHINE_GUN);
    const o = createMockPlayer('o', Team.NONE, WeaponType.SHOTGUN);
    const t: Entity = Object.assign(createMockPlayer('t', Team.NONE), { health: 10, wound: { by: woundedBy } });
    state.players.push(s, o, t);
    return { state, s, o, t };
};

describe('kill credit for the wounded', () => {
    it('bleed death credits the shooter with Railgun', () => {
        const { state, s, t } = scene();
        applyDamage(state, t, 's', 50, { x: 0, y: 0 }, 0, { bleed: true });
        expect(t.dead).toBe(true);
        expect(s.score).toBe(1);
        expect(kills()).toHaveLength(1);
        expect(kills()[0]).toMatchObject({ killer: 's', weapon: 'Railgun', victim: 't' });
    });

    it('own rocket splash credits the shooter', () => {
        const { state, s, t } = scene();
        // Self damage is halved: 200 -> 100, far past 10 HP
        applyDamage(state, t, 't', 200, { x: 0, y: -1 }, 0, { weapon: WeaponType.ROCKET_LAUNCHER });
        expect(t.dead).toBe(true);
        expect(s.score).toBe(1);
        expect(t.score).toBe(0);
        expect(kills()[0]).toMatchObject({ killer: 's', weapon: 'Railgun' });
    });

    it('falling off the map credits the shooter', () => {
        const { state, s, t } = scene();
        applyDamage(state, t, '', 9999, { x: 0, y: 0 });
        expect(t.dead).toBe(true);
        expect(s.score).toBe(1);
        expect(kills()[0]).toMatchObject({ killer: 's', weapon: 'Railgun' });
    });

    it('zone damage credits the shooter', () => {
        const { state, s, t } = scene();
        applyDamage(state, t, '', 50, { x: 0, y: 0 });
        expect(t.dead).toBe(true);
        expect(s.score).toBe(1);
    });

    it('another weapon by the shooter is credited normally', () => {
        const { state, s, t } = scene();
        applyDamage(state, t, 's', 50, { x: 1, y: 0 }, 0, { weapon: WeaponType.MACHINE_GUN });
        expect(s.score).toBe(1);
        expect(kills()[0].weapon).toBe(s.weapon.name);
    });

    it("another player's kill goes to them", () => {
        const { state, s, o, t } = scene();
        applyDamage(state, t, 'o', 50, { x: 1, y: 0 }, 0, { weapon: WeaponType.SHOTGUN });
        expect(o.score).toBe(1);
        expect(s.score).toBe(0);
        expect(kills()[0]).toMatchObject({ killer: 'o', weapon: o.weapon.name });
    });

    it('the shooter is gone: a death with no killer', () => {
        const { state, s, t } = scene('gone');
        expect(() => applyDamage(state, t, 's', 50, { x: 0, y: 0 }, 0, { bleed: true })).not.toThrow();
        expect(t.dead).toBe(true);
        expect(kills()).toHaveLength(1);
        expect(kills()[0].killer).toBe('World');
        expect(state.players.every(p => p.score === 0)).toBe(true);
        expect(s.score).toBe(0);
    });

    it('an unwounded death without a killer still has no kill feed line', () => {
        const { state, t } = scene();
        t.wound = undefined;
        applyDamage(state, t, '', 50, { x: 0, y: 0 });
        expect(t.dead).toBe(true);
        expect(kills()).toHaveLength(0);
    });
});

describe('bleeding death', () => {
    it('slumps, even when the source names the railgun', () => {
        const { state, t } = scene();
        applyDamage(state, t, 's', 50, { x: 0, y: 0 }, 0, { bleed: true, weapon: WeaponType.RAILGUN });
        expect(deaths()[0].kind).toBe('fall');
    });

    it('clears the wound and the DEATH event carries oneLeg', () => {
        const { state, t } = scene();
        applyDamage(state, t, 's', 50, { x: 0, y: 0 }, 0, { bleed: true });
        expect(t.wound).toBeUndefined();
        expect(deaths()).toHaveLength(1);
        expect(deaths()[0].oneLeg).toBe(true);
    });

    it('a body without a wound has no oneLeg', () => {
        const { state, t } = scene();
        t.wound = undefined;
        applyDamage(state, t, 'o', 50, { x: 1, y: 0 }, 0, { weapon: WeaponType.SHOTGUN });
        expect(deaths()[0].oneLeg).toBe(false);
    });

    it('a tick skips armor, knockback and the damage number', () => {
        const { state, t } = scene();
        t.armor = 50;
        applyDamage(state, t, 's', 1, { x: 1, y: 0 }, 5, { bleed: true });
        expect(t.health).toBe(9);
        expect(t.armor).toBe(50);
        expect(t.vel).toEqual({ x: 0, y: 0 });
        expect(events.some(e => e.type === 'DAMAGE')).toBe(false);
        expect(t.wound).toBeDefined();
    });

    it('a tick skips the Hold the Flag bonus damage', () => {
        const { state, t } = scene();
        state.mode = GameMode.HOLD_THE_FLAG;
        t.team = Team.RED;
        t.hasFlag = Team.RED;
        applyDamage(state, t, 's', 1, { x: 0, y: 0 }, 0, { bleed: true });
        expect(t.health).toBe(9);
    });
});

describe('killCredit', () => {
    const wounded = (): Entity => Object.assign(createMockPlayer('t', Team.NONE), { wound: { by: 's' } });

    it('credits the wounder with the railgun on bleed, no attacker or self-kill', () => {
        const expected = { attackerId: 's', weapon: WeaponType.RAILGUN };
        expect(killCredit(wounded(), 's', { bleed: true })).toEqual(expected);
        expect(killCredit(wounded(), '', {})).toEqual(expected);
        expect(killCredit(wounded(), 't', { weapon: WeaponType.ROCKET_LAUNCHER })).toEqual(expected);
    });

    it('leaves everyone else as is', () => {
        expect(killCredit(wounded(), 'o', {})).toEqual({ attackerId: 'o' });
        expect(killCredit(wounded(), 's', { weapon: WeaponType.MACHINE_GUN })).toEqual({ attackerId: 's' });
        expect(killCredit(createMockPlayer('t', Team.NONE), '', {})).toEqual({ attackerId: '' });
        expect(killCredit(createMockPlayer('t', Team.NONE), 't', {})).toEqual({ attackerId: 't' });
    });
});
