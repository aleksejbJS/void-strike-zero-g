import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { act, render } from '@testing-library/react';
import { UIProvider, useUIStore } from '../../../store/uiStore';
import { matchSeen } from '../../../tournament/tournamentApi';
import type { SeatTicket, TournamentSnapshot } from '../../../tournament/types';
import { makeSnapshot, publishHost, settle } from '../../../game/tournament/bracketFixtures';
import { useMyTurn } from './useMyTurn';
import { forgetRunHistory, markNoShow } from './runHistory';

vi.mock('../../../tournament/tournamentApi', () => ({ matchSeen: vi.fn() }));

let store: ReturnType<typeof useUIStore>;
const Probe: React.FC<{ snap: TournamentSnapshot; ticket: SeatTicket | null }> = ({ snap, ticket }) => {
    store = useUIStore();
    useMyTurn(snap, ticket);
    return null;
};
const seat = (n: number): SeatTicket => ({ tournamentId: 't1', seat: n, secret: `s${n}` });
const mount = (snap: TournamentSnapshot, ticket: SeatTicket | null) => {
    const view = render(<UIProvider><Probe snap={snap} ticket={ticket} /></UIProvider>);
    return { ...view, update: (next: TournamentSnapshot) => view.rerender(<UIProvider><Probe snap={next} ticket={ticket} /></UIProvider>) };
};

beforeEach(() => {
    (localStorage.getItem as Mock).mockReset().mockReturnValue(null);
    vi.mocked(matchSeen).mockReset().mockResolvedValue(undefined);
    forgetRunHistory();
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('useMyTurn', () => {
    it('starts a host run exactly once for a stable snapshot', () => {
        const { update } = mount(makeSnapshot(4, { bots: [1] }), seat(0));
        expect(store.state.tournamentMatch).toEqual({
            ticket: seat(0), matchId: 'm-0-0', role: 'host', withBot: true, side: 'a',
        });
        act(() => store.actions.endTournamentMatch());
        update(makeSnapshot(4, { bots: [1] })); // an equal but new snapshot object
        expect(store.state.tournamentMatch).toBeNull();
    });

    it('never starts a match it already ran, even after a remount with a stale snapshot', () => {
        const first = mount(makeSnapshot(4, { bots: [1] }), seat(0));
        act(() => store.actions.endTournamentMatch());
        first.unmount();
        mount(makeSnapshot(4, { bots: [1] }), seat(0)); // the bracket screen opens again, the row still says ready
        expect(store.state.tournamentMatch).toBeNull();
    });

    it('starts a guest run when the host peer id appears', () => {
        const ready = makeSnapshot(4);
        const { update } = mount(ready, seat(1));
        expect(store.state.tournamentMatch).toBeNull();
        update(publishHost(ready, 0, 0, 'peer-abc'));
        expect(store.state.tournamentMatch).toEqual({
            ticket: seat(1), matchId: 'm-0-0', role: 'guest', peerId: 'peer-abc', withBot: false, side: 'b',
        });
    });

    it('joins again when the host comes back under a new peer id (host reload)', () => {
        const { update } = mount(publishHost(makeSnapshot(4), 0, 0, 'peer-1'), seat(1));
        act(() => store.actions.endTournamentMatch());
        update(publishHost(makeSnapshot(4), 0, 0, 'peer-1'));
        expect(store.state.tournamentMatch).toBeNull();
        update(publishHost(makeSnapshot(4), 0, 0, 'peer-2'));
        expect(store.state.tournamentMatch).toMatchObject({ role: 'guest', peerId: 'peer-2' });
    });

    it('starts nothing and sends no heartbeat when eliminated, or without a ticket', () => {
        vi.useFakeTimers();
        const lost = settle(makeSnapshot(4), 0, 0, 0, 10, 3);
        mount(lost, seat(1));
        expect(store.state.tournamentMatch).toBeNull();
        mount(makeSnapshot(4), null);
        act(() => { vi.advanceTimersByTime(30_000); });
        expect(store.state.tournamentMatch).toBeNull();
        expect(matchSeen).not.toHaveBeenCalled();
    });

    it('sends matchSeen every 10 s while waiting for the host', () => {
        vi.useFakeTimers();
        mount(makeSnapshot(4), seat(1));
        expect(matchSeen).toHaveBeenCalledWith('m-0-0', seat(1));
        act(() => { vi.advanceTimersByTime(20_000); });
        expect(matchSeen).toHaveBeenCalledTimes(3);
    });

    it('sends matchSeen for the next match while waiting for the next round', () => {
        vi.useFakeTimers();
        mount(settle(makeSnapshot(4), 0, 0, 0, 10, 3), seat(0));
        expect(matchSeen).toHaveBeenCalledWith('m-1-0', seat(0));
    });

    it('keeps sending matchSeen for a duel it already played while the match is not settled', () => {
        vi.useFakeTimers();
        const stale = publishHost(makeSnapshot(4), 0, 0, 'peer-1');
        const first = mount(stale, seat(1)); // joins as the guest
        act(() => store.actions.endTournamentMatch()); // host vanished: back to the bracket
        first.unmount();
        vi.mocked(matchSeen).mockClear();
        mount(stale, seat(1)); // the row still says ready with the same peer id
        expect(store.state.tournamentMatch).toBeNull();
        expect(matchSeen).toHaveBeenCalledWith('m-0-0', seat(1));
        act(() => { vi.advanceTimersByTime(10_000); });
        expect(matchSeen).toHaveBeenCalledTimes(2);
    });

    it('sends no heartbeat for a match whose host it could not join (a no-show for that peer id)', () => {
        vi.useFakeTimers();
        const stale = publishHost(makeSnapshot(4), 0, 0, 'peer-1');
        const first = mount(stale, seat(1)); // joins as the guest
        markNoShow('m-0-0', 'peer-1'); // the 30 s join watchdog fired in the duel
        act(() => store.actions.endTournamentMatch());
        first.unmount();
        vi.mocked(matchSeen).mockClear();
        mount(stale, seat(1));
        act(() => { vi.advanceTimersByTime(30_000); });
        expect(store.state.tournamentMatch).toBeNull();
        expect(matchSeen).not.toHaveBeenCalled();
    });

    it('after a no-show, a new host peer id allows a fresh join, and heartbeats resume after it', () => {
        vi.useFakeTimers();
        const first = mount(publishHost(makeSnapshot(4), 0, 0, 'peer-1'), seat(1));
        markNoShow('m-0-0', 'peer-1');
        act(() => store.actions.endTournamentMatch());
        first.unmount();
        const view = mount(publishHost(makeSnapshot(4), 0, 0, 'peer-1'), seat(1));
        view.update(publishHost(makeSnapshot(4), 0, 0, 'peer-2')); // the host reloaded
        expect(store.state.tournamentMatch).toMatchObject({ role: 'guest', peerId: 'peer-2' });
        act(() => store.actions.endTournamentMatch()); // joined, then the host went silent
        view.unmount();
        vi.mocked(matchSeen).mockClear();
        mount(publishHost(makeSnapshot(4), 0, 0, 'peer-2'), seat(1));
        expect(matchSeen).toHaveBeenCalledWith('m-0-0', seat(1));
    });

    it('sends no heartbeat once the tournament is finished', () => {
        vi.useFakeTimers();
        const snap = makeSnapshot(4);
        mount({ ...snap, tournament: { ...snap.tournament, status: 'finished' } }, seat(1));
        expect(matchSeen).not.toHaveBeenCalled();
    });

    it('logs a failed heartbeat', async () => {
        const warned = vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.mocked(matchSeen).mockRejectedValue(new Error('offline'));
        mount(makeSnapshot(4), seat(1));
        await act(async () => {});
        expect(warned).toHaveBeenCalledWith(expect.stringContaining('[tournament]'), expect.any(Error));
    });
});
