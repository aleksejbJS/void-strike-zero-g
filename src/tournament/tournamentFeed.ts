// Live view of one tournament: Supabase Realtime tells us "something changed", we answer by reloading the whole
// snapshot (loadSnapshot). Seats are not in Realtime (see the migration), but every seat change bumps
// tournaments.updated_at, so the tournaments subscription covers them. If the channel breaks, a 5 s poll takes over.

import { getSupabase } from '../account/supabaseClient';
import { loadSnapshot } from './tournamentApi';
import type { TournamentSnapshot } from './types';

const DEBOUNCE_MS = 200; // a burst of changes (one RPC touches several rows) becomes one reload
const POLL_MS = 5000;

let watchCount = 0; // makes channel names unique: a re-mount must not get the previous, already joined channel

/**
 * Calls `onSnapshot` with a fresh snapshot after changes, and once the channel is live (covers anything that
 * changed between the caller's first read and the subscription). Returns the function that stops everything.
 * Without a Supabase client there is nothing to watch: it does nothing.
 */
export function watchTournament(id: string, onSnapshot: (snapshot: TournamentSnapshot) => void): () => void {
    const db = getSupabase();
    if (!db) return () => {};

    let stopped = false;
    let latestLoad = 0;
    let loadsRunning = 0;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const reload = async (): Promise<void> => {
        const thisLoad = ++latestLoad;
        let snapshot: TournamentSnapshot;
        loadsRunning++;
        try {
            snapshot = await loadSnapshot(id);
        } catch (error) {
            console.warn('[tournament] feed could not reload, it will try again on the next change', error);
            return;
        } finally {
            loadsRunning--;
        }
        // An older, slower load must not overwrite a newer answer; nothing is delivered after unsubscribe.
        if (!stopped && thisLoad === latestLoad) onSnapshot(snapshot);
    };

    const scheduleReload = (): void => {
        if (debounceTimer !== null) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            debounceTimer = null;
            void reload();
        }, DEBOUNCE_MS);
    };

    const startPolling = (): void => {
        // A tick is skipped while a load is still running: requests can take up to 15 s (the fetch timeout), and a
        // newer load would make the older one "stale", so with a slow connection nothing would ever be delivered.
        if (pollTimer === null) pollTimer = setInterval(() => { if (loadsRunning === 0) void reload(); }, POLL_MS);
    };
    const stopPolling = (): void => {
        if (pollTimer !== null) clearInterval(pollTimer);
        pollTimer = null;
    };

    const channel = db
        .channel(`tournament:${id}:${++watchCount}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments', filter: `id=eq.${id}` }, scheduleReload)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament_matches', filter: `tournament_id=eq.${id}` }, scheduleReload)
        .subscribe((status, error) => {
            if (stopped) return; // a status that arrives after the unsubscribe must not start any timer
            if (status === 'SUBSCRIBED') {
                stopPolling(); // also after a recovery: Realtime rejoins on its own
                scheduleReload();
            } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                console.warn(`[tournament] realtime ${status}, polling every ${POLL_MS / 1000} s instead`, error);
                startPolling();
            }
        });

    return () => {
        if (stopped) return;
        stopped = true;
        if (debounceTimer !== null) clearTimeout(debounceTimer);
        debounceTimer = null;
        stopPolling();
        db.removeChannel(channel).catch((error: unknown) => console.warn('[tournament] could not remove the realtime channel', error));
    };
}
