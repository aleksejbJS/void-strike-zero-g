import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from '@testing-library/react';
import { matchSeen, publishHost, reportResult, resolveStale } from '../../tournament/tournamentApi';
import { TournamentError } from '../../tournament/types';
import { duelState, fighter, makeRun, renderMatch, ticket } from './tournamentMatchTestKit';
import { forgetReports } from '../tournament/autopilot/reportOutbox';

const endTournamentMatch = vi.fn();
vi.mock('../../store/uiStore', () => ({ useUIStore: () => ({ actions: { endTournamentMatch } }) }));
vi.mock('../../tournament/tournamentApi', () => ({
    matchSeen: vi.fn(), publishHost: vi.fn(), reportResult: vi.fn(), resolveStale: vi.fn(),
}));

const advance = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

beforeEach(() => {
    vi.useFakeTimers();
    forgetReports();
    endTournamentMatch.mockReset();
    for (const f of [matchSeen, publishHost, reportResult, resolveStale]) vi.mocked(f).mockReset().mockResolvedValue(undefined);
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('useTournamentMatch: host', () => {
    it('does nothing without a run', async () => {
        renderMatch(null, duelState(0, 0));
        await advance(120_000);
        expect(matchSeen).not.toHaveBeenCalled();
        expect(endTournamentMatch).not.toHaveBeenCalled();
    });

    it('sends a heartbeat from the start and every 10 s', async () => {
        renderMatch(makeRun(), duelState(0, 0));
        await advance(0);
        expect(matchSeen).toHaveBeenCalledTimes(1);
        expect(matchSeen).toHaveBeenCalledWith('m1', ticket);
        await advance(20_000);
        expect(matchSeen).toHaveBeenCalledTimes(3);
    });

    it('publishes its peer id, retrying a failed publish', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.mocked(publishHost).mockRejectedValueOnce(new TournamentError('unknown', 'boom'));
        const { result } = renderMatch(makeRun(), duelState(0, 0));
        act(() => result.current.signals.inviteReady('peer-1'));
        await advance(0);
        expect(publishHost).toHaveBeenCalledWith('m1', ticket, 'peer-1');
        expect(result.current.error).not.toBeNull();
        await advance(5_000);
        expect(publishHost).toHaveBeenCalledTimes(2);
        expect(result.current.error).toBeNull(); // the retry went through
    });

    it('reports the result once when the end screen appears, then goes back to the bracket 8 s later', async () => {
        const { gameState } = renderMatch(makeRun(), duelState(10, 7));
        await advance(1_000);
        gameState.current.matchEndsAt = Date.now() + 10_000;
        await advance(500);
        expect(reportResult).toHaveBeenCalledTimes(1);
        expect(reportResult).toHaveBeenCalledWith('m1', ticket, 10, 7);
        await advance(7_000);
        expect(endTournamentMatch).not.toHaveBeenCalled();
        await advance(1_000);
        expect(endTournamentMatch).toHaveBeenCalledTimes(1);
        expect(reportResult).toHaveBeenCalledTimes(1);
    });

    it('reports seat A first when the host sits at seat B', async () => {
        const { gameState } = renderMatch(makeRun({ side: 'b' }), duelState(10, 7));
        gameState.current.matchEndsAt = Date.now() + 10_000;
        await advance(500);
        expect(reportResult).toHaveBeenCalledWith('m1', ticket, 7, 10);
    });

    it('takes the opponent score from the other player or bot only, never another entity', async () => {
        const state = duelState(10, null);
        state.players.unshift(fighter('ghost', 9, 'decoy'));
        state.players.push(fighter('bot_0', 4, 'bot'));
        const { gameState } = renderMatch(makeRun(), state);
        gameState.current.matchEndsAt = Date.now() + 10_000;
        await advance(500);
        expect(reportResult).toHaveBeenCalledWith('m1', ticket, 10, 4);
    });

    it('counts the end screen down to the return to the bracket', async () => {
        const { result, gameState } = renderMatch(makeRun(), duelState(10, 7));
        expect(result.current.backInSec).toBe(8);
        gameState.current.matchEndsAt = Date.now() + 10_000;
        await advance(250);
        expect(result.current.backInSec).toBe(8);
        await advance(3_000);
        expect(result.current.backInSec).toBe(5);
    });

    it('a rejected report is logged and shown, not thrown', async () => {
        const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.mocked(reportResult).mockRejectedValue(new TournamentError('bad_ticket'));
        const { result, gameState } = renderMatch(makeRun(), duelState(10, 7));
        gameState.current.matchEndsAt = Date.now() + 10_000;
        await advance(500);
        expect(logged).toHaveBeenCalledWith(expect.stringContaining('[tournament]'), expect.any(TournamentError));
        expect(result.current.error).toBe('Tournament server: This browser no longer holds your seat.');
        await advance(8_000);
        expect(endTournamentMatch).toHaveBeenCalledTimes(1); // still goes back to the bracket
    });

    it('an opponent missing for 60 s: asks the server to settle, then goes back to the bracket', async () => {
        const warned = vi.spyOn(console, 'warn').mockImplementation(() => {});
        renderMatch(makeRun(), duelState(3, null));
        await advance(59_000);
        expect(resolveStale).not.toHaveBeenCalled();
        await advance(1_500);
        expect(resolveStale).toHaveBeenCalledWith('t1');
        expect(endTournamentMatch).toHaveBeenCalledTimes(1);
        expect(warned).toHaveBeenCalledWith(expect.stringContaining('[tournament]'));
    });

    it('does not go back to the bracket after the duel closed while resolveStale was in flight', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        let settle: () => void = () => {};
        vi.mocked(resolveStale).mockReturnValue(new Promise<void>(resolve => { settle = resolve; }));
        const { rerender } = renderMatch(makeRun(), duelState(3, null));
        await advance(60_500);
        rerender({ r: null }); // e.g. Escape: the run is gone already
        await act(async () => { settle(); });
        expect(endTournamentMatch).not.toHaveBeenCalled();
    });

    it('an opponent who comes back resets the 60 s', async () => {
        const { gameState } = renderMatch(makeRun(), duelState(3, null));
        await advance(50_000);
        gameState.current = duelState(3, 2);
        await advance(1_000);
        gameState.current = duelState(3, null);
        await advance(50_000);
        expect(resolveStale).not.toHaveBeenCalled();
    });

    it('stops all timers when the run ends', async () => {
        const { rerender } = renderMatch(makeRun(), duelState(0, 0));
        await advance(0);
        rerender({ r: null });
        await advance(120_000);
        expect(matchSeen).toHaveBeenCalledTimes(1);
    });
});
