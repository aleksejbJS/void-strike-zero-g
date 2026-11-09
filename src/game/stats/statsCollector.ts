// Pure rules for turning the match state's per-player counters into amounts to add to the lifetime totals.
// The state can repeat a snapshot, roll a predicted value back or start a new session: a high-water mark
// per counter makes sure every increase is credited exactly once.

import { SIM_STAT_KEYS } from './statKeys';
import type { Stats } from './statKeys';

/** What was already credited: the session it belongs to and, per counter, the highest value seen so far. */
export interface CollectorMemory { session: string | null; seen: Stats }

const MAX_PLAY_STEP_MS = 1000;

/**
 * The part of `current` that has not been credited yet. `seen` never decreases, so a rolled-back
 * prediction is not counted again when the value comes back. A new session starts from zero;
 * a state without a session (an older server) credits nothing.
 */
export function collectDeltas(mem: CollectorMemory, session: string | undefined, current: Stats | undefined): Stats {
    const delta: Stats = {};
    if (session === undefined) return delta;
    if (mem.session !== session) {
        mem.session = session;
        mem.seen = {};
    }
    for (const key of SIM_STAT_KEYS) {
        const value = current?.[key] ?? 0;
        const before = mem.seen[key] ?? 0;
        if (value <= before) continue;
        delta[key] = value - before;
        mem.seen[key] = value;
    }
    return delta;
}

/** Milliseconds of play to credit for one look. A long gap (a throttled background tab) is capped. */
export function playTimeDelta(elapsedMs: number, active: boolean): number {
    if (!active) return 0;
    return Math.max(0, Math.min(elapsedMs, MAX_PLAY_STEP_MS));
}
