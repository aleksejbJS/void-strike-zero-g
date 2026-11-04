import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from '@testing-library/react';
import { matchSeen, reportResult } from '../../tournament/tournamentApi';
import { duelState, makeRun, renderMatch, ticket } from './tournamentMatchTestKit';

const endTournamentMatch = vi.fn();
vi.mock('../../store/uiStore', () => ({ useUIStore: () => ({ actions: { endTournamentMatch } }) }));
vi.mock('../../tournament/tournamentApi', () => ({
    matchSeen: vi.fn(), publishHost: vi.fn(), reportResult: vi.fn(), resolveStale: vi.fn(),
}));

const advance = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
const guest = () => makeRun({ role: 'guest', peerId: 'peer-h', side: 'b' });

beforeEach(() => {
    vi.useFakeTimers();
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

    it('treats 5 s without a snapshot as a vanished host and goes back to the bracket', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        const { result } = renderMatch(guest(), duelState(0, 0));
        act(() => result.current.signals.joined());
        for (let i = 0; i < 10; i++) {
            await advance(1_000);
            act(() => result.current.signals.snapshot());
        }
        expect(endTournamentMatch).not.toHaveBeenCalled();
        await advance(5_500);
        expect(endTournamentMatch).toHaveBeenCalledTimes(1);
    });

    it('a lost connection goes back to the bracket at once', () => {
        const { result } = renderMatch(guest(), duelState(0, 0));
        act(() => result.current.signals.joined());
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
