// Detects that a match (or Hunger Games round, or Gun Game) has ended and whether the local player won.
// Every end has a key so the caller can award XP once per end, however often it looks at the state.

import { GameState } from '../../types';

export interface MatchEnd { key: string; won: boolean }

const teamOf = (state: GameState, playerId: string) => state.players.find(p => p.id === playerId)?.team;

/** Outcome of a score/time-limited match; a null or missing winner is a draw. */
const matchResult = (state: GameState, localId: string): boolean => {
    const winner = state.matchWinner;
    if (!winner) return false;
    if (winner.playerId !== undefined) return winner.playerId === localId;
    return winner.team !== undefined && winner.team === teamOf(state, localId);
};

/** The finished match the state shows, or null while play is still going. */
export const detectMatchEnd = (state: GameState, localId: string): MatchEnd | null => {
    if (state.matchEndsAt) {
        return { key: `match:${state.matchEndsAt}`, won: matchResult(state, localId) };
    }
    if (state.hungerRoundEndsAt) {
        return { key: `hunger:${state.hungerRoundEndsAt}`, won: state.hungerWinnerId === localId };
    }
    if (state.gunGameWinnerId) {
        return { key: `gun:${state.matchStartedAt}:${state.gunGameWinnerId}`, won: state.gunGameWinnerId === localId };
    }
    return null;
};
