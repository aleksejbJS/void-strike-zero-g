import { describe, it, expect, afterEach } from 'vitest';
import type { Beam, Decal, FloatingText, GameState, LitTank, Particle, Projectile, SmokeCloud } from '../../types';
import { COVER_SPECS } from '../cover/coverTypes';
import { coverRect } from '../cover/coverGeometry';
import { checkRectOverlap } from '../utils/math';
import { igniteBurn } from '../systems/burning';
import { addMark, clearMarks, liveMarks } from '../systems/marks';
import { DUMMY_SPOTS } from './rangeMap';
import { resetRange, reviveDummy } from './rangeReset';
import { rangeFixture } from './rangeTestKit';

const bodyRect = (p: { pos: { x: number; y: number }; width: number; height: number }) =>
    ({ x: p.pos.x - p.width / 2, y: p.pos.y - p.height, w: p.width, h: p.height });

const NOW = 1_000_000;
const coverOf = (state: GameState, kind: string) => state.cover!.find(c => c.kind === kind)!;

describe('reviveDummy', () => {
    it('stands a dead dummy up on its own spot, whole, still and unburnt', () => {
        const { state, range, dummies } = rangeFixture();
        const [dummy] = dummies;
        Object.assign(dummy, { dead: true, health: -4, respawnTimer: Number.MAX_SAFE_INTEGER, pos: { x: 3, y: 4 }, vel: { x: 9, y: -9 } });
        dummy.wound = { by: 'player' };
        igniteBurn(dummy, 'player', NOW);
        range.diedAt[dummy.id] = NOW - 100;

        reviveDummy(state, dummy, NOW);

        expect(dummy).toMatchObject({ dead: false, health: 100, armor: 0, respawnTimer: 0, vel: { x: 0, y: 0 } });
        expect(dummy.pos).toEqual(DUMMY_SPOTS[0].pos);
        expect(dummy.pos).not.toBe(DUMMY_SPOTS[0].pos);
        expect(dummy.wound).toBeUndefined();
        expect(dummy.burnUntil).toBeUndefined();
        expect(range.diedAt[dummy.id]).toBeUndefined();
    });

    it('puts every dummy back on its own spot, not on a shared one', () => {
        const { state, dummies } = rangeFixture();
        dummies.forEach(d => { d.pos = { x: 1, y: 1 }; reviveDummy(state, d, NOW); });
        expect(dummies.map(d => d.pos)).toEqual(DUMMY_SPOTS.map(s => s.pos));
    });

    it('gives the armour the toggle says', () => {
        const { state, range, dummies } = rangeFixture();
        range.armored = true;
        reviveDummy(state, dummies[1], NOW);
        expect(dummies[1].armor).toBe(100);
        range.armored = false;
        reviveDummy(state, dummies[1], NOW);
        expect(dummies[1].armor).toBe(0);
    });

    it('refuses a fighter that has no dummy spot instead of guessing one', () => {
        const { state, local } = rangeFixture();
        expect(() => reviveDummy(state, local, NOW)).toThrow(/no spot/);
    });
});

describe('resetRange', () => {
    it('restores a broken glass pane to 60 hp with nothing left pending', () => {
        const { state } = rangeFixture();
        const glass = coverOf(state, 'glass');
        Object.assign(glass, { hp: 0, returnsAt: NOW + 35000 });
        resetRange(state, NOW);
        expect(glass.hp).toBe(60);
        expect(glass.returnsAt).toBeUndefined();
    });

    it('mends hurt and lit cover too: hp, return, fuse and credit', () => {
        const { state } = rangeFixture();
        const wood = coverOf(state, 'wood');
        const barrel = coverOf(state, 'barrel');
        Object.assign(wood, { hp: 12 });
        Object.assign(barrel, { hp: 0, returnsAt: NOW + 5, fuseAt: NOW + 5, creditId: 'player' });
        resetRange(state, NOW);
        expect(wood.hp).toBe(COVER_SPECS.wood.hp);
        expect(barrel).toMatchObject({ hp: COVER_SPECS.barrel.hp, returnsAt: undefined, fuseAt: undefined, creditId: undefined });
    });

    it('lifts a fighter standing in a broken piece onto it when the piece comes back', () => {
        const { state, local } = rangeFixture();
        const crate = coverOf(state, 'wood');
        Object.assign(crate, { hp: 0, returnsAt: NOW + 35000 });
        local.pos = { x: crate.pos.x + 5, y: crate.pos.y }; // standing in the gap of the broken crate
        const x = local.pos.x;

        resetRange(state, NOW);

        expect(crate.hp).toBe(COVER_SPECS.wood.hp);
        expect(checkRectOverlap(bodyRect(local), coverRect(crate))).toBe(false);
        expect(local.pos).toEqual({ x, y: coverRect(crate).y });
    });

    it('leaves a fighter who stands clear of the cover where they are', () => {
        const { state, local } = rangeFixture();
        const pos = { ...local.pos };
        Object.assign(coverOf(state, 'glass'), { hp: 0, returnsAt: NOW + 35000 });
        resetRange(state, NOW);
        expect(local.pos).toEqual(pos);
    });

    it('revives every dummy, dead or alive, and clears a wound', () => {
        const { state, range, dummies } = rangeFixture();
        Object.assign(dummies[0], { dead: true, health: -1, respawnTimer: Number.MAX_SAFE_INTEGER });
        range.diedAt[dummies[0].id] = NOW - 500;
        Object.assign(dummies[1], { health: 35, armor: 20, pos: { x: 5, y: 5 }, vel: { x: 4, y: 0 } });
        dummies[1].wound = { by: 'player' };

        resetRange(state, NOW);

        dummies.forEach((d, i) => {
            expect(d).toMatchObject({ dead: false, health: 100, armor: 0, vel: { x: 0, y: 0 } });
            expect(d.pos).toEqual(DUMMY_SPOTS[i].pos);
            expect(d.wound).toBeUndefined();
        });
        expect(range.diedAt).toEqual({});
    });

    it('empties every pile of shots and effects', () => {
        const { state } = rangeFixture();
        state.projectiles.push({ id: 'pr' } as Projectile);
        state.beams.push({ id: 'b' } as Beam);
        state.smokes = [{ id: 's' } as SmokeCloud];
        state.particles.push({ id: 'pa' } as Particle);
        state.decals.push({ id: 'd' } as Decal);
        state.corpses.push({ id: 'c' } as GameState['corpses'][number]);
        state.floatingTexts.push({ id: 't' } as FloatingText);
        state.litTanks = [{ id: 'l' } as LitTank];

        resetRange(state, NOW);

        for (const pile of [state.projectiles, state.beams, state.smokes, state.particles, state.decals, state.corpses, state.floatingTexts, state.litTanks]) {
            expect(pile).toHaveLength(0);
        }
    });

    describe('scorch marks', () => {
        afterEach(clearMarks); // the mark list is module-level state: leave it empty for the other tests

        it('wipes the marks shots left on the walls and the floor', () => {
            const { state } = rangeFixture();
            addMark(state.platforms, 300, 800, NOW); // a shot into the floor
            addMark(state.platforms, 0, 400, NOW);   // and one into the left wall
            expect(liveMarks(NOW)).toHaveLength(2);

            resetRange(state, NOW);

            expect(liveMarks(NOW)).toHaveLength(0);
        });
    });

    it('puts the local fighter out and back to full health, where they stand', () => {
        const { state, local } = rangeFixture();
        local.health = 40;
        igniteBurn(local, 'player', NOW);
        const pos = { ...local.pos };
        resetRange(state, NOW);
        expect(local.health).toBe(100);
        expect(local.burnUntil).toBeUndefined();
        expect(local.burnTickAt).toBeUndefined();
        expect(local.pos).toEqual(pos);
    });

    it('keeps the same players and cover objects, so the physics engine keeps its bodies', () => {
        const { state } = rangeFixture();
        const playerList = state.players;
        const players = [...state.players];
        const coverList = state.cover!;
        const cover = [...state.cover!];

        resetRange(state, NOW);

        expect(state.players).toBe(playerList);
        expect(state.cover).toBe(coverList);
        expect(state.players).toHaveLength(players.length);
        expect(state.cover).toHaveLength(cover.length);
        players.forEach((p, i) => expect(state.players[i]).toBe(p));
        cover.forEach((c, i) => expect(state.cover![i]).toBe(c));
    });

    it('works on a state that never had smoke or a range record', () => {
        const { state } = rangeFixture();
        delete state.smokes;
        delete state.range;
        expect(() => resetRange(state, NOW)).not.toThrow();
        expect(state.smokes).toBeUndefined();
    });
});
