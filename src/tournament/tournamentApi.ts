// Browser side of the tournament backend: one function per Supabase RPC, plus the readers.
// The SQL (supabase/migrations/20261104000000_tournaments.sql) is the source of truth for names and shapes.
// Every failure comes out as a TournamentError. Callers keep the seat ticket (see seatStore).

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from '../account/supabaseClient';
import {
    MATCH_COLUMNS, SEAT_COLUMNS, TOURNAMENT_COLUMNS, toMatch, toSeat, toTournament,
    type MatchDbRow, type SeatDbRow, type TournamentDbRow,
} from './tournamentRows';
import {
    TournamentError, type SeatTicket, type TournamentErrorCode, type TournamentRow, type TournamentSnapshot,
} from './types';

const MINUTE_MS = 60_000;
const LOBBY_LISTED_MS = 30 * MINUTE_MS; // an unstarted lobby expires after 30 min
const RUNNING_LISTED_MS = 3 * 60 * MINUTE_MS; // a running tournament is listed for up to 3 h
const FINISHED_LISTED_MS = 10 * MINUTE_MS; // a finished one stays listed for 10 min

// Business errors the SQL raises on purpose. The input errors (bad_name, bad_nickname, bad_score, bad_peer_id)
// mean a client bug, so they are not in this set: they become 'unknown' and get logged.
const KNOWN_CODES: ReadonlySet<string> = new Set<TournamentErrorCode>([
    'not_open', 'full', 'not_creator', 'not_enough_players', 'bad_ticket',
]);

function toTournamentError(error: unknown, context: string): TournamentError {
    if (error instanceof TournamentError) return error;
    const raw = typeof error === 'object' && error !== null ? (error as { message?: unknown }).message : error;
    const message = (typeof raw === 'string' ? raw : String(raw)).trim();
    if (KNOWN_CODES.has(message)) return new TournamentError(message as TournamentErrorCode, message);
    console.error(`[tournament] ${context} failed`, error);
    return new TournamentError('unknown', message);
}

function client(): SupabaseClient {
    const db = getSupabase();
    if (!db) throw new TournamentError('offline'); // Supabase is not set up in this build: normal, not logged
    return db;
}

/** Runs one request; a returned error, a thrown fetch failure and a missing client all become TournamentErrors. */
async function request(context: string, run: (db: SupabaseClient) => PromiseLike<{ data: unknown; error: unknown }>): Promise<unknown> {
    const db = client();
    try {
        const { data, error } = await run(db);
        if (error) throw error;
        return data;
    } catch (error) {
        throw toTournamentError(error, context);
    }
}

const rpc = (name: string, params: Record<string, unknown>) => request(name, (db) => db.rpc(name, params));
const seatParams = (t: SeatTicket) => ({ p_id: t.tournamentId, p_seat: t.seat, p_secret: t.secret });
const matchParams = (matchId: string, t: SeatTicket) => ({ p_match: matchId, p_seat: t.seat, p_secret: t.secret });

/** create_tournament answers { id, seat, secret }; join_tournament answers { seat, secret } for the id we passed. */
function toTicket(data: unknown, knownId: string | null, context: string): SeatTicket {
    const raw = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
    const id = knownId ?? raw.id;
    if (typeof id === 'string' && typeof raw.seat === 'number' && typeof raw.secret === 'string') {
        return { tournamentId: id, seat: raw.seat, secret: raw.secret };
    }
    console.error(`[tournament] ${context}: unexpected answer`, data);
    throw new TournamentError('unknown', `${context}: unexpected answer`);
}

export async function createTournament(name: string, nickname: string): Promise<SeatTicket> {
    const data = await rpc('create_tournament', { p_name: name, p_nickname: nickname });
    return toTicket(data, null, 'create_tournament');
}

export async function joinTournament(id: string, nickname: string): Promise<SeatTicket> {
    const data = await rpc('join_tournament', { p_id: id, p_nickname: nickname });
    return toTicket(data, id, 'join_tournament');
}

export async function leaveTournament(t: SeatTicket): Promise<void> {
    await rpc('leave_tournament', seatParams(t));
}

export async function startTournament(t: SeatTicket): Promise<void> {
    await rpc('start_tournament', seatParams(t));
}

/** Heartbeat of a fighter: "I am still here" (feeds resolveStale). */
export async function matchSeen(matchId: string, t: SeatTicket): Promise<void> {
    await rpc('match_seen', matchParams(matchId, t));
}

/** The host's PeerJS id, so the guest and the spectators can connect. */
export async function publishHost(matchId: string, t: SeatTicket, peerId: string): Promise<void> {
    await rpc('publish_host', { ...matchParams(matchId, t), p_peer_id: peerId });
}

export async function reportResult(matchId: string, t: SeatTicket, scoreA: number, scoreB: number): Promise<void> {
    await rpc('report_result', { ...matchParams(matchId, t), p_score_a: scoreA, p_score_b: scoreB });
}

/** Anyone may call it: closes ready matches whose human side went silent for 60 s. */
export async function resolveStale(id: string): Promise<void> {
    await rpc('resolve_stale', { p_id: id });
}

/** Lobbies under 30 min old, running tournaments under 3 h old, finished ones under 10 min old; newest first. */
export async function listOpen(): Promise<TournamentRow[]> {
    const now = Date.now();
    const since = (ms: number) => new Date(now - ms).toISOString();
    const listed = [
        `and(status.eq.lobby,created_at.gte.${since(LOBBY_LISTED_MS)})`,
        `and(status.eq.running,started_at.gte.${since(RUNNING_LISTED_MS)})`,
        `and(status.eq.finished,finished_at.gte.${since(FINISHED_LISTED_MS)})`,
    ].join(',');
    const rows = await request('listOpen', (db) =>
        db.from('tournaments').select(TOURNAMENT_COLUMNS).or(listed).order('created_at', { ascending: false }));
    return ((rows ?? []) as TournamentDbRow[]).map(toTournament);
}

/** The tournament, its seats and its matches. Three plain reads: seats are not in Realtime, so this is how they arrive. */
export async function loadSnapshot(id: string): Promise<TournamentSnapshot> {
    const [tournament, seats, matches] = await Promise.all([
        request('loadSnapshot', (db) => db.from('tournaments').select(TOURNAMENT_COLUMNS).eq('id', id).maybeSingle()),
        request('loadSnapshot', (db) => db.from('tournament_seats').select(SEAT_COLUMNS).eq('tournament_id', id).order('seat')),
        request('loadSnapshot', (db) =>
            db.from('tournament_matches').select(MATCH_COLUMNS).eq('tournament_id', id).order('round').order('slot')),
    ]);
    if (!tournament) {
        console.error(`[tournament] loadSnapshot: tournament ${id} not found (expired and cleaned up?)`);
        throw new TournamentError('unknown', 'tournament not found');
    }
    return {
        tournament: toTournament(tournament as TournamentDbRow),
        seats: ((seats ?? []) as SeatDbRow[]).map(toSeat),
        matches: ((matches ?? []) as MatchDbRow[]).map(toMatch),
    };
}
