// The tournament part of the UI store: which tournament screen is open, and the tournament match being played.
// Wired into uiStore.tsx; kept here so the store file stays small.

import type { Dispatch } from 'react';
import { GameMode, MapId, type KillMessage } from '../types';
import type { SeatTicket } from '../tournament/types';

export type TournamentNav = { view: 'list' } | { view: 'tournament'; id: string } | { view: 'watch'; id: string };

export interface TournamentMatchRun {
    ticket: SeatTicket;
    matchId: string;
    role: 'host' | 'guest';
    peerId?: string;
    withBot: boolean;
}

export interface TournamentUIState {
    /** null: no tournament screen, the main menu is shown. */
    tournamentNav: TournamentNav | null;
    /** Set while this browser plays its tournament duel. */
    tournamentMatch: TournamentMatchRun | null;
}

export interface TournamentActions {
    openTournaments: () => void;
    openTournament: (id: string) => void;
    openWatch: (id: string) => void;
    closeTournaments: () => void;
    startTournamentMatch: (run: TournamentMatchRun) => void;
    endTournamentMatch: () => void;
}

export type TournamentAction =
    | { type: 'setTournamentNav'; payload: TournamentNav | null }
    | { type: 'startTournamentMatch'; payload: TournamentMatchRun }
    | { type: 'endTournamentMatch' };

export const tournamentInitialState: TournamentUIState = { tournamentNav: null, tournamentMatch: null };

/** The fields of the whole UI state that a tournament match changes. */
interface MatchFields extends TournamentUIState {
    isPlaying: boolean;
    selectedMode: GameMode;
    selectedMap: MapId;
    lastScore: number | null;
    scores: { red: number; blue: number };
    killFeed: KillMessage[];
}

/** Back from the duel to its tournament. Also what finishGame (Escape) does while a tournament match runs. */
export function endTournamentMatch<S extends MatchFields>(state: S): S {
    if (!state.tournamentMatch) return state;
    const id = state.tournamentMatch.ticket.tournamentId;
    return { ...state, isPlaying: false, tournamentMatch: null, tournamentNav: { view: 'tournament', id } };
}

export function reduceTournament<S extends MatchFields>(state: S, action: TournamentAction): S {
    switch (action.type) {
        case 'setTournamentNav':
            return { ...state, tournamentNav: action.payload };
        case 'startTournamentMatch':
            // Like startGame: a fresh match, here always a duel on the Pit
            return {
                ...state, isPlaying: true, selectedMode: GameMode.DUEL, selectedMap: MapId.PIT, tournamentMatch: action.payload,
                lastScore: null, scores: { red: 0, blue: 0 }, killFeed: [],
            };
        case 'endTournamentMatch':
            return endTournamentMatch(state);
        default:
            return state;
    }
}

export const tournamentActions = (dispatch: Dispatch<TournamentAction>): TournamentActions => {
    const nav = (payload: TournamentNav | null) => dispatch({ type: 'setTournamentNav', payload });
    return {
        openTournaments: () => nav({ view: 'list' }),
        openTournament: id => nav({ view: 'tournament', id }),
        openWatch: id => nav({ view: 'watch', id }),
        closeTournaments: () => nav(null),
        startTournamentMatch: run => dispatch({ type: 'startTournamentMatch', payload: run }),
        endTournamentMatch: () => dispatch({ type: 'endTournamentMatch' }),
    };
};
