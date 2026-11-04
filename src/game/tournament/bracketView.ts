// Pure view model for the bracket screen: the matches of a snapshot as columns of cells.

import type { MatchRow, SeatRow, TournamentSnapshot } from '../../tournament/types';

export interface BracketCell {
    match: MatchRow;
    a: SeatRow | null;
    b: SeatRow | null;
    /** Spectators can watch: the match is running and its host has published a peer id. */
    live: boolean;
}

/** Columns indexed [round][slot]. Empty while there are no matches yet (lobby). */
export const bracketColumns = (s: TournamentSnapshot): BracketCell[][] => {
    const seatBySeat = new Map(s.seats.map(seat => [seat.seat, seat]));
    const seatOf = (n: number | null): SeatRow | null => (n === null ? null : seatBySeat.get(n) ?? null);
    const columns: BracketCell[][] = [];
    const ordered = [...s.matches].sort((x, y) => x.round - y.round || x.slot - y.slot);
    for (const match of ordered) {
        (columns[match.round] ??= []).push({
            match,
            a: seatOf(match.seatA),
            b: seatOf(match.seatB),
            live: match.status === 'ready' && match.hostPeerId !== null,
        });
    }
    return columns;
};

export type RoundName = 'quarterfinal' | 'semifinal' | 'final';

/** Round 0 of an 8-bracket is the quarterfinal, of a 4-bracket the semifinal; the last round is the final. */
export const roundName = (round: number, size: 4 | 8): RoundName => {
    const roundsLeft = (size === 8 ? 3 : 2) - 1 - round; // 0 = the final
    if (roundsLeft <= 0) return 'final';
    return roundsLeft === 1 ? 'semifinal' : 'quarterfinal';
};
