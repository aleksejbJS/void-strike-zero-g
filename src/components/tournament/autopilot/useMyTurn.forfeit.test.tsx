// A duel this page forfeited (Esc, Esc) is over for it: no heartbeat, no new start, even under a new host peer id.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { act, render } from '@testing-library/react';
import { UIProvider, useUIStore } from '../../../store/uiStore';
import { matchSeen } from '../../../tournament/tournamentApi';
import type { SeatTicket, TournamentSnapshot } from '../../../tournament/types';
import { makeSnapshot, publishHost } from '../../../game/tournament/bracketFixtures';
import { myTurnState, useMyTurn } from './useMyTurn';
import { forgetRunHistory, markForfeit, markStarted } from './runHistory';

vi.mock('../../../tournament/tournamentApi', () => ({ matchSeen: vi.fn() }));

let store: ReturnType<typeof useUIStore>;
const Probe: React.FC<{ snap: TournamentSnapshot; ticket: SeatTicket }> = ({ snap, ticket }) => {
    store = useUIStore();
    useMyTurn(snap, ticket);
    return null;
};
const seat = (n: number): SeatTicket => ({ tournamentId: 't1', seat: n, secret: `s${n}` });

beforeEach(() => {
    (localStorage.getItem as Mock).mockReset().mockReturnValue(null);
    vi.mocked(matchSeen).mockReset().mockResolvedValue(undefined);
    forgetRunHistory();
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('useMyTurn after a forfeit', () => {
    it('the guest neither heartbeats nor rejoins, even when the host comes back under a new peer id', () => {
        vi.useFakeTimers();
        markForfeit('m-0-0');
        render(<UIProvider><Probe snap={publishHost(makeSnapshot(4), 0, 0, 'peer-2')} ticket={seat(1)} /></UIProvider>);
        act(() => { vi.advanceTimersByTime(30_000); });
        expect(store.state.tournamentMatch).toBeNull();
        expect(matchSeen).not.toHaveBeenCalled();
    });

    it('the host neither heartbeats nor hosts again', () => {
        vi.useFakeTimers();
        markForfeit('m-0-0');
        render(<UIProvider><Probe snap={makeSnapshot(4)} ticket={seat(0)} /></UIProvider>);
        act(() => { vi.advanceTimersByTime(30_000); });
        expect(store.state.tournamentMatch).toBeNull();
        expect(matchSeen).not.toHaveBeenCalled();
    });
});

describe('myTurnState (what the screens show, no side effects)', () => {
    it('a ready duel not started yet is not "already played"; once started it is', () => {
        const snap = makeSnapshot(4);
        expect(myTurnState(snap, seat(0))).toMatchObject({ turn: { kind: 'host' }, alreadyPlayed: false });
        markStarted('host:m-0-0');
        expect(myTurnState(snap, seat(0)).alreadyPlayed).toBe(true);
    });

    it('a forfeited duel counts as already played', () => {
        markForfeit('m-0-0');
        expect(myTurnState(publishHost(makeSnapshot(4), 0, 0, 'peer-9'), seat(1)).alreadyPlayed).toBe(true);
    });

    it('without a ticket: a spectator', () => {
        expect(myTurnState(makeSnapshot(4), null)).toEqual({ turn: { kind: 'spectator' }, alreadyPlayed: false });
    });
});
