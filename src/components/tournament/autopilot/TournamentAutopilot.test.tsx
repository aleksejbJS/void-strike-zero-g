// The autopilot runs for every held ticket whatever tournament screen is open: it starts my duel from the
// list or the watch screen too, keeps my lobby seat present, and retries queued results.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { act, render } from '@testing-library/react';
import { UIProvider, useUIStore } from '../../../store/uiStore';
import { heldTickets } from '../../../tournament/seatStore';
import { loadSnapshot, lobbySeen, matchSeen, reportResult, resolveStale } from '../../../tournament/tournamentApi';
import { watchTournament } from '../../../tournament/tournamentFeed';
import { TournamentError, type SeatTicket, type TournamentSnapshot } from '../../../tournament/types';
import { makeSnapshot } from '../../../game/tournament/bracketFixtures';
import { TournamentAutopilot, forgetRetired } from './TournamentAutopilot';
import { forgetRunHistory } from './runHistory';
import { forgetReports, pendingReports, queueReport } from './reportOutbox';

vi.mock('../../../tournament/tournamentApi', () => ({
    loadSnapshot: vi.fn(), resolveStale: vi.fn(), matchSeen: vi.fn(), lobbySeen: vi.fn(), reportResult: vi.fn(),
}));
vi.mock('../../../tournament/tournamentFeed', () => ({ watchTournament: vi.fn() }));
vi.mock('../../../tournament/seatStore', () => ({ heldTickets: vi.fn(), onTicketsChanged: () => () => {} }));

const mine: SeatTicket = { tournamentId: 't1', seat: 0, secret: 's0' };
let feed: (s: TournamentSnapshot) => void;
let store: ReturnType<typeof useUIStore>;
const Spy: React.FC = () => { store = useUIStore(); return null; };
const mount = () => render(<UIProvider><Spy /><TournamentAutopilot /></UIProvider>);
const flush = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });
const lobby = (): TournamentSnapshot => {
    const s = makeSnapshot(4, { status: 'lobby' });
    return { ...s, tournament: { ...s.tournament, createdAt: new Date().toISOString() }, matches: [] };
};
const withStatus = (s: TournamentSnapshot, status: TournamentSnapshot['tournament']['status']) => ({ ...s, tournament: { ...s.tournament, status } });

beforeEach(() => {
    vi.useFakeTimers();
    (localStorage.getItem as Mock).mockReset().mockReturnValue(null);
    forgetRunHistory();
    forgetReports();
    forgetRetired();
    vi.mocked(heldTickets).mockReset().mockReturnValue([mine]);
    vi.mocked(watchTournament).mockReset().mockImplementation((_id, onSnapshot) => { feed = onSnapshot; return () => {}; });
    for (const f of [matchSeen, lobbySeen, reportResult, resolveStale]) vi.mocked(f).mockReset().mockResolvedValue(undefined);
    vi.mocked(loadSnapshot).mockReset().mockResolvedValue(lobby());
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('TournamentAutopilot', () => {
    it('starts my duel when the creator presses Start while I am elsewhere', async () => {
        mount();
        await flush();
        expect(store.state.tournamentMatch).toBeNull();
        act(() => feed(makeSnapshot(4, { bots: [1] }))); // Start pressed: my match is ready, I host it
        expect(store.state.tournamentMatch).toMatchObject({ matchId: 'm-0-0', role: 'host', withBot: true });
    });

    it('keeps my lobby seat present: lobbySeen now and every 15 s, nothing once it runs', async () => {
        mount();
        await flush();
        expect(lobbySeen).toHaveBeenCalledWith(mine);
        await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
        expect(lobbySeen).toHaveBeenCalledTimes(3);
        act(() => feed(withStatus(makeSnapshot(4), 'running')));
        await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
        expect(lobbySeen).toHaveBeenCalledTimes(3);
    });

    it('logs a failed lobby heartbeat', async () => {
        const warned = vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.mocked(lobbySeen).mockRejectedValue(new TournamentError('unknown', 'Failed to fetch'));
        mount();
        await flush();
        expect(warned).toHaveBeenCalledWith(expect.stringContaining('[tournament]'), expect.any(TournamentError));
    });

    it('lets go of a finished tournament: no heartbeat, no feed', async () => {
        vi.mocked(loadSnapshot).mockResolvedValue(withStatus(makeSnapshot(4), 'finished'));
        const stop = vi.fn();
        vi.mocked(watchTournament).mockImplementation(() => stop);
        mount();
        await flush();
        await flush();
        expect(stop).toHaveBeenCalled();
        await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
        expect(matchSeen).not.toHaveBeenCalled();
        expect(lobbySeen).not.toHaveBeenCalled();
    });

    it('lets go of a lobby nobody started within 30 min', async () => {
        const old = lobby();
        old.tournament.createdAt = new Date(Date.now() - 31 * 60_000).toISOString();
        vi.mocked(loadSnapshot).mockResolvedValue(old);
        mount();
        await flush();
        await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
        expect(lobbySeen).not.toHaveBeenCalled();
    });

    it('retries a result whose first report failed after the duel screen closed', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.mocked(heldTickets).mockReturnValue([]);
        vi.mocked(reportResult).mockRejectedValueOnce(new TournamentError('unknown', 'Failed to fetch'));
        await queueReport({ matchId: 'm-0-0', ticket: mine, scoreA: 10, scoreB: 4 }); // the duel is gone by now
        expect(pendingReports()).toHaveLength(1);
        mount();
        await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
        expect(reportResult).toHaveBeenCalledTimes(2);
        expect(pendingReports()).toEqual([]);
    });
});
