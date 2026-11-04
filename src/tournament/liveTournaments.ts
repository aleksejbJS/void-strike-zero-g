// One live copy of each tournament the page uses: a first read, then the Realtime feed (watchTournament).
// While it runs, the server is asked every 15 s to settle matches whose players went silent (resolveStale),
// so a bracket never waits forever on a closed tab. While it is a lobby it is re-read every 15 s: the seat
// heartbeats (who may start) are not published to Realtime. Every screen that asks for the same tournament
// (the one on screen and the autopilot) shares this copy, its feed and its timers.

import { loadSnapshot, resolveStale } from './tournamentApi';
import { watchTournament } from './tournamentFeed';
import { TournamentError, type TournamentSnapshot } from './types';

export interface LiveTournament {
    snapshot: TournamentSnapshot | null;
    error: TournamentError | null;
}
type Listener = (live: LiveTournament) => void;

const RESOLVE_STALE_MS = 15_000;
const LOBBY_REFRESH_MS = 15_000;

interface Entry {
    live: LiveTournament;
    listeners: Set<Listener>;
    stop: () => void;
}
const entries = new Map<string, Entry>();

const toTournamentError = (error: unknown): TournamentError => {
    if (error instanceof TournamentError) return error;
    console.error('[tournament] unexpected error while loading a tournament', error);
    return new TournamentError('unknown', error instanceof Error ? error.message : String(error));
};

function open(id: string): Entry {
    const entry: Entry = { live: { snapshot: null, error: null }, listeners: new Set(), stop: () => {} };
    let active = true;
    let fed = 0; // feed snapshots so far: a read that started before the latest one is older than it
    let staleTimer: ReturnType<typeof setInterval> | null = null;
    let lobbyTimer: ReturnType<typeof setInterval> | null = null;

    const reread = () => {
        const fedBefore = fed;
        loadSnapshot(id).then(
            (next) => { if (active && fed === fedBefore) publish({ snapshot: next, error: null }); },
            (failure: unknown) => console.warn('[tournament] lobby re-read failed, trying again in 15 s', failure),
        );
    };
    const settleStale = () => {
        resolveStale(id).catch((failure: unknown) => console.warn('[tournament] resolveStale failed, retrying in 15 s', failure));
    };
    // The timers follow the status of the latest copy
    const schedule = () => {
        const status = entry.live.snapshot?.tournament.status;
        if (status === 'running') staleTimer ??= setInterval(settleStale, RESOLVE_STALE_MS);
        else if (staleTimer !== null) { clearInterval(staleTimer); staleTimer = null; }
        if (status === 'lobby') lobbyTimer ??= setInterval(reread, LOBBY_REFRESH_MS);
        else if (lobbyTimer !== null) { clearInterval(lobbyTimer); lobbyTimer = null; }
    };
    const publish = (live: LiveTournament) => {
        entry.live = live;
        schedule();
        entry.listeners.forEach(listener => listener(live));
    };

    // The feed's first snapshot comes only once the channel is live: read once ourselves, right away
    loadSnapshot(id).then(
        (first) => { if (active && fed === 0) publish({ snapshot: first, error: null }); },
        (failure: unknown) => { if (active && fed === 0) publish({ snapshot: entry.live.snapshot, error: toTournamentError(failure) }); },
    );
    const stopFeed = watchTournament(id, (next) => {
        fed++;
        publish({ snapshot: next, error: null });
    });
    entry.stop = () => {
        active = false;
        stopFeed();
        if (staleTimer !== null) clearInterval(staleTimer);
        if (lobbyTimer !== null) clearInterval(lobbyTimer);
    };
    return entry;
}

/** Follows one tournament; a later subscriber gets the current copy at once. Returns the unsubscribe. */
export function subscribeTournament(id: string, listener: Listener): () => void {
    let entry = entries.get(id);
    if (entry) {
        listener(entry.live);
    } else {
        entry = open(id);
        entries.set(id, entry);
    }
    const mine = entry;
    mine.listeners.add(listener);
    return () => {
        mine.listeners.delete(listener);
        if (mine.listeners.size > 0 || entries.get(id) !== mine) return;
        entries.delete(id);
        mine.stop();
    };
}
