import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { UIProvider, useUIStore } from '../../store/uiStore';
import { AccountContext } from '../../account/useAccount';
import { stubAccount } from '../../test/accountStub';
import { listOpen, loadListDetails, loadSnapshot } from '../../tournament/tournamentApi';
import { TournamentError, type TournamentSnapshot, type TournamentStatus } from '../../tournament/types';
import { TournamentScreens } from './TournamentScreens';

vi.mock('../../tournament/tournamentApi', () => ({
    loadSnapshot: vi.fn(), resolveStale: vi.fn(), listOpen: vi.fn(), loadListDetails: vi.fn(),
}));
vi.mock('../../tournament/tournamentFeed', () => ({ watchTournament: () => () => {} }));
vi.mock('../../tournament/seatStore', () => ({ saveTicket: vi.fn(), ticketFor: () => null, forgetTicket: vi.fn() }));

const T_ID = '11111111-1111-4111-8111-111111111111';
const snap = (status: TournamentStatus): TournamentSnapshot => ({
    tournament: {
        id: T_ID, name: 'Friday grinder', status, size: 4, creatorSeat: 0,
        createdAt: '', startedAt: null, finishedAt: null, championSeat: null,
    },
    seats: [],
    matches: [],
});

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

beforeEach(() => {
    (localStorage.getItem as Mock).mockReset().mockReturnValue(null);
    vi.mocked(listOpen).mockReset().mockResolvedValue([]);
    vi.mocked(loadListDetails).mockReset().mockResolvedValue({ seats: [], matches: [] });
    vi.mocked(loadSnapshot).mockReset().mockResolvedValue(snap('lobby'));
});

afterEach(() => { vi.restoreAllMocks(); });

describe('TournamentScreens', () => {
    it('shows the list', async () => {
        await renderAt(s => s.actions.openTournaments());
        expect(screen.getByRole('heading', { name: 'Open tournaments' })).toBeInTheDocument();
        expect(screen.getByText('No open tournaments yet. Create one!')).toBeInTheDocument();
    });

    it('shows the lobby of a tournament that has not started, and Back leads to the list', async () => {
        vi.mocked(loadSnapshot).mockResolvedValue(snap('lobby'));
        await renderAt(s => s.actions.openTournament(T_ID));
        expect(screen.getByText('1v1 · first to 10 · The Pit')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Back' }));
        expect(store.state.tournamentNav).toEqual({ view: 'list' });
    });

    it('shows a placeholder for a running tournament (the bracket comes later)', async () => {
        vi.mocked(loadSnapshot).mockResolvedValue(snap('running'));
        await renderAt(s => s.actions.openTournament(T_ID));
        expect(screen.getByText('The tournament is under way.')).toBeInTheDocument();
    });

    it('an expired tournament says so and leads back to the list', async () => {
        vi.mocked(loadSnapshot).mockResolvedValue(snap('expired'));
        await renderAt(s => s.actions.openTournament(T_ID));
        expect(screen.getByText('This tournament expired before it started.')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'To the tournament list' }));
        expect(store.state.tournamentNav).toEqual({ view: 'list' });
    });

    it('a tournament that no longer exists says so', async () => {
        vi.mocked(loadSnapshot).mockRejectedValue(new TournamentError('unknown', 'tournament not found'));
        await renderAt(s => s.actions.openTournament(T_ID));
        expect(screen.getByRole('alert')).toHaveTextContent('This tournament no longer exists.');
    });

    it('the watch view is a placeholder whose Back returns to the tournament', async () => {
        await renderAt(s => s.actions.openWatch(T_ID));
        fireEvent.click(screen.getByRole('button', { name: 'Back' }));
        expect(store.state.tournamentNav).toEqual({ view: 'tournament', id: T_ID });
    });
});
