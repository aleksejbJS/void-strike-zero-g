// Per-player counters kept in the match state (spec 2026-11-09 leaderboards).
// The simulation only writes them here; adding them to lifetime totals happens outside it.

import type { GameState } from '../../types';
import type { StatKey } from './statKeys';

/** Add `n` (default 1) to one counter of one player, creating the entries on first use. */
export const bumpStat = (state: GameState, playerId: string, key: StatKey, n = 1): void => {
    const table = (state.playerStats ??= {});
    const stats = (table[playerId] ??= {});
    stats[key] = (stats[key] ?? 0) + n;
};

let fallbackCounter = 0;

/**
 * A fresh id for one room or offline game: lets a client tell a new match series from a
 * snapshot of the one it already counted. Runs in browsers, Web Workers and Node.
 */
export const newStatsSession = (): string => {
    const uuid = globalThis.crypto?.randomUUID?.();
    if (uuid) return uuid;
    fallbackCounter += 1;
    return `s-${Date.now().toString(36)}-${fallbackCounter.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};
