// Shapes of the tournament data in the browser: camelCase mirrors of the rows in
// supabase/migrations/20261104000000_tournaments.sql (the SQL is the source of truth).

export type TournamentStatus = 'lobby' | 'running' | 'finished' | 'expired';
export type MatchStatus = 'waiting' | 'ready' | 'done';
export type DecidedBy = 'played' | 'walkover' | 'bot';

export interface TournamentRow {
    id: string;
    name: string;
    status: TournamentStatus;
    size: 4 | 8 | null; // set when the tournament starts
    creatorSeat: number;
    createdAt: string;
    startedAt: string | null;
    finishedAt: string | null;
    championSeat: number | null;
}

export interface SeatRow {
    seat: number;
    nickname: string;
    isBot: boolean;
    bracketPos: number | null; // shuffled at start
    joinedAt: string;
}

export interface MatchRow {
    id: string;
    round: number; // 0 is the first round; the winner of (round, slot) plays in (round + 1, slot / 2)
    slot: number;
    seatA: number | null;
    seatB: number | null;
    hostSeat: number | null; // null for bot vs bot
    hostPeerId: string | null;
    status: MatchStatus;
    scoreA: number;
    scoreB: number;
    winnerSeat: number | null;
    decidedBy: DecidedBy | null;
    readyAt: string | null;
}

export interface TournamentSnapshot {
    tournament: TournamentRow;
    seats: SeatRow[];
    matches: MatchRow[];
}

/** Proof of a seat: handed out once by create/join, kept in this browser (see seatStore). */
export interface SeatTicket {
    tournamentId: string;
    seat: number;
    secret: string;
}

export type TournamentErrorCode =
    | 'not_open'
    | 'full'
    | 'not_creator'
    | 'not_enough_players'
    | 'bad_ticket'
    | 'offline'
    | 'unknown';

export class TournamentError extends Error {
    constructor(readonly code: TournamentErrorCode, message: string = code) {
        super(message);
        this.name = 'TournamentError';
    }
}
