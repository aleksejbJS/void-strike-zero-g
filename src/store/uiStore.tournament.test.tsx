import React from 'react';
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { render, act } from '@testing-library/react';
import { UIProvider, useUIStore } from './uiStore';
import { GameMode, MapId } from '../types';
import type { TournamentMatchRun } from './tournamentSlice';

let store: ReturnType<typeof useUIStore>;
const Spy: React.FC = () => { store = useUIStore(); return null; };

const T_ID = '11111111-1111-4111-8111-111111111111';
const run: TournamentMatchRun = {
    ticket: { tournamentId: T_ID, seat: 2, secret: 'abc' }, matchId: 'm1', role: 'host', withBot: false,
};

beforeEach(() => {
    (localStorage.getItem as Mock).mockReset().mockReturnValue(null);
    vi.spyOn(console, 'log').mockImplementation(() => {}); // the reducer logs startGame
});

describe('uiStore tournament navigation', () => {
    it('starts closed, opens the list, a tournament and its watch view, and closes', () => {
        render(<UIProvider><Spy /></UIProvider>);
        expect(store.state.tournamentNav).toBeNull();
        act(() => store.actions.openTournaments());
        expect(store.state.tournamentNav).toEqual({ view: 'list' });
        act(() => store.actions.openTournament(T_ID));
        expect(store.state.tournamentNav).toEqual({ view: 'tournament', id: T_ID });
        act(() => store.actions.openWatch(T_ID));
        expect(store.state.tournamentNav).toEqual({ view: 'watch', id: T_ID });
        act(() => store.actions.closeTournaments());
        expect(store.state.tournamentNav).toBeNull();
    });
});

describe('uiStore tournament match', () => {
    it('round-trips: start plays a duel on the Pit, end returns to the tournament view', () => {
        render(<UIProvider><Spy /></UIProvider>);
        act(() => store.actions.openTournament(T_ID));
        act(() => store.actions.startTournamentMatch(run));
        expect(store.state).toMatchObject({
            isPlaying: true, selectedMode: GameMode.DUEL, selectedMap: MapId.PIT, tournamentMatch: run,
        });

        act(() => store.actions.endTournamentMatch());
        expect(store.state.isPlaying).toBe(false);
        expect(store.state.tournamentMatch).toBeNull();
        expect(store.state.tournamentNav).toEqual({ view: 'tournament', id: T_ID });
    });

    it('returns to the tournament of the run even when the navigation was elsewhere', () => {
        render(<UIProvider><Spy /></UIProvider>);
        act(() => store.actions.startTournamentMatch(run)); // e.g. started from the watch view
        act(() => store.actions.endTournamentMatch());
        expect(store.state.tournamentNav).toEqual({ view: 'tournament', id: T_ID });
    });

    it('finishGame (Escape) during a tournament match behaves like endTournamentMatch', () => {
        render(<UIProvider><Spy /></UIProvider>);
        act(() => store.actions.startTournamentMatch(run));
        act(() => store.actions.finishGame(7));
        expect(store.state.isPlaying).toBe(false);
        expect(store.state.tournamentMatch).toBeNull();
        expect(store.state.tournamentNav).toEqual({ view: 'tournament', id: T_ID });
    });

    it('finishGame outside a tournament still goes back to the menu as before', () => {
        render(<UIProvider><Spy /></UIProvider>);
        act(() => store.actions.startGame(GameMode.DEATHMATCH));
        act(() => store.actions.finishGame(7));
        expect(store.state).toMatchObject({ isPlaying: false, lastScore: 7, tournamentNav: null, tournamentMatch: null });
    });

    it('endTournamentMatch without a run changes nothing', () => {
        render(<UIProvider><Spy /></UIProvider>);
        const before = store.state;
        act(() => store.actions.endTournamentMatch());
        expect(store.state).toBe(before);
    });
});
