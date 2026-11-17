import { describe, it, expect } from 'vitest';
import { Entity, Team, WeaponType } from '../../types';
import { WEAPONS_DATA } from '../../constants';
import { makeBot, makeState } from '../../test/botFixtures';
import { BODY_PRESETS } from '../build/characterBases';
import { presetBuild } from '../build/buildPresets';
import { DUMMY_SPOTS } from './rangeMap';
import { createRangeState } from './rangeState';
import { createDummies, rangeLoadout, setupRange } from './rangeSetup';

const makeLocal = (): Entity => ({
    ...makeBot('player', Team.NONE, 150, 800), type: 'player', name: 'Tester', jetpackColor: '#ef4444', lastProcessedInput: 0,
});

describe('range dummies', () => {
    it('makes one dummy per body preset, in the order of the dummy spots', () => {
        const dummies = createDummies();
        expect(dummies.map(d => d.id)).toEqual(BODY_PRESETS.map(p => `dummy_${p.id}`));
        expect(dummies.map(d => d.skinId)).toEqual(DUMMY_SPOTS.map(s => s.skinId));
    });

    it('stands every dummy on its own spot, as a copy of it', () => {
        const dummies = createDummies();
        const firstX = DUMMY_SPOTS[0].pos.x;
        dummies.forEach((dummy, i) => {
            expect(dummy.pos).toEqual(DUMMY_SPOTS[i].pos);
            expect(dummy.pos).not.toBe(DUMMY_SPOTS[i].pos);
        });
        dummies[0].pos.x += 99;
        expect(DUMMY_SPOTS[0].pos.x).toBe(firstX);
        expect(createDummies()[0].pos.x).toBe(firstX);
    });

    it('marks them as dummy bots with no team, full health, no armour and the fighter size', () => {
        for (const dummy of createDummies()) {
            expect(dummy).toMatchObject({
                type: 'bot', dummy: true, team: Team.NONE, health: 100, maxHealth: 100, armor: 0,
                width: 30, height: 72, dead: false,
            });
            expect(dummy.invulnerable).toBeUndefined();
        }
    });

    it('turns them towards the spawn with a machine gun in hand', () => {
        for (const dummy of createDummies()) {
            expect(dummy.facingRight).toBe(false);
            expect(dummy.aim).toBe(Math.PI);
            expect(dummy.weapon.type).toBe(WeaponType.MACHINE_GUN);
            expect(dummy.inventory).toEqual([dummy.weapon]);
        }
    });

    it('dresses each in its preset palette and the plain preset build', () => {
        for (const dummy of createDummies()) {
            const preset = BODY_PRESETS.find(p => p.id === dummy.skinId)!;
            expect(dummy).toMatchObject({
                color: preset.color, headColor: preset.palette.head, torsoColor: preset.palette.torso,
                armColor: preset.palette.arms, legColor: preset.palette.legs, jetpackColor: preset.palette.jetpack,
            });
            expect(dummy.build).toEqual(presetBuild(dummy.skinId));
        }
    });

    it('gives every dummy its own weapon and inventory objects', () => {
        const [a, b] = createDummies();
        a.weapon.ammo = 0;
        expect(b.weapon.ammo).toBe(WEAPONS_DATA[WeaponType.MACHINE_GUN].ammo);
        expect(a.weapon).not.toBe(WEAPONS_DATA[WeaponType.MACHINE_GUN]);
    });
});

describe('range loadout', () => {
    it('holds every weapon type once, in enum order', () => {
        const loadout = rangeLoadout();
        expect(loadout).toHaveLength(9);
        expect(loadout.map(w => w.type)).toEqual(Object.values(WeaponType));
        expect(new Set(loadout.map(w => w.type)).size).toBe(9);
    });

    it('is a fresh copy: spending ammo never touches the weapon table or the next loadout', () => {
        const loadout = rangeLoadout();
        loadout.forEach(w => { w.ammo = 0; });
        for (const type of Object.values(WeaponType)) {
            expect(WEAPONS_DATA[type].ammo).toBeGreaterThan(0);
        }
        expect(rangeLoadout()[0].ammo).toBe(WEAPONS_DATA[WeaponType.MACHINE_GUN].ammo);
    });
});

describe('setupRange', () => {
    it('makes only the local player invulnerable and arms it with the whole loadout', () => {
        const state = makeState();
        const local = makeLocal();
        state.players.push(local);
        setupRange(state, local);

        expect(local.invulnerable).toBe(true);
        expect(local.inventory.map(w => w.type)).toEqual(Object.values(WeaponType));
        expect(local.weapon).toBe(local.inventory[0]);
        expect(local.weapon.type).toBe(WeaponType.MACHINE_GUN);
        const others = state.players.filter(p => p !== local);
        expect(others).toHaveLength(5);
        expect(others.every(p => p.invulnerable === undefined && p.dummy === true)).toBe(true);
    });

    it('adds the dummies after the player and starts a fresh range state', () => {
        const state = makeState();
        const local = makeLocal();
        state.players.push(local);
        setupRange(state, local);

        expect(state.players).toHaveLength(6);
        expect(state.players[0]).toBe(local);
        expect(state.players.slice(1).map(p => p.id)).toEqual(BODY_PRESETS.map(p => `dummy_${p.id}`));
        expect(state.range).toEqual(createRangeState());
    });
});
