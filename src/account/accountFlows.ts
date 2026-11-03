// The two hand-overs between the guest's device data and an account: finishing a login (any kind:
// a restored session, sign-up or log-in) and logging out. Their step order is what keeps progress safe.

import { PLAYER_KEYS, writeStored } from '../store/playerStorage';
import type { AccountApi, AccountUser } from './accountApi';
import { clearLocalSnapshot, readLocalSnapshot, writeLocalSnapshot } from './localSnapshot';
import { savePending, takePending } from './pendingStore';
import { mergeSnapshots } from './snapshot';
import type { Sync } from './sync';

/**
 * Brings the device in line with the account that just logged in. Never rejects: a cloud that cannot
 * be reached leaves the progress marked unsent, to be pushed later, and the player stays logged in.
 */
export async function completeLogin(sync: Sync, user: AccountUser, reloadPlayer: () => void): Promise<void> {
    // 1. Progress this account could not send before its last logout here. Merged and marked unsent before
    //    any network call, so a push that fails now cannot lose it (the dirty flag survives).
    const pending = takePending(user.id);
    if (pending) {
        writeLocalSnapshot(mergeSnapshots(readLocalSnapshot(), pending));
        sync.requestPush(user.id);
    }

    // 2. Logged in, the player's name is the account nickname.
    writeStored(PLAYER_KEYS.name, user.nickname);

    // 3. Cloud -> local (also pushes back whatever the cloud lacks, e.g. the guest's progress).
    try {
        await sync.pull(user.id);
    } catch (error) {
        console.warn(`[account] could not load progress for user ${user.id}, keeping this device's copy:`, error);
        sync.requestPush(user.id); // so the local copy still reaches the cloud once it is reachable
    }

    // 4. Anything still unsent (an earlier failed push, or step 1) goes now; flush never rejects.
    if (sync.hasPending(user.id)) void sync.flush(user.id);

    // 5. Storage may have changed under the UI (name, skin, colours). Achievements in memory already follow
    //    storage: writeLocalSnapshot replaces them.
    reloadPlayer();
}

export interface LogOutSteps {
    api: AccountApi;
    sync: Sync;
    userId: string;
    reloadPlayer: () => void;
    /** Called once the last push is settled and `sync` disposed: stop pushing for this user from here on. */
    detach: () => void;
}

/**
 * Tries one last push, keeps on the device whatever could not be sent (under the account's id), then
 * ends the session and leaves a clean guest. Never rejects, so logging out always completes locally.
 */
export async function logOutFlow({ api, sync, userId, reloadPlayer, detach }: LogOutSteps): Promise<void> {
    const ok = await sync.flush(userId);
    // hasPending also catches a change made while that push was in flight (it is not in what was saved).
    if (!ok || sync.hasPending(userId)) savePending(userId, readLocalSnapshot());
    sync.dispose();
    detach();

    try {
        await api.logOut();
    } catch (error) {
        // The device still forgets the player: its progress is in the cloud or kept as pending above.
        console.warn('[account] logout request failed, logging out on this device anyway:', error);
    }
    clearLocalSnapshot();
    reloadPlayer();
}
