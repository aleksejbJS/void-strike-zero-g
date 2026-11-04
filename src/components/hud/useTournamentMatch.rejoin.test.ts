// A guest whose link dropped mid-duel stays in the match screen and dials the host again for up to 60 s,
// heartbeating meanwhile; then it counts as a no-show and goes back to the bracket.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from '@testing-library/react';
import { matchSeen } from '../../tournament/tournamentApi';
import { duelState, makeRun, renderMatch } from './tournamentMatchTestKit';
import { forgetRunHistory, isNoShow } from '../tournament/autopilot/runHistory';

const endTournamentMatch = vi.fn();
vi.mock('../../store/uiStore', () => ({ useUIStore: () => ({ actions: { endTournamentMatch } }) }));
vi.mock('../../tournament/tournamentApi', () => ({
    matchSeen: vi.fn(), publishHost: vi.fn(), reportResult: vi.fn(), resolveStale: vi.fn(),
}));

const advance = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
const guest = () => makeRun({ role: 'guest', peerId: 'peer-h', side: 'b' });

const joinedGuest = () => {
    const rejoin = vi.fn();
    const view = renderMatch(guest(), duelState(3, 2));
    act(() => view.result.current.signals.rejoinReady(rejoin));
    act(() => view.result.current.signals.joined());
    return { ...view, rejoin };
};

beforeEach(() => {
    vi.useFakeTimers();
    forgetRunHistory();
    endTournamentMatch.mockReset();
    vi.mocked(matchSeen).mockReset().mockResolvedValue(undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('useTournamentMatch: guest reconnects', () => {
    it('a dropped link dials the host again and shows Reconnecting; getting back in ends it', async () => {
        const { result, rejoin } = joinedGuest();
        act(() => result.current.signals.disconnected());
        expect(rejoin).toHaveBeenCalledTimes(1);
        await advance(250);
        expect(result.current.reconnecting).toBe(true);
        act(() => result.current.signals.joined());
        await advance(250);
        expect(result.current.reconnecting).toBe(false);
        expect(endTournamentMatch).not.toHaveBeenCalled();
    });

    it('keeps heartbeating while it retries; a failed attempt is retried a few seconds later', async () => {
        const { result, rejoin } = joinedGuest();
        await advance(500); // the first heartbeat after joining
        vi.mocked(matchSeen).mockClear();
        act(() => result.current.signals.disconnected());
        act(() => result.current.signals.disconnected()); // the new attempt failed at once
        await advance(3_500);
        expect(rejoin).toHaveBeenCalledTimes(2);
        await advance(20_000);
        expect(matchSeen).toHaveBeenCalledTimes(2); // every 10 s, as while playing
    });

    it('not back within 60 s: a no-show (no more heartbeats from the bracket) and back to the bracket', async () => {
        const { result } = joinedGuest();
        act(() => result.current.signals.disconnected());
        await advance(59_500);
        expect(endTournamentMatch).not.toHaveBeenCalled();
        await advance(1_000);
        expect(endTournamentMatch).toHaveBeenCalledTimes(1);
        expect(isNoShow('m1', 'peer-h')).toBe(true);
    });
});
