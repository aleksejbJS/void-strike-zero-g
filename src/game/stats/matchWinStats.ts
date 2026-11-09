// Lifetime counters earned by winning a match: wins against humans, wins against bots, Hunger Games wins.

import type { GameState } from '../../types';
import type { MatchEnd } from '../build/matchOutcome';
import type { Stats } from './statKeys';

/** Counter changes for one finished match as seen by the local player; nothing for a loss or a draw. */
export function matchWinStats(state: GameState, end: MatchEnd): Stats {
    if (!end.won) return {};
    // A match with one human is a bot match, however many bots played
    const humans = state.players.filter(p => p.type === 'player').length;
    const stats: Stats = humans >= 2 ? { wins: 1 } : { botWins: 1 };
    if (end.key.startsWith('hunger:')) stats.hungerWins = 1;
    return stats;
}
