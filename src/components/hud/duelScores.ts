// Reading a tournament duel from the game state: the other fighter, and the score in the match's seat order.

import type { Entity, GameState } from '../../types';

/** The duel's other fighter: a player or a bot, never any other entity. */
export const opponentOf = (state: GameState, localId: string): Entity | undefined =>
    state.players.find(p => p.id !== localId && (p.type === 'player' || p.type === 'bot'));

/** scoreA belongs to the match's seat A: mine when I sit there (`side` 'a'), the opponent's otherwise. */
export const duelScores = (state: GameState, localId: string, side: 'a' | 'b'): { scoreA: number; scoreB: number } => {
    const mine = state.players.find(p => p.id === localId)?.score ?? 0;
    const theirs = opponentOf(state, localId)?.score ?? 0;
    return side === 'a' ? { scoreA: mine, scoreB: theirs } : { scoreA: theirs, scoreB: mine };
};
