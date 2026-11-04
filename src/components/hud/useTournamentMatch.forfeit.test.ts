// Esc during an unfinished tournament duel: the first press warns, a second within 2 s forfeits (host or guest).
// After the end screen appeared, Esc simply goes back to the bracket.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from '@testing-library/react';
import { matchSeen, reportResult } from '../../tournament/tournamentApi';
import { duelState, makeRun, renderMatch } from './tournamentMatchTestKit';
import { forgetRunHistory, hasForfeited } from '../tournament/autopilot/runHistory';
import { forgetReports, pendingReports } from '../tournament/autopilot/reportOutbox';

const endTournamentMatch = vi.fn();
vi.mock('../../store/uiStore', () => ({ useUIStore: () => ({ actions: { endTournamentMatch } }) }));
vi.mock('../../tournament/tournamentApi', () => ({
    matchSeen: vi.fn(), publishHost: vi.fn(), reportResult: vi.fn(), resolveStale: vi.fn(),
}));

const advance = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

beforeEach(() => {
    vi.useFakeTimers();
    forgetRunHistory();
    forgetReports();
    endTournamentMatch.mockReset();
    vi.mocked(matchSeen).mockReset().mockResolvedValue(undefined);
    vi.mocked(reportResult).mockReset().mockResolvedValue(undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('useTournamentMatch: Esc', () => {
    it('first Esc shows the hint for 2 s and leaves nothing', async () => {
        const { result } = renderMatch(makeRun(), duelState(3, 2));
        act(() => result.current.signals.escape());
        await advance(250);
        expect(result.current.forfeitArmed).toBe(true);
        expect(endTournamentMatch).not.toHaveBeenCalled();
        await advance(2_000);
        expect(result.current.forfeitArmed).toBe(false);
        act(() => result.current.signals.escape()); // too late for a second press: this one warns again
        expect(endTournamentMatch).not.toHaveBeenCalled();
    });

    it('a second Esc within 2 s forfeits: recorded, back to the bracket, no result reported', async () => {
        const { result } = renderMatch(makeRun({ role: 'guest', peerId: 'peer-h', side: 'b' }), duelState(3, 2));
        act(() => result.current.signals.escape());
        await advance(1_000);
        act(() => result.current.signals.escape());
        expect(hasForfeited('m1')).toBe(true);
        expect(endTournamentMatch).toHaveBeenCalledTimes(1);
        expect(reportResult).not.toHaveBeenCalled();
    });

    it('the host forfeits the same way', async () => {
        const { result } = renderMatch(makeRun(), duelState(9, 2));
        act(() => result.current.signals.escape());
        act(() => result.current.signals.escape());
        expect(hasForfeited('m1')).toBe(true);
        expect(endTournamentMatch).toHaveBeenCalledTimes(1);
    });

    it('after the end screen appeared, one Esc goes back to the bracket, and the result stays queued', async () => {
        vi.mocked(reportResult).mockRejectedValue(new Error('offline'));
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const { result, gameState } = renderMatch(makeRun(), duelState(10, 7));
        gameState.current.matchEndsAt = Date.now() + 10_000;
        await advance(500);
        act(() => result.current.signals.escape());
        expect(endTournamentMatch).toHaveBeenCalledTimes(1);
        expect(hasForfeited('m1')).toBe(false);
        expect(pendingReports()).toEqual([{ matchId: 'm1', ticket: makeRun().ticket, scoreA: 10, scoreB: 7 }]);
    });
});
