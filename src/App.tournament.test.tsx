import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import App from './App';
import { AccountContext } from './account/useAccount';
import { UIProvider, useUIStore } from './store/uiStore';
import { stubAccount } from './test/accountStub';
import { joinTournament, loadSnapshot } from './tournament/tournamentApi';
import type { TournamentSnapshot } from './tournament/types';

// Pixi needs WebGL, which jsdom lacks
vi.mock('./components/GameCanvas', () => ({ default: () => <div /> }));
vi.mock('./components/setup/CharacterPreview', () => ({ CharacterPreview: () => <div /> }));
vi.mock('./components/setup/builder/usePartThumbnails', () => ({ usePartThumbnails: () => ({}) }));
vi.mock('./tournament/tournamentApi', () => ({ loadSnapshot: vi.fn(), joinTournament: vi.fn(), resolveStale: vi.fn() }));
vi.mock('./tournament/tournamentFeed', () => ({ watchTournament: () => () => {} }));
vi.mock('./tournament/seatStore', () => ({ saveTicket: vi.fn(), ticketFor: () => null, forgetTicket: vi.fn() }));

const T_ID = '11111111-1111-4111-8111-111111111111';
const snapshot: TournamentSnapshot = {
    tournament: {
        id: T_ID, name: 'Friday grinder', status: 'lobby', size: null, creatorSeat: 0,
        createdAt: '', startedAt: null, finishedAt: null, championSeat: null,
    },
    seats: [{ seat: 0, nickname: 'Kolya', isBot: false, bracketPos: null, joinedAt: '' }],
    matches: [],
};

let store: ReturnType<typeof useUIStore>;
const Spy: React.FC = () => { store = useUIStore(); return null; };

const renderApp = async (search: string) => {
    window.history.replaceState(null, '', `/${search}`);
    render(<UIProvider><Spy /><AccountContext.Provider value={stubAccount({ status: 'guest' })}><App /></AccountContext.Provider></UIProvider>);
    await act(async () => {}); // the first loadSnapshot answer
};

beforeEach(() => {
    (localStorage.getItem as Mock).mockReset().mockReturnValue(null);
    vi.mocked(loadSnapshot).mockReset().mockResolvedValue(snapshot);
    vi.mocked(joinTournament).mockReset();
});

// No vi.restoreAllMocks(): it would also wipe the ResizeObserver stub of the test setup, which the menu needs
afterEach(() => window.history.replaceState(null, '', '/'));

describe('App tournament routing', () => {
    it('?tournament=<id> opens that tournament instead of the menu', async () => {
        await renderApp(`?tournament=${T_ID}`);
        expect(store.state.tournamentNav).toEqual({ view: 'tournament', id: T_ID });
        expect(screen.getByRole('heading', { name: 'Friday grinder · 1 / 8' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Play vs bots/ })).not.toBeInTheDocument();
    });

    it('ignores a ?tournament= value that is not an id', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        await renderApp('?tournament=nonsense');
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('[tournament]'), 'nonsense');
        warn.mockRestore();
        expect(store.state.tournamentNav).toBeNull();
        expect(screen.getByRole('button', { name: /Play vs bots/ })).toBeInTheDocument();
    });

    it('a guest without a name picks one on the setup screen and comes back to the lobby without a match', async () => {
        await renderApp(`?tournament=${T_ID}`);
        fireEvent.click(screen.getByRole('button', { name: 'Sign up' }));
        expect(joinTournament).not.toHaveBeenCalled();

        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Zed' } });
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Continue' })); });

        expect(store.state.isPlaying).toBe(false);
        expect(store.state.playerName).toBe('Zed');
        expect(screen.getByRole('heading', { name: 'Friday grinder · 1 / 8' })).toBeInTheDocument();
    });
});
