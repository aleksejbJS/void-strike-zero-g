import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { achievementManager } from '../game/systems/achievements';
import { makeSnapshot, settle } from '../game/tournament/bracketFixtures';
import type { TournamentSnapshot } from './types';
import { exportStats } from '../game/stats/lifetimeStats';
import { notifyProgressChanged } from '../account/progressEvents';
import { awardTournament, forgetAwarded } from './awardTournament';

vi.mock('../account/progressEvents', () => ({ notifyProgressChanged: vi.fn() }));

// Size 4: semifinals (0 vs 1) and (2 vs 3), then the final. Seat 0 plays semifinal 0 and the final.
const semis = (aScore = 10, bScore = 3) => {
    const snap = settle(makeSnapshot(4), 0, 0, 0, aScore, bScore, 'played');
    return settle(snap, 0, 1, 2, 10, 5, 'played');
};
const finished = (winner: 0 | 2, scoreA: number, scoreB: number, by: 'played' | 'walkover' = 'played') =>
    settle(semis(), 1, 0, winner, scoreA, scoreB, by);

const unlocked = () => achievementManager.getAchievements().filter(a => a.unlocked).map(a => a.id).sort();
const stored = new Map<string, string>();

beforeEach(() => {
    stored.clear();
    (localStorage.getItem as Mock).mockImplementation((key: string) => stored.get(key) ?? null);
    (localStorage.setItem as Mock).mockImplementation((key: string, value: string) => { stored.set(key, value); });
    (localStorage.removeItem as Mock).mockImplementation((key: string) => { stored.delete(key); });
    achievementManager.reset();
    forgetAwarded();
    vi.mocked(notifyProgressChanged).mockClear();
});
afterEach(() => { vi.restoreAllMocks(); });

describe('awardTournament: champion and finalist', () => {
    it('unlocks Champion and Finalist for a played final win and syncs progress once', () => {
        awardTournament(finished(0, 10, 4), 0);
        expect(unlocked()).toEqual(['tournament_champion', 'tournament_finalist']);
        expect(notifyProgressChanged).toHaveBeenCalledTimes(1);
    });

    it('does nothing the second time with the same snapshot', () => {
        const snap = finished(0, 10, 4);
        awardTournament(snap, 0);
        const update = vi.spyOn(achievementManager, 'updateProgress');
        awardTournament(snap, 0);
        expect(update).not.toHaveBeenCalled();
        expect(notifyProgressChanged).toHaveBeenCalledTimes(1);
    });

    it('remembers across a reload through the tournamentAwarded key', () => {
        awardTournament(finished(0, 10, 4), 0);
        expect(JSON.parse(stored.get('tournamentAwarded') ?? '[]').sort()).toEqual(['champion:t1', 'finalist:t1']);
        achievementManager.reset(); // e.g. progress replaced by the cloud copy
        forgetAwarded({ keepStorage: true }); // a fresh page: memory is empty, storage is not
        awardTournament(finished(0, 10, 4), 0);
        expect(unlocked()).toEqual([]);
        expect(notifyProgressChanged).toHaveBeenCalledTimes(1);
    });

    it('gives only Finalist to the loser of the final, once the tournament is finished', () => {
        awardTournament(finished(2, 4, 10), 0);
        expect(unlocked()).toEqual(['tournament_finalist']);
        awardTournament(finished(2, 4, 10), 2);
        expect(unlocked()).toEqual(['tournament_champion', 'tournament_finalist']);
    });

    it('gives nothing for a champion whose every win was a walkover', () => {
        let snap = settle(makeSnapshot(4), 0, 0, 0, 0, 0, 'walkover');
        snap = settle(snap, 0, 1, 2, 0, 0, 'walkover');
        snap = settle(snap, 1, 0, 0, 0, 0, 'walkover');
        awardTournament(snap, 0);
        expect(unlocked()).toEqual([]);
        expect(notifyProgressChanged).not.toHaveBeenCalled();
    });

    it('waits for the tournament to finish: being in a running final earns nothing yet', () => {
        const running: TournamentSnapshot = semis();
        expect(running.tournament.status).toBe('running');
        awardTournament(running, 0);
        expect(unlocked()).toEqual([]);
        expect(notifyProgressChanged).not.toHaveBeenCalled();
        awardTournament(settle(running, 1, 0, 0, 10, 4), 0);
        expect(unlocked()).toEqual(['tournament_champion', 'tournament_finalist']);
    });

    it('does not award a seat that lost its only match', () => {
        awardTournament(finished(0, 10, 4), 1);
        expect(unlocked()).toEqual([]);
    });
});

describe('awardTournament: flawless', () => {
    it('unlocks Flawless for a played 10:0 win right away, even in a running tournament', () => {
        const snap = settle(makeSnapshot(4), 0, 0, 0, 10, 0, 'played');
        awardTournament(snap, 0);
        expect(unlocked()).toEqual(['tournament_flawless']);
        expect(notifyProgressChanged).toHaveBeenCalledTimes(1);
        expect(JSON.parse(stored.get('tournamentAwarded') ?? '[]')).toEqual(['flawless:m-0-0']);
    });

    it('does not count a 10:0 walkover, nor a close win', () => {
        awardTournament(settle(makeSnapshot(4), 0, 0, 0, 10, 0, 'walkover'), 0);
        awardTournament(settle(makeSnapshot(4), 0, 0, 0, 10, 1, 'played'), 0);
        expect(unlocked()).toEqual([]);
    });

    it('records each flawless match once', () => {
        const snap = settle(settle(makeSnapshot(4), 0, 0, 0, 10, 0), 0, 1, 2, 10, 5);
        awardTournament(snap, 0);
        const final = settle(snap, 1, 0, 0, 10, 0);
        awardTournament(final, 0);
        expect(JSON.parse(stored.get('tournamentAwarded') ?? '[]').sort())
            .toEqual(['champion:t1', 'finalist:t1', 'flawless:m-0-0', 'flawless:m-1-0']);
        expect(notifyProgressChanged).toHaveBeenCalledTimes(2);
    });
});

describe('awardTournament: tournaments won counter', () => {
    const asTournament = (snap: TournamentSnapshot, id: string): TournamentSnapshot =>
        ({ ...snap, tournament: { ...snap.tournament, id } });

    it('counts a title once, however often the same bracket is passed in', () => {
        const snap = finished(0, 10, 4);
        awardTournament(snap, 0);
        awardTournament(snap, 0);
        expect(exportStats().tournamentsWon).toBe(1);
    });

    it('counts every title and syncs again even though the achievement is already unlocked', () => {
        awardTournament(finished(0, 10, 4), 0);
        expect(notifyProgressChanged).toHaveBeenCalledTimes(1);
        awardTournament(asTournament(finished(0, 10, 4), 't2'), 0);
        expect(exportStats().tournamentsWon).toBe(2);
        expect(notifyProgressChanged).toHaveBeenCalledTimes(2);
    });

    it('does not count a lost final, a running final or a flawless win', () => {
        awardTournament(finished(2, 4, 10), 0);
        awardTournament(semis(), 0);
        awardTournament(settle(makeSnapshot(4), 0, 0, 0, 10, 0, 'played'), 0);
        expect(exportStats().tournamentsWon ?? 0).toBe(0);
    });

    it('does not count a title again after a reload', () => {
        awardTournament(finished(0, 10, 4), 0);
        forgetAwarded({ keepStorage: true });
        awardTournament(finished(0, 10, 4), 0);
        expect(exportStats().tournamentsWon).toBe(1);
    });
});
