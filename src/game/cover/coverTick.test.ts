import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameMode, Team } from '../../types';
import { createMockPlayer, createMockState } from '../../test/mocks';
import { gameEvents, GameEvent } from '../systems/events';
import { updatePhysics } from '../systems/physics';
import { COVER_RETRY_MS, COVER_RETURN_MS, COVER_SPECS, Cover, CoverKind } from './coverTypes';
import { coverRect, isIntact } from './coverGeometry';
import { damageCover } from './coverDamage';
import { restoreAllCover, tickCover } from './coverTick';

const NOW = 1_000_000;
const DUE = NOW + COVER_RETURN_MS;

let events: GameEvent[];
let unsubscribe: () => void;
beforeEach(() => { events = []; unsubscribe = gameEvents.on(e => events.push(e)); });
afterEach(() => unsubscribe());

const piece = (kind: CoverKind, hp = COVER_SPECS[kind].hp): Cover => ({ id: `${kind}_1`, kind, pos: { x: 500, y: 400 }, hp });
const stateWith = (...cover: Cover[]) => Object.assign(createMockState(GameMode.DEATHMATCH), { cover });
/** A crate broken at NOW, so it is due back at DUE. */
const brokenCrate = () => { const c = piece('wood'); damageCover(stateWith(c), c, 1000, 'p1', NOW); events.length = 0; return c; };

describe('tickCover: return', () => {
    it('returns after 35 s at full hp', () => {
        const c = brokenCrate();
        const state = stateWith(c);

        tickCover(state, DUE - 1);
        expect(c.hp).toBe(0);
        expect(events).toEqual([]);

        tickCover(state, DUE);
        expect(c.hp).toBe(COVER_SPECS.wood.hp);
        expect(isIntact(c)).toBe(true);
        expect(c.returnsAt).toBeUndefined();
        expect(events).toEqual([{ type: 'COVER', action: 'restore', kind: 'wood', x: 500, y: 377 }]);
    });

    it('a live fighter on the spot delays the return by 500 ms', () => {
        const c = brokenCrate();
        const state = stateWith(c);
        const p = createMockPlayer('p1', Team.NONE);
        p.pos = { x: 510, y: 400 }; // stands where the crate belongs
        state.players.push(p);

        tickCover(state, DUE);
        expect(c.hp).toBe(0);
        expect(c.returnsAt).toBe(DUE + COVER_RETRY_MS);
        expect(events).toEqual([]);

        p.pos = { x: 900, y: 400 }; // steps aside
        tickCover(state, DUE + COVER_RETRY_MS - 1);
        expect(c.hp).toBe(0);
        tickCover(state, DUE + COVER_RETRY_MS);
        expect(c.hp).toBe(COVER_SPECS.wood.hp);
    });

    it('a fighter standing beside the spot does not delay it', () => {
        const c = brokenCrate();
        const state = stateWith(c);
        const p = createMockPlayer('p1', Team.NONE);
        const { x, w } = coverRect(c);
        p.pos = { x: x + w + p.width / 2, y: 400 }; // touching the crate's side, not overlapping
        state.players.push(p);

        tickCover(state, DUE);

        expect(isIntact(c)).toBe(true);
    });

    it('dead fighters do not block a return', () => {
        const c = brokenCrate();
        const state = stateWith(c);
        const p = createMockPlayer('p1', Team.NONE);
        p.pos = { x: 500, y: 400 };
        p.dead = true;
        state.players.push(p);

        tickCover(state, DUE);

        expect(isIntact(c)).toBe(true);
    });

    it('leaves intact cover and a state without cover alone', () => {
        const c = piece('wood', 100);
        tickCover(stateWith(c), DUE);
        expect(c.hp).toBe(100);
        expect(events).toEqual([]);

        expect(() => tickCover(createMockState(GameMode.DUEL), DUE)).not.toThrow();
    });

    it('a returned barrel is unlit and has no credit left', () => {
        const barrel = piece('barrel');
        const state = stateWith(barrel);
        damageCover(state, barrel, 500, 'p1', NOW);
        tickCover(state, NOW); // the fuse goes off now

        tickCover(state, DUE);

        expect(barrel.hp).toBe(COVER_SPECS.barrel.hp);
        expect(barrel.fuseAt).toBeUndefined();
        expect(barrel.creditId).toBeUndefined();
    });

    it('runs inside updatePhysics', () => {
        const c = piece('wood', 0);
        c.returnsAt = 1; // long overdue
        const state = stateWith(c);
        state.players.push(createMockPlayer('p1', Team.NONE));

        updatePhysics(state, {}, { x: 0, y: 0 }, false, false, 800, 600, () => ({ x: 0, y: 0 }), 'p1');

        expect(isIntact(c)).toBe(true);
    });
});

describe('tickCover: barrel fuse', () => {
    it('a fuse that is not due yet stays lit; a due one is spent', () => {
        const barrel = piece('barrel');
        const state = stateWith(barrel);
        damageCover(state, barrel, 500, 'p1', NOW, true);

        tickCover(state, NOW + 149);
        expect(barrel.fuseAt).toBe(NOW + 150);

        tickCover(state, NOW + 150);
        expect(barrel.fuseAt).toBeUndefined();
    });
});

describe('restoreAllCover', () => {
    it('gives every piece full hp and clears its timers, fuse and credit', () => {
        const wood = piece('wood');
        const barrel = piece('barrel');
        const hurt = piece('metal', 120);
        const state = stateWith(wood, barrel, hurt);
        damageCover(state, wood, 1000, 'p1', NOW);
        damageCover(state, barrel, 1000, 'p1', NOW, true);
        events.length = 0;

        restoreAllCover(state);

        for (const c of state.cover) {
            expect(c.hp).toBe(COVER_SPECS[c.kind].hp);
            expect(c.returnsAt).toBeUndefined();
            expect(c.fuseAt).toBeUndefined();
            expect(c.creditId).toBeUndefined();
        }
        expect(events).toEqual([]); // a reset is silent
    });

    it('does nothing in a state without cover', () => {
        expect(() => restoreAllCover(createMockState(GameMode.DUEL))).not.toThrow();
    });

    it('reset clears pending fuses', () => {
        const barrel = piece('barrel');
        const state = stateWith(barrel);
        damageCover(state, barrel, 1000, 'p1', NOW, true); // fuse pending
        events.length = 0;

        restoreAllCover(state);
        tickCover(state, NOW + 1_000_000);

        expect(events.filter(e => e.type === 'EFFECT' && e.effect === 'explosion')).toEqual([]);
        expect(barrel.fuseAt).toBeUndefined();
        expect(barrel.hp).toBe(COVER_SPECS.barrel.hp);
    });
});
