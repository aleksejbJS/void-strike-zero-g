import { describe, it, expect } from 'vitest';
import { bracketColumns, roundName } from './bracketView';
import { makeSnapshot, publishHost, settle } from './bracketFixtures';

describe('bracketColumns', () => {
    it('gives column lengths [4,2,1] for size 8', () => {
        expect(bracketColumns(makeSnapshot(8)).map(c => c.length)).toEqual([4, 2, 1]);
    });

    it('gives column lengths [2,1] for size 4', () => {
        expect(bracketColumns(makeSnapshot(4)).map(c => c.length)).toEqual([2, 1]);
    });

    it('is empty while there are no matches (lobby)', () => {
        const lobby = { ...makeSnapshot(4), matches: [] };
        expect(bracketColumns(lobby)).toEqual([]);
    });

    it('indexes cells as [round][slot], whatever order the matches arrive in', () => {
        const snap = makeSnapshot(8);
        const shuffled = { ...snap, matches: [...snap.matches].reverse() };
        const cols = bracketColumns(shuffled);
        cols.forEach((column, round) => column.forEach((cell, slot) => {
            expect(cell.match.round).toBe(round);
            expect(cell.match.slot).toBe(slot);
        }));
    });

    it('resolves both seats of a match and leaves unknown opponents null', () => {
        const cols = bracketColumns(settle(makeSnapshot(4), 0, 0, 0, 10, 4));
        expect(cols[0][0].a?.nickname).toBe('P0');
        expect(cols[0][0].b?.nickname).toBe('P1');
        expect(cols[1][0].a?.seat).toBe(0); // the winner of slot 0 moved to seat A of the final
        expect(cols[1][0].b).toBeNull(); // slot 1 is still being played
    });

    it('treats a seat number that is not in the seat list as unknown', () => {
        const snap = makeSnapshot(4);
        const cols = bracketColumns({ ...snap, seats: snap.seats.filter(x => x.seat !== 1) });
        expect(cols[0][0].a?.seat).toBe(0);
        expect(cols[0][0].b).toBeNull();
    });

    it('is live only for a ready match whose host has published a peer id', () => {
        const ready = makeSnapshot(4);
        expect(bracketColumns(ready)[0][0].live).toBe(false);
        const published = publishHost(ready, 0, 0, 'peer-x');
        const cols = bracketColumns(published);
        expect(cols[0][0].live).toBe(true);
        expect(cols[0][1].live).toBe(false);
        // A finished match that still carries its old peer id is no longer live.
        expect(bracketColumns(settle(published, 0, 0, 0, 10, 2))[0][0].live).toBe(false);
    });
});

describe('roundName', () => {
    it('names the rounds of an 8-bracket quarterfinal, semifinal, final', () => {
        expect(roundName(0, 8)).toBe('quarterfinal');
        expect(roundName(1, 8)).toBe('semifinal');
        expect(roundName(2, 8)).toBe('final');
    });

    it('names the rounds of a 4-bracket semifinal, final', () => {
        expect(roundName(0, 4)).toBe('semifinal');
        expect(roundName(1, 4)).toBe('final');
    });
});
