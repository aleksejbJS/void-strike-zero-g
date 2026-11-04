// The autopilot under the tournament screens: my duel starts from the watch screen and the list too, and the
// watch screen says so while it is being set up.

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { UIProvider, useUIStore } from '../../store/uiStore';
import { AccountContext } from '../../account/useAccount';
import { stubAccount } from '../../test/accountStub';
import { listOpen, loadListDetails, loadSnapshot } from '../../tournament/tournamentApi';
import { watchTournament } from '../../tournament/tournamentFeed';
import type { SeatTicket, TournamentSnapshot } from '../../tournament/types';
import { makeSnapshot, publishHost, settle } from '../../game/tournament/bracketFixtures';
import { TournamentScreens } from './TournamentScreens';
import { forgetRunHistory } from './autopilot/runHistory';
import { forgetRetired } from './autopilot/TournamentAutopilot';

const ticket: SeatTicket = { tournamentId: 't1', seat: 1, secret: 's1' };
vi.mock('../../tournament/tournamentApi', () => ({
    loadSnapshot: vi.fn(), resolveStale: vi.fn(async () => {}), listOpen: vi.fn(), loadListDetails: vi.fn(),
    matchSeen: vi.fn(async () => {}), lobbySeen: vi.fn(async () => {}), reportResult: vi.fn(async () => {}),
}));
vi.mock('../../tournament/tournamentFeed', () => ({ watchTournament: vi.fn() }));
vi.mock('../../tournament/seatStore', () => ({
    saveTicket: vi.fn(), forgetTicket: vi.fn(), onTicketsChanged: () => () => {},
    heldTickets: () => [{ tournamentId: 't1', seat: 1, secret: 's1' }],
    ticketFor: (id: string) => (id === 't1' ? { tournamentId: 't1', seat: 1, secret: 's1' } : null),
}));
vi.mock('./watch/MatchTile', () => import('./watch/fakeMatchTile').then(k => ({ MatchTile: k.FakeTile })));

let feed: (s: TournamentSnapshot) => void;
let store: ReturnType<typeof useUIStore>;
const Spy: React.FC = () => { store = useUIStore(); return null; };
const renderAt = async (open: (s: typeof store) => void) => {
    render(
        <UIProvider><Spy />
            <AccountContext.Provider value={stubAccount({ status: 'guest' })}><TournamentScreens onCustomize={vi.fn()} /></AccountContext.Provider>
        </UIProvider>,
    );
    act(() => open(store));
    await act(async () => {});
};
const lobby = (): TournamentSnapshot => {
    const s = makeSnapshot(4, { status: 'lobby' });
    return { ...s, tournament: { ...s.tournament, createdAt: new Date().toISOString() }, matches: [] };
};

beforeEach(() => {
    (localStorage.getItem as Mock).mockReset().mockReturnValue(null);
    forgetRunHistory();
    forgetRetired();
    vi.mocked(watchTournament).mockReset().mockImplementation((_id, onSnapshot) => { feed = onSnapshot; return () => {}; });
    vi.mocked(listOpen).mockReset().mockResolvedValue([]);
    vi.mocked(loadListDetails).mockReset().mockResolvedValue({ seats: [], matches: [] });
    vi.mocked(loadSnapshot).mockReset().mockResolvedValue(makeSnapshot(4));
});
afterEach(() => { vi.restoreAllMocks(); });

describe('TournamentScreens with the autopilot', () => {
    it('on the watch screen: says my match is starting, then joins it once the host is up', async () => {
        await renderAt(s => s.actions.openWatch('t1'));
        expect(screen.getByRole('status')).toHaveTextContent('Your match is starting…');
        expect(store.state.tournamentMatch).toBeNull(); // the host (seat 0) has not published yet
        act(() => feed(publishHost(makeSnapshot(4), 0, 0, 'peer-h')));
        expect(store.state.tournamentMatch).toEqual({
            ticket, matchId: 'm-0-0', role: 'guest', peerId: 'peer-h', withBot: false, side: 'b',
        });
    });

    it('on the list: the duel starts when the creator presses Start', async () => {
        vi.mocked(loadSnapshot).mockResolvedValue(lobby());
        await renderAt(s => s.actions.openTournaments());
        expect(screen.getByRole('heading', { name: 'Open tournaments' })).toBeInTheDocument();
        act(() => feed(publishHost(makeSnapshot(4), 0, 0, 'peer-h')));
        expect(store.state.tournamentMatch).toMatchObject({ matchId: 'm-0-0', role: 'guest', peerId: 'peer-h' });
    });

    it('the watch screen shows no such banner to a player who is out', async () => {
        vi.mocked(loadSnapshot).mockResolvedValue(publishHost(settle(makeSnapshot(4), 0, 0, 0, 10, 3), 0, 1, 'peer-x'));
        await renderAt(s => s.actions.openWatch('t1'));
        expect(screen.queryByText('Your match is starting…')).not.toBeInTheDocument();
        expect(store.state.tournamentMatch).toBeNull();
    });
});
