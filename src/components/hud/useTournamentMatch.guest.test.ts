import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from '@testing-library/react';
import { matchSeen, reportResult } from '../../tournament/tournamentApi';
import { duelState, makeRun, renderMatch, ticket } from './tournamentMatchTestKit';
import { forgetRunHistory, isNoShow } from '../tournament/autopilot/runHistory';

const endTournamentMatch = vi.fn();
vi.mock('../../store/uiStore', () => ({ useUIStore: () => ({ actions: { endTournamentMatch } }) }));
vi.mock('../../tournament/tournamentApi', () => ({
    matchSeen: vi.fn(), publishHost: vi.fn(), reportResult: vi.fn(), resolveStale: vi.fn(),
}));

const advance = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
const guest = () => makeRun({ role: 'guest', peerId: 'peer-h', side: 'b' });

beforeEach(() => {
    vi.useFakeTimers();
    forgetRunHistory();
    endTournamentMatch.mockReset();
    vi.mocked(matchSeen).mockReset().mockResolvedValue(undefined);
    vi.mocked(reportResult).mockReset().mockResolvedValue(undefined);
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('useTournamentMatch: guest', () => {
    it('sends heartbeats only after joining', async () => {
        const { result } = renderMatch(guest(), duelState(0, 0));
        await advance(15_000);
        expect(matchSeen).not.toHaveBeenCalled();
        act(() => result.current.signals.joined());
        await advance(500);
        expect(matchSeen).toHaveBeenCalledWith('m1', ticket);
    });

    it('treats 5 s without a snapshot as a lost link: reconnects instead of leaving', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const rejoin = vi.fn();
        const { result } = renderMatch(guest(), duelState(0, 0));
        act(() => result.current.signals.rejoinReady(rejoin));
        act(() => result.current.signals.joined());
        for (let i = 0; i < 10; i++) {
            await advance(1_000);
            act(() => result.current.signals.snapshot());
        }
        expect(rejoin).not.toHaveBeenCalled();
        await advance(5_500);
        expect(rejoin).toHaveBeenCalledTimes(1);
        expect(result.current.reconnecting).toBe(true);
        expect(endTournamentMatch).not.toHaveBeenCalled();
    });

    it('gives up on a host it cannot join within 50 s', async () => {
        const warned = vi.spyOn(console, 'warn').mockImplementation(() => {});
        renderMatch(guest(), duelState(0, 0));
        await advance(49_500);
        expect(endTournamentMatch).not.toHaveBeenCalled();
        await advance(1_000);
        expect(endTournamentMatch).toHaveBeenCalledTimes(1);
        expect(warned).toHaveBeenCalledWith(expect.stringContaining('[tournament]'));
        expect(isNoShow('m1', 'peer-h')).toBe(true); // useMyTurn stops heartbeating that match
    });

    it('a link lost before joining is a no-show too', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { result } = renderMatch(guest(), duelState(0, 0));
        act(() => result.current.signals.disconnected());
        expect(endTournamentMatch).toHaveBeenCalledTimes(1);
        expect(isNoShow('m1', 'peer-h')).toBe(true);
    });

    it('joining before 50 s cancels the join deadline', async () => {
        const { result } = renderMatch(guest(), duelState(0, 0));
        await advance(40_000);
        act(() => result.current.signals.joined());
        for (let i = 0; i < 20; i++) {
            await advance(1_000);
            act(() => result.current.signals.snapshot());
        }
        expect(endTournamentMatch).not.toHaveBeenCalled();
        expect(isNoShow('m1', 'peer-h')).toBe(false);
    });

    it('a lost connection after the end screen goes back to the bracket at once', async () => {
        const { result, gameState } = renderMatch(guest(), duelState(7, 10));
        act(() => result.current.signals.joined());
        gameState.current.matchEndsAt = Date.now() + 10_000;
        act(() => result.current.signals.disconnected());
        expect(endTournamentMatch).toHaveBeenCalledTimes(1);
    });

    it('never reports a result, and goes back to the bracket 8 s after the end screen', async () => {
        const { result, gameState } = renderMatch(guest(), duelState(7, 10));
        act(() => result.current.signals.joined());
        gameState.current.matchEndsAt = Date.now() + 10_000;
        for (let i = 0; i < 9; i++) { // the end is noticed on the next poll, then 8 s
            await advance(1_000);
            act(() => result.current.signals.snapshot());
        }
        expect(reportResult).not.toHaveBeenCalled();
        expect(endTournamentMatch).toHaveBeenCalledTimes(1);
    });
});
