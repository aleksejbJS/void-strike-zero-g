import { describe, it, expect } from 'vitest';
import { bracketColumns } from '../../../game/tournament/bracketView';
import { makeSnapshot, patchMatch } from '../../../game/tournament/bracketFixtures';
import { liveScore } from './liveScore';

const cell = (hostSeat = 0) => bracketColumns(patchMatch(makeSnapshot(4), 0, 0, { hostSeat }))[0][0]; // P0 vs P1

describe('liveScore', () => {
    it('matches the players to the seats by name', () => {
        expect(liveScore(cell(), [{ name: 'P1', score: 2 }, { name: 'P0', score: 5 }])).toEqual([5, 2]);
    });

    it('one known name places the other player on the other seat', () => {
        expect(liveScore(cell(), [{ name: 'Ghost', score: 3 }, { name: 'P1', score: 1 }])).toEqual([3, 1]);
    });

    it('without known names the first player is the host', () => {
        const players = [{ name: 'Alpha', score: 4 }, { name: 'Beta', score: 6 }];
        expect(liveScore(cell(0), players)).toEqual([4, 6]);
        expect(liveScore(cell(1), players)).toEqual([6, 4]);
    });

    it('has no score until both players are in', () => {
        expect(liveScore(cell(), [{ name: 'P0', score: 0 }])).toBeNull();
        expect(liveScore(cell(), undefined)).toBeNull();
    });
});
