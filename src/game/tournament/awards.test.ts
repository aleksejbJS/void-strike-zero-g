import { describe, it, expect } from 'vitest';
import { tournamentAwards } from './awards';
import { makeSnapshot, settle } from './bracketFixtures';

// Size 4: semifinals (0 vs 1) and (2 vs 3), then the final.
const NONE = { champion: false, finalist: false, flawlessMatchIds: [] };

describe('tournamentAwards: champion and finalist', () => {
    it('gives neither when every win was a walkover', () => {
        let snap = settle(makeSnapshot(4), 0, 0, 0, 0, 0, 'walkover');
        snap = settle(snap, 0, 1, 2, 0, 0, 'walkover');
        snap = settle(snap, 1, 0, 0, 0, 0, 'walkover');
        expect(tournamentAwards(snap, 0)).toEqual(NONE);
    });

    it('gives both for a played semifinal win followed by a walkover final win', () => {
        let snap = settle(makeSnapshot(4), 0, 0, 0, 10, 3, 'played');
        snap = settle(snap, 0, 1, 2, 10, 5, 'played');
        snap = settle(snap, 1, 0, 0, 0, 0, 'walkover');
        expect(tournamentAwards(snap, 0)).toMatchObject({ champion: true, finalist: true });
    });

    it('gives only finalist to a played-win semifinalist who then loses the final', () => {
        let snap = settle(makeSnapshot(4), 0, 0, 0, 10, 3);
        snap = settle(snap, 0, 1, 2, 10, 5);
        snap = settle(snap, 1, 0, 2, 7, 10);
        expect(tournamentAwards(snap, 0)).toMatchObject({ champion: false, finalist: true });
        expect(tournamentAwards(snap, 2)).toMatchObject({ champion: true, finalist: true });
    });

    it('gives nothing to a finalist who got there by walkover and lost the final', () => {
        let snap = settle(makeSnapshot(4), 0, 0, 0, 0, 0, 'walkover');
        snap = settle(snap, 0, 1, 2, 10, 5);
        snap = settle(snap, 1, 0, 2, 3, 10);
        expect(tournamentAwards(snap, 0)).toEqual(NONE);
    });

    it('gives finalist (not champion) while the final is still being played', () => {
        let snap = settle(makeSnapshot(4), 0, 0, 0, 10, 3);
        snap = settle(snap, 0, 1, 2, 10, 5);
        expect(tournamentAwards(snap, 0)).toMatchObject({ champion: false, finalist: true });
    });

    it('gives nothing to someone knocked out in the semifinal, or to a seat that is not at the tournament', () => {
        const snap = settle(makeSnapshot(4), 0, 0, 0, 10, 3);
        expect(tournamentAwards(snap, 1)).toEqual(NONE);
        expect(tournamentAwards(snap, 9)).toEqual(NONE);
    });

    it('works for an 8-bracket champion with three played wins', () => {
        let snap = makeSnapshot(8);
        for (let slot = 0; slot < 4; slot++) snap = settle(snap, 0, slot, slot * 2, 10, 4);
        snap = settle(snap, 1, 0, 0, 10, 4);
        snap = settle(snap, 1, 1, 4, 10, 4);
        snap = settle(snap, 2, 0, 0, 10, 4);
        expect(tournamentAwards(snap, 0)).toMatchObject({ champion: true, finalist: true });
        expect(tournamentAwards(snap, 4)).toMatchObject({ champion: false, finalist: true });
        expect(tournamentAwards(snap, 2)).toEqual(NONE);
    });
});

describe('tournamentAwards: flawless', () => {
    it('lists a played 10:0 win, not a walkover 0:0 and not a played 10:3', () => {
        let snap = settle(makeSnapshot(4), 0, 0, 0, 10, 0, 'played');
        snap = settle(snap, 0, 1, 2, 10, 3, 'played');
        snap = settle(snap, 1, 0, 0, 0, 0, 'walkover');
        expect(tournamentAwards(snap, 0).flawlessMatchIds).toEqual(['m-0-0']);
        expect(tournamentAwards(snap, 2).flawlessMatchIds).toEqual([]);
    });

    it('reads my score from seat B too', () => {
        const snap = settle(makeSnapshot(4), 0, 0, 1, 0, 10, 'played');
        expect(tournamentAwards(snap, 1).flawlessMatchIds).toEqual(['m-0-0']);
        expect(tournamentAwards(snap, 0).flawlessMatchIds).toEqual([]); // the 0:10 loser
    });

    it('lists every flawless win across rounds', () => {
        let snap = settle(makeSnapshot(4), 0, 0, 0, 10, 0);
        snap = settle(snap, 0, 1, 2, 10, 5);
        snap = settle(snap, 1, 0, 0, 10, 0);
        expect(tournamentAwards(snap, 0).flawlessMatchIds).toEqual(['m-0-0', 'm-1-0']);
    });
});
