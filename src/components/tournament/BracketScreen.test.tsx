import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { UIProvider, useUIStore } from '../../store/uiStore';
import { ticketFor } from '../../tournament/seatStore';
import { matchSeen } from '../../tournament/tournamentApi';
import type { TournamentSnapshot } from '../../tournament/types';
import { makeSnapshot, publishHost, settle } from '../../game/tournament/bracketFixtures';
import { BracketScreen } from './BracketScreen';
import { forgetRunHistory } from './runHistory';

vi.mock('../../tournament/tournamentApi', () => ({ matchSeen: vi.fn() }));
vi.mock('../../tournament/seatStore', () => ({ ticketFor: vi.fn() }));

let store: ReturnType<typeof useUIStore>;
const Spy: React.FC = () => { store = useUIStore(); return null; };
const show = (snap: TournamentSnapshot, mySeat: number | null) => {
    vi.mocked(ticketFor).mockReturnValue(mySeat === null ? null : { tournamentId: 't1', seat: mySeat, secret: 's' });
    render(<UIProvider><Spy /><BracketScreen snapshot={snap} /></UIProvider>);
};
const cells = (column: string) => within(screen.getByRole('list', { name: column })).getAllByRole('listitem');

beforeEach(() => {
    (localStorage.getItem as Mock).mockReset().mockReturnValue(null);
    vi.mocked(matchSeen).mockReset().mockResolvedValue(undefined);
    forgetRunHistory();
});
afterEach(() => { vi.restoreAllMocks(); });

describe('BracketScreen', () => {
    it('renders 4 / 2 / 1 cells for a bracket of 8, plus the trophy column', () => {
        show(makeSnapshot(8), null);
        expect(cells('Quarterfinal')).toHaveLength(4);
        expect(cells('Semifinal')).toHaveLength(2);
        expect(cells('Final')).toHaveLength(1);
        expect(screen.getByRole('list', { name: 'Champion' })).toBeInTheDocument();
    });

    it('a bracket of 4 starts at the semifinals', () => {
        show(makeSnapshot(4), null);
        expect(screen.queryByRole('list', { name: 'Quarterfinal' })).not.toBeInTheDocument();
        expect(cells('Semifinal')).toHaveLength(2);
    });

    it('outlines my match', () => {
        show(makeSnapshot(8), 2);
        const mine = cells('Quarterfinal').filter(cell => cell.getAttribute('aria-current') === 'true');
        expect(mine).toHaveLength(1);
        expect(mine[0]).toHaveTextContent('P2');
        expect(mine[0]).toHaveTextContent('P3');
    });

    it('shows the winner in hazard yellow, strikes the loser through, and shows the final score', () => {
        show(settle(makeSnapshot(4), 0, 0, 0, 10, 3), null);
        const [first] = cells('Semifinal');
        expect(within(first).getByText('P0')).toHaveClass('text-bay-hazard');
        expect(within(first).getByText('P1')).toHaveClass('line-through');
        expect(within(first).getByText('10')).toBeInTheDocument();
        expect(within(first).getByText('3')).toBeInTheDocument();
    });

    it('tags a match whose host is online as LIVE, without a score', () => {
        show(publishHost(makeSnapshot(4), 0, 1, 'peer-q'), null);
        const [first, second] = cells('Semifinal');
        expect(within(second).getByText('LIVE')).toBeInTheDocument();
        expect(within(first).queryByText('LIVE')).not.toBeInTheDocument();
        expect(within(second).queryByText('0')).not.toBeInTheDocument();
    });

    it('Watch opens the watch view', () => {
        show(makeSnapshot(4), null);
        fireEvent.click(screen.getByRole('button', { name: 'Watch' }));
        expect(store.state.tournamentNav).toEqual({ view: 'watch', id: 't1' });
    });

    it('shows the champion banner', () => {
        const done = settle(settle(settle(makeSnapshot(4), 0, 0, 0, 10, 3), 0, 1, 2, 10, 5), 1, 0, 2, 4, 10);
        show(done, 2);
        expect(screen.getByRole('status')).toHaveTextContent('You are the champion!');
        expect(within(screen.getByRole('list', { name: 'Champion' })).getByText('P2')).toBeInTheDocument();
    });

    it('does not promise a start for a match this page already played (e.g. left with Escape)', () => {
        show(makeSnapshot(4, { bots: [1] }), 0);
        expect(screen.getByRole('status')).toHaveTextContent('Your match is starting…');
        cleanup();
        show(makeSnapshot(4, { bots: [1] }), 0); // back on the bracket, the row still says ready
        expect(screen.getByRole('status')).toHaveTextContent('Waiting for the result of your match…');
    });

    it('shows the eliminated banner', () => {
        show(settle(makeSnapshot(4), 0, 0, 0, 10, 3), 1);
        expect(screen.getByRole('status')).toHaveTextContent('You are out. Thanks for playing!');
    });
});
