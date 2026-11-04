// Shared fixtures for the useTournamentMatch tests: a duel state, a run, and the hook rendered with refs.

import { renderHook } from '@testing-library/react';
import type { MutableRefObject } from 'react';
import type { Entity, GameState } from '../../types';
import { GameMode } from '../../types';
import type { TournamentMatchRun } from '../../store/tournamentSlice';
import { useTournamentMatch } from './useTournamentMatch';

export const ticket = { tournamentId: 't1', seat: 2, secret: 'sec' };

export const makeRun = (over: Partial<TournamentMatchRun> = {}): TournamentMatchRun => ({
    ticket, matchId: 'm1', role: 'host', withBot: false, side: 'a', ...over,
});

export const fighter = (id: string, score: number, type: string = 'player') => ({ id, name: id, score, type }) as unknown as Entity;

/** A duel in progress between `me` and `them`; pass `them: null` for a missing opponent. */
export const duelState = (me: number, them: number | null): GameState => ({
    mode: GameMode.DUEL,
    players: them === null ? [fighter('me', me)] : [fighter('me', me), fighter('them', them)],
}) as unknown as GameState;

export const renderMatch = (run: TournamentMatchRun | null, state: GameState) => {
    const gameState: MutableRefObject<GameState> = { current: state };
    const localId: MutableRefObject<string> = { current: 'me' };
    const hook = renderHook(({ r }) => useTournamentMatch(gameState, localId, r), { initialProps: { r: run } });
    return { ...hook, gameState };
};
