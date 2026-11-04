import { describe, it, expect, vi, beforeEach, afterEach, Mock, MockInstance } from 'vitest';
import { achievementManager } from '../game/systems/achievements';
import { makeSnapshot, settle } from '../game/tournament/bracketFixtures';
import { notifyProgressChanged } from '../account/progressEvents';
import { awardTournament, forgetAwarded } from './awardTournament';

vi.mock('../account/progressEvents', () => ({ notifyProgressChanged: vi.fn() }));

const champion = () => {
    let snap = settle(makeSnapshot(4), 0, 0, 0, 10, 3);
    snap = settle(snap, 0, 1, 2, 10, 5);
    return settle(snap, 1, 0, 0, 10, 4);
};
const unlocked = () => achievementManager.getAchievements().filter(a => a.unlocked).map(a => a.id).sort();
const tournamentWarnings = (warn: MockInstance) => warn.mock.calls.filter(([message]) => String(message).startsWith('[tournament]'));

beforeEach(() => {
    (localStorage.getItem as Mock).mockReset().mockReturnValue(null);
    (localStorage.setItem as Mock).mockReset();
    (localStorage.removeItem as Mock).mockReset();
    achievementManager.reset();
    forgetAwarded();
    vi.mocked(notifyProgressChanged).mockClear();
});
afterEach(() => { vi.restoreAllMocks(); });

describe('awardTournament: broken storage', () => {
    it('still awards once per session and warns when localStorage throws', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        (localStorage.getItem as Mock).mockImplementation(() => { throw new Error('blocked'); });
        (localStorage.setItem as Mock).mockImplementation(() => { throw new Error('blocked'); });

        awardTournament(champion(), 0);
        expect(unlocked()).toEqual(['tournament_champion', 'tournament_finalist']);
        expect(notifyProgressChanged).toHaveBeenCalledTimes(1);
        expect(tournamentWarnings(warn).length).toBeGreaterThan(0);

        const update = vi.spyOn(achievementManager, 'updateProgress');
        awardTournament(champion(), 0);
        expect(update).not.toHaveBeenCalled();
        expect(notifyProgressChanged).toHaveBeenCalledTimes(1);
    });

    it('ignores an unreadable stored value, warns, and awards', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        (localStorage.getItem as Mock).mockImplementation((key: string) => (key === 'tournamentAwarded' ? '{not json' : null));
        awardTournament(champion(), 0);
        expect(unlocked()).toEqual(['tournament_champion', 'tournament_finalist']);
        expect(tournamentWarnings(warn)).toHaveLength(1);
    });

    it('ignores a stored value of the wrong shape, warns, and awards', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        (localStorage.getItem as Mock).mockImplementation((key: string) => (key === 'tournamentAwarded' ? '{"a":1}' : null));
        awardTournament(champion(), 0);
        expect(unlocked()).toEqual(['tournament_champion', 'tournament_finalist']);
        expect(tournamentWarnings(warn)).toHaveLength(1);
    });
});
