// Which tournament achievements one seat earned, judged from the finished (or running) bracket.

import { GameMode } from '../../types';
import { SCORE_LIMIT } from '../systems/matchRound';
import type { MatchRow, TournamentSnapshot } from '../../tournament/types';

export interface TournamentAwards {
    champion: boolean;
    finalist: boolean;
    /** Ids of the played matches this seat won 10:0. */
    flawlessMatchIds: string[];
}

const DUEL_LIMIT = SCORE_LIMIT[GameMode.DUEL] ?? 10;

const myScores = (m: MatchRow, seat: number) =>
    m.seatA === seat ? { mine: m.scoreA, theirs: m.scoreB } : { mine: m.scoreB, theirs: m.scoreA };

/**
 * Walkovers and bot coin flips never count as a win here: champion and finalist need at least one
 * played win, and flawless is a played 10:0 only.
 * - finalist: my seat is in the final match (winner or loser, once the final's seats are known).
 * - champion: I won the final (or the tournament row names me champion).
 */
export const tournamentAwards = (s: TournamentSnapshot, mySeat: number): TournamentAwards => {
    const playedWins = s.matches.filter(m => m.status === 'done' && m.decidedBy === 'played' && m.winnerSeat === mySeat);
    const flawlessMatchIds = playedWins
        .filter(m => {
            const { mine, theirs } = myScores(m, mySeat);
            return mine >= DUEL_LIMIT && theirs === 0;
        })
        .sort((x, y) => x.round - y.round || x.slot - y.slot)
        .map(m => m.id);

    const finalRound = Math.max(-1, ...s.matches.map(m => m.round));
    const final = s.matches.find(m => m.round === finalRound);
    const inFinal = !!final && (final.seatA === mySeat || final.seatB === mySeat);
    const wonFinal = s.tournament.championSeat === mySeat || (final?.status === 'done' && final.winnerSeat === mySeat);
    const earned = playedWins.length > 0;

    return { champion: earned && wonFinal, finalist: earned && (inFinal || wonFinal), flawlessMatchIds };
};
