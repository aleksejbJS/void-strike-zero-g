// Start for a stand-in: when the creator closed the tab (no lobby heartbeat for 60 s), the earliest-joined
// present seat sees Start instead (the server checks the same rule).

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { UIProvider } from '../../store/uiStore';
import { AccountContext } from '../../account/useAccount';
import { stubAccount } from '../../test/accountStub';
import { startTournament } from '../../tournament/tournamentApi';
import { ticketFor } from '../../tournament/seatStore';
import type { SeatTicket, TournamentSnapshot } from '../../tournament/types';
import { translations } from '../../i18n/locales';
import { TournamentLobby } from './TournamentLobby';

vi.mock('../../tournament/tournamentApi', () => ({ joinTournament: vi.fn(), leaveTournament: vi.fn(), startTournament: vi.fn() }));
vi.mock('../../tournament/seatStore', () => ({ saveTicket: vi.fn(), ticketFor: vi.fn(), forgetTicket: vi.fn() }));

const T_ID = 't1';
const ago = (sec: number) => new Date(Date.now() - sec * 1000).toISOString();
/** Three seats; `seen[n]` = seconds since seat n's last heartbeat. Seat n joined n minutes after seat 0. */
const lobby = (seen: number[]): TournamentSnapshot => ({
    tournament: { id: T_ID, name: 'Cup', status: 'lobby', size: null, creatorSeat: 0, createdAt: ago(300), startedAt: null, finishedAt: null, championSeat: null },
    seats: seen.map((s, seat) => ({ seat, nickname: `P${seat}`, isBot: false, bracketPos: null, joinedAt: ago(300 - seat * 60), seenAt: ago(s) })),
    matches: [],
});
const ticket = (seat: number): SeatTicket => ({ tournamentId: T_ID, seat, secret: `s${seat}` });
const show = (snapshot: TournamentSnapshot, seat: number) => {
    vi.mocked(ticketFor).mockReturnValue(ticket(seat));
    render(
        <UIProvider>
            <AccountContext.Provider value={stubAccount({ status: 'guest' })}>
                <TournamentLobby snapshot={snapshot} onCustomize={vi.fn()} />
            </AccountContext.Provider>
        </UIProvider>,
    );
};
const startButton = () => screen.queryByRole('button', { name: 'Start' });

beforeEach(() => {
    (localStorage.getItem as Mock).mockReset().mockReturnValue(null);
    vi.mocked(startTournament).mockReset().mockResolvedValue(undefined);
});
afterEach(() => { vi.restoreAllMocks(); });

describe('TournamentLobby: standing in for a silent creator', () => {
    it('the creator is present: only the creator gets Start', () => {
        show(lobby([5, 5, 5]), 1);
        expect(startButton()).not.toBeInTheDocument();
        expect(screen.getByText('Waiting for the creator to start')).toBeInTheDocument();
    });

    it('the creator silent for over 60 s: the earliest present seat gets Start and a hint, and it calls start', () => {
        show(lobby([61, 5, 5]), 1);
        expect(screen.getByText('The creator is away: you can start the tournament')).toBeInTheDocument();
        fireEvent.click(startButton()!);
        expect(startTournament).toHaveBeenCalledWith(ticket(1));
    });

    it('a later seat still waits', () => {
        show(lobby([61, 5, 5]), 2);
        expect(startButton()).not.toBeInTheDocument();
    });

    it('has a Russian hint', () => {
        expect(translations.ru['tournament.lobby.standIn']).toBe('Создатель отошёл: ты можешь начать турнир');
    });
});
