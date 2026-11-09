// Lifetime counters kept in localStorage. Unlike achievement progress they are never capped, so
// leaderboards can rank players long after every achievement is unlocked.

import { achievementManager } from '../systems/achievements';
import { readStored, removeStored, writeStored } from '../../store/playerStorage';
import { achievementIncrements, seedStatsFromAchievements } from './statAchievements';
import { STAT_KEYS } from './statKeys';
import type { StatKey, Stats } from './statKeys';

export const STATS_KEY = 'lifetimeStats';

const isCount = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

/** Only known counters with valid numbers survive; anything else in the object is dropped. */
function sanitize(raw: Record<string, unknown>): Stats {
    const stats: Stats = {};
    for (const key of STAT_KEYS) {
        const value = raw[key];
        if (isCount(value)) stats[key] = value;
    }
    return stats;
}

function save(stats: Stats): void {
    writeStored(STATS_KEY, JSON.stringify(stats));
}

function seed(): Stats {
    const stats = seedStatsFromAchievements(achievementManager.exportProgress());
    save(stats);
    return stats;
}

/** Stored counters. With nothing stored (or unreadable data) they are seeded from achievements and saved. */
export function loadStats(): Stats {
    const raw = readStored(STATS_KEY);
    if (raw === null) return seed();
    try {
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
            throw new Error('stored value is not an object');
        }
        return sanitize(parsed as Record<string, unknown>);
    } catch (err) {
        console.warn(`Stored "${STATS_KEY}" is unreadable, seeding it from achievements:`, err);
        return seed();
    }
}

export const exportStats = (): Stats => loadStats();

/** Overwrites the counters (cloud merge). Silent: achievements are not touched. */
export function replaceStats(s: Stats): void {
    save(sanitize(s));
}

export function clearStats(): void {
    removeStored(STATS_KEY);
}

/** Adds to the counters, saves once, then moves the matching achievements forward. */
export function addStats(delta: Stats): void {
    const before = loadStats();
    const after: Stats = { ...before };
    const changes: Array<[StatKey, number, number]> = [];
    for (const key of STAT_KEYS) {
        const add = delta[key];
        if (!isCount(add) || add === 0) continue;
        const from = before[key] ?? 0;
        after[key] = from + add;
        changes.push([key, from, from + add]);
    }
    if (changes.length === 0) return;
    save(after);
    for (const [key, from, to] of changes) {
        for (const [id, increment] of achievementIncrements(key, from, to)) {
            achievementManager.updateProgress(id, increment);
        }
    }
}
