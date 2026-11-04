import { describe, it, expect } from 'vitest';
import { makeSnapshot, publishHost, settle } from '../../../game/tournament/bracketFixtures';
import { audibleTile, layoutFor, liveCells, swipeStep, watchedCells } from './watchLayout';

const ids = (cells: { match: { id: string } }[]) => cells.map(c => c.match.id);

describe('layoutFor', () => {
    it('1 tile fills the screen, 2 sit side by side, 3 and 4 make a 2x2 grid', () => {
        expect(layoutFor(1, false)).toEqual({ cols: 1, rows: 1 });
        expect(layoutFor(2, false)).toEqual({ cols: 2, rows: 1 });
        expect(layoutFor(3, false)).toEqual({ cols: 2, rows: 2 });
        expect(layoutFor(4, false)).toEqual({ cols: 2, rows: 2 });
    });

    it('a phone always shows one tile', () => {
        expect(layoutFor(4, true)).toEqual({ cols: 1, rows: 1 });
        expect(layoutFor(2, true)).toEqual({ cols: 1, rows: 1 });
    });

    it('no tile at all still has a 1x1 frame', () => {
        expect(layoutFor(0, false)).toEqual({ cols: 1, rows: 1 });
    });
});

describe('liveCells / watchedCells', () => {
    it('only ready matches with a published host are live, in bracket order', () => {
        let s = makeSnapshot(8);
        s = publishHost(s, 0, 2, 'peer-2');
        s = publishHost(s, 0, 0, 'peer-0');
        expect(ids(liveCells(s))).toEqual(['m-0-0', 'm-0-2']);
    });

    it('a finished match drops out and the next live one takes its place', () => {
        let s = makeSnapshot(8);
        for (const slot of [0, 1, 2, 3]) s = publishHost(s, 0, slot, `peer-${slot}`);
        s = settle(s, 0, 0, 0, 10, 3);
        s = settle(s, 0, 1, 2, 10, 4);
        s = publishHost(s, 1, 0, 'peer-sf');
        expect(ids(liveCells(s))).toEqual(['m-0-2', 'm-0-3', 'm-1-0']);
    });

    it('watches every live match by default, minus the unticked ones, at most 4', () => {
        let s = makeSnapshot(8);
        for (const slot of [0, 1, 2, 3]) s = publishHost(s, 0, slot, `peer-${slot}`);
        const live = liveCells(s);
        expect(ids(watchedCells(live, new Set()))).toEqual(['m-0-0', 'm-0-1', 'm-0-2', 'm-0-3']);
        expect(ids(watchedCells(live, new Set(['m-0-1'])))).toEqual(['m-0-0', 'm-0-2', 'm-0-3']);
        const five = [...live, { ...live[0], match: { ...live[0].match, id: 'extra' } }];
        expect(watchedCells(five, new Set())).toHaveLength(4);
    });
});

describe('audibleTile', () => {
    const watched = ['a', 'b', 'c'];
    it('is the expanded tile first, then the last clicked, then the first', () => {
        expect(audibleTile(watched, 'c', 'b')).toBe('c');
        expect(audibleTile(watched, null, 'b')).toBe('b');
        expect(audibleTile(watched, null, null)).toBe('a');
    });

    it('ignores tiles that are no longer watched', () => {
        expect(audibleTile(watched, 'gone', 'gone')).toBe('a');
        expect(audibleTile([], null, null)).toBeNull();
    });
});

describe('swipeStep', () => {
    it('a swipe of more than 60 px moves one match; shorter ones do nothing', () => {
        expect(swipeStep(-61)).toBe(1);
        expect(swipeStep(61)).toBe(-1);
        expect(swipeStep(-60)).toBe(0);
        expect(swipeStep(40)).toBe(0);
    });
});
