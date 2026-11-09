// Browser side of the leaderboards: one call to the `leaderboard` RPC, and a check of what comes back.
// The SQL (supabase/migrations/20261109000000_leaderboards.sql) is the source of truth for names and shapes:
//   leaderboard(p_stat, p_period) -> { top: [{ rank, nickname, value }], me: { rank, value } | null }
// Every failure comes out as a LeaderboardError, so the screen only has three cases to word.

import type { SupabaseClient } from '@supabase/supabase-js';

export type RankedStat = 'xp' | 'kills' | 'botKills' | 'wins' | 'botWins' | 'tournamentsWon';
export type Period = 'week' | 'month' | 'all';

export interface BoardRow {
    rank: number;
    nickname: string;
    value: number;
}

export interface Board {
    top: BoardRow[];
    /** The signed-in player's own place; null for a guest or a player who has not scored in this period. */
    me: { rank: number; value: number } | null;
}

export type LeaderboardErrorCode =
    /** Supabase is not set up in this build: normal, not logged. */
    | 'offline'
    /** The request did not get an answer (no connection, timeout, the code could not be loaded): try again later. */
    | 'network'
    /** The server refused or answered something we did not expect: a bug on our side, logged. */
    | 'unknown';

export class LeaderboardError extends Error {
    constructor(readonly code: LeaderboardErrorCode, message: string = code) {
        super(message);
        this.name = 'LeaderboardError';
    }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);
const isRank = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;
const isValue = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

function toRow(raw: unknown): BoardRow | null {
    if (!isRecord(raw)) return null;
    const { rank, nickname, value } = raw;
    return isRank(rank) && typeof nickname === 'string' && isValue(value) ? { rank, nickname, value } : null;
}

function toMe(raw: unknown): Board['me'] {
    if (!isRecord(raw)) return null;
    return isRank(raw.rank) && isValue(raw.value) ? { rank: raw.rank, value: raw.value } : null;
}

/**
 * Checks the RPC answer. Malformed rows are dropped and a malformed `me` becomes null, so one bad value
 * cannot break the whole table; null (nothing yet) is a normal empty board. Anything else odd is warned about.
 */
export function parseBoard(data: unknown): Board {
    if (data === null) return { top: [], me: null };
    if (!isRecord(data)) {
        console.warn('[leaderboard] unexpected answer, showing an empty board', data);
        return { top: [], me: null };
    }
    const rawTop = Array.isArray(data.top) ? data.top : [];
    const top = rawTop.map(toRow).filter((row): row is BoardRow => row !== null);
    const me = toMe(data.me);
    if (!Array.isArray(data.top) || top.length !== rawTop.length || (data.me != null && me === null)) {
        console.warn('[leaderboard] the answer had malformed parts, they were dropped', data);
    }
    return { top, me };
}

// supabase-js reports a failed fetch (offline, timeout) as an error with an EMPTY code; PostgREST and
// PostgreSQL errors (bad_stat and bad_period raised by the SQL, a missing function) always carry one.
const hasServerCode = (error: unknown): boolean =>
    isRecord(error) && typeof error.code === 'string' && error.code !== '';

function toLeaderboardError(error: unknown): LeaderboardError {
    if (error instanceof LeaderboardError) return error;
    const raw = isRecord(error) ? error.message : error;
    const message = (typeof raw === 'string' ? raw : String(raw)).trim();
    console.error('[leaderboard] fetchBoard failed', error);
    return new LeaderboardError(hasServerCode(error) ? 'unknown' : 'network', message);
}

/**
 * Loads one board. The Supabase client is resolved lazily here, but the menu and the tournament code import it
 * statically, so this is a convenience (no import at module load), not a bundle-size saving.
 */
export async function fetchBoard(stat: RankedStat, period: Period): Promise<Board> {
    let data: unknown;
    try {
        const { getSupabase } = await import('../account/supabaseClient');
        const db: SupabaseClient | null = getSupabase();
        if (!db) throw new LeaderboardError('offline');
        const result = await db.rpc('leaderboard', { p_stat: stat, p_period: period });
        if (result.error) throw result.error;
        data = result.data;
    } catch (error) {
        throw toLeaderboardError(error);
    }
    return parseBoard(data);
}
