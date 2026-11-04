import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { UIProvider, useUIStore } from '../../store/uiStore';
import { AccountContext } from '../../account/useAccount';
import { stubAccount } from '../../test/accountStub';
import { joinTournament, leaveTournament, startTournament } from '../../tournament/tournamentApi';
import { forgetTicket, saveTicket, ticketFor } from '../../tournament/seatStore';
import { TournamentError, type SeatTicket, type TournamentSnapshot } from '../../tournament/types';
import { TournamentLobby } from './TournamentLobby';

vi.mock('../../tournament/tournamentApi', () => ({ joinTournament: vi.fn(), leaveTournament: vi.fn(), startTournament: vi.fn() }));
vi.mock('../../tournament/seatStore', () => ({ saveTicket: vi.fn(), ticketFor: vi.fn(), forgetTicket: vi.fn() }));

const T_ID = '11111111-1111-4111-8111-111111111111';
const lobby = (nicknames: string[], creatorSeat = 0): TournamentSnapshot => ({
    tournament: {
        id: T_ID, name: 'Friday grinder', status: 'lobby', size: null, creatorSeat,
        createdAt: '', startedAt: null, finishedAt: null, championSeat: null,
    },
    seats: nicknames.map((nickname, seat) => ({ seat, nickname, isBot: false, bracketPos: null, joinedAt: '', seenAt: null })),
    matches: [],
});
const ticket = (seat: number): SeatTicket => ({ tournamentId: T_ID, seat, secret: `s${seat}` });

let store: ReturnType<typeof useUIStore>;
const Spy: React.FC = () => { store = useUIStore(); return null; };
const onCustomize = vi.fn();
const writeText = vi.fn();

const renderLobby = (snapshot: TournamentSnapshot, mine: SeatTicket | null) => {
    vi.mocked(ticketFor).mockReturnValue(mine);
    render(
        <UIProvider><Spy />
            <AccountContext.Provider value={stubAccount({ status: 'loggedIn', nickname: 'Alex' })}>
                <TournamentLobby snapshot={snapshot} onCustomize={onCustomize} />
            </AccountContext.Provider>
        </UIProvider>,
    );
};
const startButton = () => screen.queryByRole('button', { name: 'Start' });

beforeEach(() => {
    (localStorage.getItem as Mock).mockReset().mockReturnValue(null);
    for (const fn of [joinTournament, leaveTournament, startTournament]) vi.mocked(fn).mockReset().mockResolvedValue(undefined as never);
    for (const fn of [saveTicket, ticketFor, forgetTicket, onCustomize, writeText]) vi.mocked(fn).mockReset();
    writeText.mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});

afterEach(() => { vi.restoreAllMocks(); });

describe('TournamentLobby', () => {
    it('shows 8 tiles with free ones turning into bots, the seat count and the rules', () => {
        renderLobby(lobby(['Kolya', 'Alex', 'Max']), ticket(1));
        expect(screen.getByRole('heading', { name: 'Friday grinder · 3 / 8' })).toBeInTheDocument();
        expect(screen.getByText('1v1 · first to 10 · The Pit')).toBeInTheDocument();
        expect(screen.getAllByRole('listitem')).toHaveLength(8);
        expect(screen.getAllByText('free → bot')).toHaveLength(5);
        expect(screen.getByText('Alex (you)')).toBeInTheDocument();
    });

    it('shows Start only to the creator', () => {
        renderLobby(lobby(['Kolya', 'Alex']), ticket(1));
        expect(startButton()).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Leave' })).toBeInTheDocument();
    });

    it('disables Start with 1 human and starts with 2', async () => {
        renderLobby(lobby(['Alex']), ticket(0));
        expect(startButton()).toBeDisabled();
        expect(screen.getByText('At least 2 players are needed to start.')).toBeInTheDocument();
    });

    it('Start calls startTournament with the ticket', async () => {
        renderLobby(lobby(['Alex', 'Max']), ticket(0));
        expect(startButton()).toBeEnabled();
        await act(async () => { fireEvent.click(startButton()!); });
        expect(startTournament).toHaveBeenCalledWith(ticket(0));
    });

    it('Copy link writes the ?tournament= URL', async () => {
        renderLobby(lobby(['Kolya']), null);
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy link' })); });
        expect(writeText).toHaveBeenCalledWith(`${window.location.origin}${window.location.pathname}?tournament=${T_ID}`);
        expect(screen.getByText('Link copied')).toBeInTheDocument();
    });

    it('shows the link itself when the clipboard refuses', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        writeText.mockRejectedValue(new Error('denied'));
        renderLobby(lobby(['Kolya']), null);
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy link' })); });
        expect(screen.getByText(new RegExp(`\\?tournament=${T_ID}`))).toBeInTheDocument();
    });

    it('Leave gives the seat back, forgets the ticket and returns to the list', async () => {
        renderLobby(lobby(['Kolya', 'Alex']), ticket(1));
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Leave' })); });
        expect(leaveTournament).toHaveBeenCalledWith(ticket(1));
        expect(forgetTicket).toHaveBeenCalledWith(T_ID);
        expect(store.state.tournamentNav).toEqual({ view: 'list' });
    });

    it('a visitor from a link can sign up, and then holds a seat', async () => {
        vi.mocked(joinTournament).mockResolvedValue(ticket(1));
        renderLobby(lobby(['Kolya']), null);
        expect(screen.queryByRole('button', { name: 'Leave' })).not.toBeInTheDocument();
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Sign up' })); });
        expect(joinTournament).toHaveBeenCalledWith(T_ID, 'Alex');
        expect(saveTicket).toHaveBeenCalledWith(ticket(1));
        expect(screen.getByRole('button', { name: 'Leave' })).toBeInTheDocument();
    });

    it('shows the message of a failed action', async () => {
        vi.mocked(startTournament).mockRejectedValue(new TournamentError('not_creator'));
        renderLobby(lobby(['Alex', 'Max']), ticket(0));
        await act(async () => { fireEvent.click(startButton()!); });
        expect(screen.getByRole('alert')).toHaveTextContent('Only the creator can start the tournament.');
    });
});
