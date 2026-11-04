// What the watch screen remembers per tile (keyed by match id + host peer id): its status, its live score,
// and how often it was retried. A tile whose host left while its match is still live is remounted after
// TILE_RETRY_MS, at most TILE_MAX_RETRIES times per peer id; a host that reloads brings a new key, so a new count.
// Entries of tiles that are no longer watched (or, for the status, no longer mounted) are dropped.

import { useCallback, useEffect, useState } from 'react';
import type { TileScore, TileStatus } from './MatchTile';

export const TILE_RETRY_MS = 5000;
export const TILE_MAX_RETRIES = 3;

/** `record` without the keys missing from `keep`; the same object when nothing goes. */
const pruned = <T>(record: Record<string, T>, keep: ReadonlySet<string>): Record<string, T> => {
    const gone = Object.keys(record).filter(k => !keep.has(k));
    if (gone.length === 0) return record;
    const next = { ...record };
    for (const k of gone) delete next[k];
    return next;
};

export interface TileStates {
    statuses: Record<string, TileStatus>;
    scores: Record<string, TileScore[]>;
    /** The React key of a tile: a retry changes it, which remounts the tile. */
    mountKey: (key: string) => string;
    setStatus: (key: string, status: TileStatus) => void;
    setScore: (key: string, players: TileScore[]) => void;
}

/**
 * `watched`: keys of the selected live matches; `shown`: keys of the tiles mounted now. `layout` changes on
 * expand and collapse: pending retries start their wait again then.
 */
export const useTileStates = (watched: readonly string[], shown: readonly string[], layout: string): TileStates => {
    const [statuses, setStatuses] = useState<Record<string, TileStatus>>({});
    const [scores, setScores] = useState<Record<string, TileScore[]>>({});
    const [retries, setRetries] = useState<Record<string, number>>({});

    const watchedSig = watched.join('|');
    const shownSig = shown.join('|');
    useEffect(() => {
        const keepWatched = new Set(watchedSig ? watchedSig.split('|') : []);
        const keepShown = new Set(shownSig ? shownSig.split('|') : []);
        setStatuses(prev => pruned(prev, keepShown));
        setScores(prev => pruned(prev, keepWatched));
        setRetries(prev => pruned(prev, keepWatched));
    }, [watchedSig, shownSig]);

    // Mounted tiles whose host left and that have tries left
    const due = shown.filter(k => statuses[k] === 'host_left' && (retries[k] ?? 0) < TILE_MAX_RETRIES).join('|');
    useEffect(() => {
        if (!due) return undefined;
        const timers = due.split('|').map(key => setTimeout(() => {
            setRetries(prev => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }));
            setStatuses(prev => {
                const next = { ...prev };
                delete next[key]; // the new mount reports its own status
                return next;
            });
        }, TILE_RETRY_MS));
        return () => timers.forEach(clearTimeout);
    }, [due, layout]);

    const mountKey = useCallback((key: string) => `${key}#${retries[key] ?? 0}`, [retries]);
    const setStatus = useCallback((key: string, status: TileStatus) => setStatuses(prev => ({ ...prev, [key]: status })), []);
    const setScore = useCallback((key: string, players: TileScore[]) => setScores(prev => ({ ...prev, [key]: players })), []);
    return { statuses, scores, mountKey, setStatus, setScore };
};
