// One tournament, live: a first read of its snapshot, then the Realtime feed (watchTournament). While the
// tournament runs, it also asks the server every 15 s to settle matches whose players went silent
// (resolveStale), so a bracket never waits forever on a closed tab.

import { useEffect, useState } from 'react';
import { loadSnapshot, resolveStale } from './tournamentApi';
import { watchTournament } from './tournamentFeed';
import { TournamentError, type TournamentSnapshot } from './types';

const RESOLVE_STALE_MS = 15_000;

const toTournamentError = (error: unknown): TournamentError => {
    if (error instanceof TournamentError) return error;
    console.error('[tournament] unexpected error while loading a tournament', error);
    return new TournamentError('unknown', error instanceof Error ? error.message : String(error));
};

export const useTournament = (id: string): { snapshot: TournamentSnapshot | null; error: TournamentError | null } => {
    const [snapshot, setSnapshot] = useState<TournamentSnapshot | null>(null);
    const [error, setError] = useState<TournamentError | null>(null);

    useEffect(() => {
        let active = true;
        let fedAlready = false; // a feed snapshot is newer than a first read that answers after it
        setSnapshot(null);
        setError(null);
        // The feed's first snapshot comes only once the channel is live: read once ourselves, right away
        loadSnapshot(id).then(
            (first) => { if (active && !fedAlready) setSnapshot(first); },
            (failure: unknown) => { if (active && !fedAlready) setError(toTournamentError(failure)); },
        );
        const stop = watchTournament(id, (next) => {
            fedAlready = true;
            setSnapshot(next);
            setError(null);
        });
        return () => {
            active = false;
            stop();
        };
    }, [id]);

    const running = snapshot?.tournament.status === 'running';
    useEffect(() => {
        if (!running) return undefined;
        const timer = setInterval(() => {
            resolveStale(id).catch((failure: unknown) => console.warn('[tournament] resolveStale failed, retrying in 15 s', failure));
        }, RESOLVE_STALE_MS);
        return () => clearInterval(timer);
    }, [id, running]);

    return { snapshot, error };
};
