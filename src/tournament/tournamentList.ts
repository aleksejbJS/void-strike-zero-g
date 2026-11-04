// The rows of the tournament list: the listed tournaments (listOpen) plus what each row shows about them,
// the creator's nickname, how many humans signed up, and the round a running tournament is in.

import { listOpen, loadListDetails } from './tournamentApi';
import type { TournamentRow } from './types';

export interface TournamentListItem {
    tournament: TournamentRow;
    /** null if the creator's seat is not readable (a race with a leave); the row just omits the name. */
    creator: string | null;
    humans: number;
    /** The earliest round that still has an unfinished match; null before the start and after the final. */
    round: number | null;
}

export async function listTournaments(): Promise<TournamentListItem[]> {
    const tournaments = await listOpen();
    const { seats, matches } = await loadListDetails(tournaments.map(t => t.id));
    return tournaments.map(tournament => {
        const own = seats.filter(s => s.tournamentId === tournament.id);
        const open = matches.filter(m => m.tournamentId === tournament.id && m.status !== 'done').map(m => m.round);
        return {
            tournament,
            creator: own.find(s => s.seat === tournament.creatorSeat)?.nickname ?? null,
            humans: own.filter(s => !s.isBot).length,
            round: open.length > 0 ? Math.min(...open) : null,
        };
    });
}
