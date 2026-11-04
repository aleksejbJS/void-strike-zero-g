import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { UIProvider, useUIStore } from '../../store/uiStore';
import { AccountContext } from '../../account/useAccount';
import { stubAccount } from '../../test/accountStub';
import { createTournament, joinTournament, listOpen, loadListDetails } from '../../tournament/tournamentApi';
import { saveTicket, ticketFor } from '../../tournament/seatStore';
import { TournamentError, type TournamentRow } from '../../tournament/types';
import { TournamentList } from './TournamentList';

vi.mock('../../tournament/tournamentApi', () => ({
    listOpen: vi.fn(), loadListDetails: vi.fn(), joinTournament: vi.fn(), createTournament: vi.fn(),
}));
vi.mock('../../tournament/seatStore', () => ({ saveTicket: vi.fn(), ticketFor: vi.fn(), forgetTicket: vi.fn() }));

const FRIDAY = '11111111-1111-4111-8111-111111111111';
const NIGHT = '22222222-2222-4222-8222-222222222222';
const row = (id: string, name: string, status: TournamentRow['status'], size: 4 | 8 | null): TournamentRow => ({
    id, name, status, size, creatorSeat: 0, createdAt: '', startedAt: null, finishedAt: null, championSeat: null,
});

let store: ReturnType<typeof useUIStore>;
const Spy: React.FC = () => { store = useUIStore(); return null; };
const onCustomize = vi.fn();

const renderList = async (account = stubAccount({ status: 'loggedIn', nickname: 'Alex' })) => {
    render(
        <UIProvider><Spy />
            <AccountContext.Provider value={account}><TournamentList onCustomize={onCustomize} /></AccountContext.Provider>
        </UIProvider>,
    );
    await act(async () => {}); // the first listOpen answer
};
const rowOf = (name: string) => within(screen.getByText(name).closest('li')!);

beforeEach(() => {
    (localStorage.getItem as Mock).mockReset().mockReturnValue(null);
    onCustomize.mockReset();
    vi.mocked(listOpen).mockReset().mockResolvedValue([row(FRIDAY, 'Friday grinder', 'lobby', null), row(NIGHT, 'Night cup', 'running', 4)]);
    vi.mocked(loadListDetails).mockReset().mockResolvedValue({
        seats: [
            { tournamentId: FRIDAY, seat: 0, nickname: 'Kolya', isBot: false },
            ...['Max', 'Lena', 'Ann', 'Bo'].map((nickname, i) => ({ tournamentId: FRIDAY, seat: i + 1, nickname, isBot: false })),
            { tournamentId: NIGHT, seat: 0, nickname: 'Zed', isBot: false },
        ],
        matches: [{ tournamentId: NIGHT, round: 0, status: 'ready' }],
    });
    vi.mocked(joinTournament).mockReset().mockResolvedValue({ tournamentId: FRIDAY, seat: 5, secret: 's5' });
    vi.mocked(createTournament).mockReset().mockResolvedValue({ tournamentId: NIGHT, seat: 0, secret: 's0' });
    vi.mocked(ticketFor).mockReset().mockReturnValue(null);
    vi.mocked(saveTicket).mockReset();
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('TournamentList', () => {
    it('lists both tournaments: a lobby with its creator and seats, a running one with its round', async () => {
        await renderList();
        expect(rowOf('Friday grinder').getByText(/created by Kolya · 5\/8/)).toBeInTheDocument();
        expect(rowOf('Night cup').getByText(/in progress · semifinals/)).toBeInTheDocument();
        expect(rowOf('Night cup').queryByRole('button', { name: 'Sign up' })).not.toBeInTheDocument();
    });

    it('Sign up joins with the account nickname, saves the ticket and opens the lobby', async () => {
        await renderList();
        await act(async () => { fireEvent.click(rowOf('Friday grinder').getByRole('button', { name: 'Sign up' })); });
        expect(joinTournament).toHaveBeenCalledWith(FRIDAY, 'Alex');
        expect(saveTicket).toHaveBeenCalledWith({ tournamentId: FRIDAY, seat: 5, secret: 's5' });
        expect(store.state.tournamentNav).toEqual({ view: 'tournament', id: FRIDAY });
    });

    it('shows the full message when the tournament filled up meanwhile', async () => {
        vi.mocked(joinTournament).mockRejectedValue(new TournamentError('full'));
        await renderList();
        await act(async () => { fireEvent.click(rowOf('Friday grinder').getByRole('button', { name: 'Sign up' })); });
        expect(screen.getByRole('alert')).toHaveTextContent('This tournament is full.');
        expect(saveTicket).not.toHaveBeenCalled();
    });

    it('sends a guest without a name to the setup screen instead of signing up', async () => {
        await renderList(stubAccount({ status: 'guest' })); // playerName is the "Anonymous" default
        fireEvent.click(rowOf('Friday grinder').getByRole('button', { name: 'Sign up' }));
        expect(onCustomize).toHaveBeenCalled();
        expect(joinTournament).not.toHaveBeenCalled();
    });

    it('a guest with a name signs up with it', async () => {
        await renderList(stubAccount({ status: 'guest' }));
        (localStorage.getItem as Mock).mockImplementation((key: string) => (key === 'playerName' ? 'Zed' : null));
        act(() => store.actions.reloadPlayer()); // the store read the name once, at import
        await act(async () => { fireEvent.click(rowOf('Friday grinder').getByRole('button', { name: 'Sign up' })); });
        expect(joinTournament).toHaveBeenCalledWith(FRIDAY, 'Zed');
    });

    it('offers Open, not a second sign-up, for a tournament this browser already has a seat in', async () => {
        vi.mocked(ticketFor).mockImplementation(id => (id === FRIDAY ? { tournamentId: FRIDAY, seat: 2, secret: 'x' } : null));
        await renderList();
        fireEvent.click(rowOf('Friday grinder').getByRole('button', { name: 'Open' }));
        expect(store.state.tournamentNav).toEqual({ view: 'tournament', id: FRIDAY });
    });

    it('Watch opens the watch view of a running tournament', async () => {
        await renderList();
        fireEvent.click(rowOf('Night cup').getByRole('button', { name: 'Watch' }));
        expect(store.state.tournamentNav).toEqual({ view: 'watch', id: NIGHT });
    });

    it('+ Create asks for a name, creates, saves the ticket and opens the lobby', async () => {
        await renderList();
        fireEvent.click(screen.getByRole('button', { name: '+ Create tournament' }));
        fireEvent.change(screen.getByLabelText('Tournament name'), { target: { value: '  Friday cup ' } });
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Create' })); });
        expect(createTournament).toHaveBeenCalledWith('Friday cup', 'Alex');
        expect(saveTicket).toHaveBeenCalledWith({ tournamentId: NIGHT, seat: 0, secret: 's0' });
        expect(store.state.tournamentNav).toEqual({ view: 'tournament', id: NIGHT });
    });

    it('polls the list every 10 s and shows a failed load', async () => {
        vi.useFakeTimers();
        await renderList();
        expect(listOpen).toHaveBeenCalledTimes(1);
        vi.mocked(listOpen).mockRejectedValue(new TournamentError('offline'));
        await act(async () => { vi.advanceTimersByTime(10_000); });
        expect(listOpen).toHaveBeenCalledTimes(2);
        expect(screen.getByRole('alert')).toHaveTextContent('Tournaments are not available right now.');
    });

    it('Back closes the tournaments and returns to the menu', async () => {
        await renderList();
        act(() => store.actions.openTournaments());
        fireEvent.click(screen.getByRole('button', { name: 'Back' }));
        expect(store.state.tournamentNav).toBeNull();
    });
});
