// Progress that could not be sent to the cloud before logout. It is kept on the device under that
// account's id, and only the same account gets it back (and pushes it) on its next login here.
// It is never handed to another account, and never merged into the guest's local progress.

import { readStored, removeStored, writeStored } from '../store/playerStorage';
import { PlayerSnapshot, sanitizeSnapshot } from './snapshot';

const PENDING_PREFIX = 'accountPending:';
const pendingKey = (userId: string): string => `${PENDING_PREFIX}${userId}`;

/** Keeps the unsent snapshot of this account, replacing an older one. */
export function savePending(userId: string, snapshot: PlayerSnapshot): void {
    writeStored(pendingKey(userId), JSON.stringify(snapshot));
}

/** Returns this account's unsent snapshot and forgets it, or null when there is none (or it was unreadable). */
export function takePending(userId: string): PlayerSnapshot | null {
    const key = pendingKey(userId);
    const raw = readStored(key);
    if (raw === null) return null;
    removeStored(key);
    try {
        return sanitizeSnapshot(JSON.parse(raw));
    } catch (error) {
        console.warn(`[account] dropped unreadable pending progress "${key}":`, error);
        return null;
    }
}
