import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { UIProvider } from '../../store/uiStore';
import { achievementManager } from '../../game/systems/achievements';
import { ticketFor } from '../../tournament/seatStore';
import { matchSeen } from '../../tournament/tournamentApi';
import { forgetAwarded } from '../../tournament/awardTournament';
import type { TournamentSnapshot } from '../../tournament/types';
import { makeSnapshot, settle } from '../../game/tournament/bracketFixtures';
import { BracketScreen } from './BracketScreen';
import { forgetRunHistory } from './runHistory';

vi.mock('../../tournament/tournamentApi', () => ({ matchSeen: vi.fn() }));
vi.mock('../../tournament/seatStore', () => ({ ticketFor: vi.fn() }));
vi.mock('../../account/progressEvents', () => ({ notifyProgressChanged: vi.fn() }));

const ui = (snap: TournamentSnapshot) => <UIProvider><BracketScreen snapshot={snap} /></UIProvider>;
const unlocked = () => achievementManager.getAchievements().filter(a => a.unlocked).map(a => a.id).sort();

// Seat 0 wins both played matches 10:0 and 10:4 (semifinal first)
const semis = () => settle(settle(makeSnapshot(4), 0, 0, 0, 10, 0), 0, 1, 2, 10, 5);
const champion = () => settle(semis(), 1, 0, 0, 10, 4);

const as = (seat: number | null) => vi.mocked(ticketFor).mockReturnValue(
    seat === null ? null : { tournamentId: 't1', seat, secret: 's' });

beforeEach(() => {
    (localStorage.getItem as Mock).mockReset().mockReturnValue(null);
    vi.mocked(matchSeen).mockReset().mockResolvedValue(undefined);
    forgetRunHistory();
    achievementManager.reset();
    forgetAwarded();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('BracketScreen awards', () => {
    it('awards Flawless while the tournament still runs, then the rest when a new snapshot finishes it', () => {
        as(0);
        const { rerender } = render(ui(semis()));
        expect(unlocked()).toEqual(['tournament_flawless']);

        rerender(ui(champion()));
        expect(unlocked()).toEqual(['tournament_champion', 'tournament_finalist', 'tournament_flawless']);
    });

    it('awards nothing without a ticket (a spectator)', () => {
        as(null);
        render(ui(champion()));
        expect(unlocked()).toEqual([]);
    });

    it('judges the seat of the ticket, not the winner', () => {
        as(1);
        render(ui(champion()));
        expect(unlocked()).toEqual([]);
    });
});
