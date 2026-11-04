// The columns the browser reads from the three tournament tables, and the snake_case -> camelCase mapping.
// Columns are always listed by name, never `*`: the browser is not allowed to read tournament_seats.secret_hash,
// so `select=*` on that table fails with a permission error (42501).

import type { DecidedBy, MatchRow, MatchStatus, SeatRow, TournamentRow, TournamentStatus } from './types';

export const TOURNAMENT_COLUMNS = 'id, name, status, size, creator_seat, created_at, started_at, finished_at, champion_seat';
export const SEAT_COLUMNS = 'seat, nickname, is_bot, bracket_pos, joined_at, seen_at';
export const MATCH_COLUMNS =
    'id, round, slot, seat_a, seat_b, host_seat, host_peer_id, status, score_a, score_b, winner_seat, decided_by, ready_at';

export interface TournamentDbRow {
    id: string;
    name: string;
    status: TournamentStatus;
    size: 4 | 8 | null;
    creator_seat: number;
    created_at: string;
    started_at: string | null;
    finished_at: string | null;
    champion_seat: number | null;
}

export interface SeatDbRow {
    seat: number;
    nickname: string;
    is_bot: boolean;
    bracket_pos: number | null;
    joined_at: string;
    seen_at: string | null;
}

export interface MatchDbRow {
    id: string;
    round: number;
    slot: number;
    seat_a: number | null;
    seat_b: number | null;
    host_seat: number | null;
    host_peer_id: string | null;
    status: MatchStatus;
    score_a: number;
    score_b: number;
    winner_seat: number | null;
    decided_by: DecidedBy | null;
    ready_at: string | null;
}

export const toTournament = (r: TournamentDbRow): TournamentRow => ({
    id: r.id,
    name: r.name,
    status: r.status,
    size: r.size,
    creatorSeat: r.creator_seat,
    createdAt: r.created_at,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    championSeat: r.champion_seat,
});

export const toSeat = (r: SeatDbRow): SeatRow => ({
    seat: r.seat,
    nickname: r.nickname,
    isBot: r.is_bot,
    bracketPos: r.bracket_pos,
    joinedAt: r.joined_at,
    seenAt: r.seen_at,
});

export const toMatch = (r: MatchDbRow): MatchRow => ({
    id: r.id,
    round: r.round,
    slot: r.slot,
    seatA: r.seat_a,
    seatB: r.seat_b,
    hostSeat: r.host_seat,
    hostPeerId: r.host_peer_id,
    status: r.status,
    scoreA: r.score_a,
    scoreB: r.score_b,
    winnerSeat: r.winner_seat,
    decidedBy: r.decided_by,
    readyAt: r.ready_at,
});
