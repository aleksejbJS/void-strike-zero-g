import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameMode } from '../../types';
import { createMockState } from '../../test/mocks';
import { gameEvents, GameEvent } from '../systems/events';
import { BARREL_CHAIN_MS, COVER_RETURN_MS, COVER_SPECS, Cover, CoverKind } from './coverTypes';
import { damageCover } from './coverDamage';

const NOW = 1_000_000;

let events: GameEvent[];
let unsubscribe: () => void;
beforeEach(() => { events = []; unsubscribe = gameEvents.on(e => events.push(e)); });
afterEach(() => unsubscribe());

/** A piece standing at (500, 400), at full hp unless told otherwise. */
const piece = (kind: CoverKind, hp = COVER_SPECS[kind].hp): Cover => ({ id: `${kind}_1`, kind, pos: { x: 500, y: 400 }, hp });
const stateWith = (c: Cover) => Object.assign(createMockState(GameMode.DEATHMATCH), { cover: [c] });

describe('damageCover', () => {
    it('a hit that leaves hp lowers it and tells everyone', () => {
        const c = piece('wood');
        damageCover(stateWith(c), c, 40, 'p1', NOW);

        expect(c.hp).toBe(110);
        expect(c.returnsAt).toBeUndefined();
        expect(events).toEqual([
            { type: 'COVER', action: 'hit', kind: 'wood', x: 500, y: 377 }, // the middle of the piece
            { type: 'SOUND', sound: 'cover', subtype: 'wood:hit' },
        ]);
    });

    it('breaks at zero and schedules the return', () => {
        const c = piece('wood', 30);
        damageCover(stateWith(c), c, 100, 'p1', NOW);

        expect(c.hp).toBe(0); // never below zero
        expect(c.returnsAt).toBe(NOW + COVER_RETURN_MS);
        expect(events).toEqual([
            { type: 'COVER', action: 'break', kind: 'wood', x: 500, y: 377 },
            { type: 'SOUND', sound: 'cover', subtype: 'wood:break' },
        ]);
    });

    it('extra damage on broken cover is ignored', () => {
        const c = piece('glass');
        const state = stateWith(c);
        damageCover(state, c, 1000, 'p1', NOW);
        events.length = 0;

        damageCover(state, c, 1000, 'p2', NOW + 5000);

        expect(c.hp).toBe(0);
        expect(c.returnsAt).toBe(NOW + COVER_RETURN_MS); // the return clock did not restart
        expect(events).toEqual([]);
    });

    it('ignores zero and negative damage', () => {
        const c = piece('metal');
        damageCover(stateWith(c), c, 0, 'p1', NOW);
        damageCover(stateWith(c), c, -20, 'p1', NOW);

        expect(c.hp).toBe(COVER_SPECS.metal.hp);
        expect(events).toEqual([]);
    });

    it('only a barrel gets a fuse and a credit', () => {
        const c = piece('metal');
        damageCover(stateWith(c), c, 5000, 'p1', NOW);

        expect(c.fuseAt).toBeUndefined();
        expect(c.creditId).toBeUndefined();
    });

    it('a barrel hurt but not broken keeps its fuse unlit', () => {
        const c = piece('barrel');
        damageCover(stateWith(c), c, 10, 'p1', NOW);

        expect(c.hp).toBe(70);
        expect(c.fuseAt).toBeUndefined();
        expect(c.creditId).toBeUndefined();
    });

    it('barrel broken by a shot fuses now, by a blast 150 ms later', () => {
        const shot = piece('barrel');
        const blasted = piece('barrel');
        damageCover(stateWith(shot), shot, 500, 'p1', NOW);
        damageCover(stateWith(blasted), blasted, 500, 'p1', NOW, true);

        expect(shot.fuseAt).toBe(NOW);
        expect(blasted.fuseAt).toBe(NOW + BARREL_CHAIN_MS);
        expect(BARREL_CHAIN_MS).toBe(150);
    });

    it('first breaker keeps the credit', () => {
        const c = piece('barrel');
        const state = stateWith(c);
        damageCover(state, c, 500, 'first', NOW);
        damageCover(state, c, 500, 'second', NOW + 10, true);

        expect(c.creditId).toBe('first');
        expect(c.fuseAt).toBe(NOW); // the second blow did not push the fuse back
    });
});
