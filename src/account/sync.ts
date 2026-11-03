// Keeps the cloud snapshot and the local one (the game's working copy) in step.
// pull: cloud -> local (merged, never lowering anything), pushing back whatever the cloud lacks.
// requestPush / flush: local -> cloud, debounced; a per-user "dirty" flag in localStorage survives a failed
// push (or a closed tab) so the next flush can retry.

import { readStored, removeStored, writeStored } from '../store/playerStorage';
import type { AccountApi } from './accountApi';
import { readLocalSnapshot, writeLocalSnapshot } from './localSnapshot';
import { PlayerSnapshot, mergeSnapshots, sanitizeSnapshot } from './snapshot';

export interface Sync {
    /** Merges the cloud snapshot into local storage. Rejects (touching nothing) when the cloud cannot be read. */
    pull(userId: string): Promise<void>;
    /** Marks local progress as not yet saved and schedules a flush after a quiet period. */
    requestPush(userId: string): void;
    /** Merges with the cloud copy and saves it. Never rejects: false means it failed and stays pending. */
    flush(userId: string): Promise<boolean>;
    hasPending(userId: string): boolean;
    /** Cancels scheduled and queued flushes. Unsaved progress stays marked, for the next session. */
    dispose(): void;
}

export const DEFAULT_DEBOUNCE_MS = 2000;
const DIRTY_PREFIX = 'accountDirty:';
const DIRTY_VALUE = '1';
const dirtyKey = (userId: string): string => `${DIRTY_PREFIX}${userId}`;

/** JSON with object keys sorted, so equal data compares equal whatever order the keys were built in. */
const stableJson = (value: unknown): string =>
    JSON.stringify(value, (_key, v: unknown) =>
        v && typeof v === 'object' && !Array.isArray(v)
            ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
            : v);

const sameSnapshot = (a: PlayerSnapshot, b: PlayerSnapshot): boolean =>
    stableJson(sanitizeSnapshot(a)) === stableJson(sanitizeSnapshot(b));

export function createSync(api: AccountApi, opts: { debounceMs?: number } = {}): Sync {
    const debounceMs = opts.debounceMs ?? DEFAULT_DEBOUNCE_MS;
    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    const running = new Map<string, Promise<boolean>>(); // the flush in flight, per user
    const queued = new Map<string, Promise<boolean>>(); // the one flush waiting for it, per user
    const pushCount = new Map<string, number>(); // bumped by each requestPush; tells a flush if it missed one
    let disposed = false;

    const markDirty = (userId: string): void => writeStored(dirtyKey(userId), DIRTY_VALUE);
    const hasPending = (userId: string): boolean => readStored(dirtyKey(userId)) === DIRTY_VALUE;

    async function runFlush(userId: string): Promise<boolean> {
        const countAtStart = pushCount.get(userId) ?? 0;
        try {
            const remote = await api.fetchSnapshot(userId);
            const local = readLocalSnapshot();
            await api.saveSnapshot(userId, remote ? mergeSnapshots(local, remote) : local);
            // A push requested while saving may not be in what was saved: its own flush will clear the flag.
            if ((pushCount.get(userId) ?? 0) === countAtStart) removeStored(dirtyKey(userId));
            return true;
        } catch (error) {
            console.warn(`[account] could not save progress for user ${userId}, will retry:`, error);
            markDirty(userId);
            return false;
        }
    }

    function startFlush(userId: string): Promise<boolean> {
        const promise = runFlush(userId).finally(() => {
            // While a follow-up is queued it is about to start: stay "running" so a flush called in that
            // gap joins the queue instead of starting a second run beside it.
            if (running.get(userId) === promise && !queued.has(userId)) running.delete(userId);
        });
        running.set(userId, promise);
        return promise;
    }

    function flush(userId: string): Promise<boolean> {
        clearTimeout(timers.get(userId)); // this run covers whatever the pending debounce was waiting for
        timers.delete(userId);
        const inFlight = running.get(userId);
        if (!inFlight) return startFlush(userId);
        // The flight under way may have read local before its latest change: wait for it, then run once more.
        let next = queued.get(userId);
        if (!next) {
            next = inFlight.then(() => {
                queued.delete(userId);
                if (disposed) {
                    // The session ended while this waited (logout): local storage may already be cleared or
                    // hold guest progress, so never push it. The dirty flag stays for the next session.
                    running.delete(userId);
                    return false;
                }
                return startFlush(userId);
            });
            queued.set(userId, next);
        }
        return next;
    }

    async function pull(userId: string): Promise<void> {
        const remote = await api.fetchSnapshot(userId); // a failure leaves local storage untouched
        const local = readLocalSnapshot();
        const merged = remote ? mergeSnapshots(local, remote) : local;
        writeLocalSnapshot(merged);
        if (remote && sameSnapshot(merged, remote)) return;
        markDirty(userId); // so a push that fails (or never finishes) is retried
        await flush(userId);
    }

    function requestPush(userId: string): void {
        markDirty(userId);
        // Counted even after dispose: a flush still in flight must not clear the flag of this change.
        pushCount.set(userId, (pushCount.get(userId) ?? 0) + 1);
        if (disposed) return;
        clearTimeout(timers.get(userId));
        timers.set(userId, setTimeout(() => {
            timers.delete(userId);
            void flush(userId); // flush reports its own failures and never rejects
        }, debounceMs));
    }

    function dispose(): void {
        disposed = true;
        for (const timer of timers.values()) clearTimeout(timer);
        timers.clear();
    }

    return { pull, requestPush, flush, hasPending, dispose };
}
