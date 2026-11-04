// Which account the progress on this device belongs to. Written when a login completes and removed when
// the device becomes a guest again, so progress left behind by a session that died (expired, revoked,
// cleared by the browser) is never mistaken for guest progress or handed to the next account.
// A device that never logged in has no owner: its progress is the guest's and is never touched here.

import { readStored, removeStored, writeStored } from '../store/playerStorage';
import { clearLocalSnapshot, readLocalSnapshot } from './localSnapshot';
import { savePending, takePending } from './pendingStore';
import { mergeSnapshots } from './snapshot';

const OWNER_KEY = 'accountOwner';

/** The account whose progress this device holds, or null for a guest's device. */
export function readDeviceOwner(): string | null {
    return readStored(OWNER_KEY);
}

export function setDeviceOwner(userId: string): void {
    writeStored(OWNER_KEY, userId);
}

export function clearDeviceOwner(): void {
    removeStored(OWNER_KEY);
}

/**
 * Moves this device's progress aside as `userId`'s pending progress (merged with any it already had, so
 * nothing is lowered) and leaves a clean guest. Only that account gets it back, on its next login here.
 * The caller reloads the player afterwards.
 */
export function setAsideForAccount(userId: string): void {
    const local = readLocalSnapshot();
    const earlier = takePending(userId);
    savePending(userId, earlier ? mergeSnapshots(local, earlier) : local);
    clearLocalSnapshot();
    clearDeviceOwner();
}
